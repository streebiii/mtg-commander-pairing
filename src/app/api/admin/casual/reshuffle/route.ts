import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { saveCasualPairing } from "@/lib/casualPairing";
import { prisma } from "@/lib/prisma";
import { assignCasualRound } from "@/lib/pairing/casualAssignment";
import { assignSkillBalancedCasualRound } from "@/lib/pairing/skillAssignment";
import {
  MAX_GROUP_SIZE,
  MIN_GROUP_SIZE,
  packGroupsIntoTables,
  type PlayerGroup,
} from "@/lib/pairing/groups";
import { PairingError } from "@/lib/pairing/errors";
import { formatPlayerName } from "@/lib/players";

interface InputTable {
  tableNumber: number;
  playerIds: string[];
}

/** Parst und validiert die Tischliste aus dem Request-Body. */
function parseTables(raw: unknown): InputTable[] | { error: string } {
  if (!Array.isArray(raw) || raw.length === 0) {
    return { error: "tables muss ein nicht-leeres Array sein" };
  }
  const tables: InputTable[] = [];
  const seenNumbers = new Set<number>();
  for (const entry of raw as unknown[]) {
    const e = entry as { tableNumber?: unknown; playerIds?: unknown };
    if (
      typeof e?.tableNumber !== "number" ||
      !Array.isArray(e.playerIds) ||
      e.playerIds.some((id: unknown) => typeof id !== "string")
    ) {
      return { error: "Ungültiges Tisch-Format" };
    }
    if (seenNumbers.has(e.tableNumber)) {
      return { error: "Doppelte Tischnummer" };
    }
    seenNumbers.add(e.tableNumber);
    tables.push({ tableNumber: e.tableNumber, playerIds: e.playerIds as string[] });
  }
  return tables;
}

/** Parst und validiert die optionalen Gruppen aus dem Request-Body. */
function parseGroups(
  raw: unknown,
  playerIds: readonly string[],
): PlayerGroup[] | { error: string } {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return { error: "groups muss ein Array sein" };

  const playerIdSet = new Set(playerIds);
  const seenPlayers = new Set<string>();
  const groups: PlayerGroup[] = [];

  for (const entry of raw) {
    const id = entry?.id;
    const groupPlayerIds = entry?.playerIds;
    if (
      typeof id !== "string" ||
      !Array.isArray(groupPlayerIds) ||
      groupPlayerIds.some((p: unknown) => typeof p !== "string")
    ) {
      return { error: "Ungültiges Gruppen-Format" };
    }
    if (
      groupPlayerIds.length < MIN_GROUP_SIZE ||
      groupPlayerIds.length > MAX_GROUP_SIZE
    ) {
      return {
        error: `Gruppen müssen zwischen ${MIN_GROUP_SIZE} und ${MAX_GROUP_SIZE} Spieler haben`,
      };
    }
    for (const pid of groupPlayerIds as string[]) {
      if (!playerIdSet.has(pid)) {
        // Gruppenmitglied sitzt nicht auf einem der ausgewählten Tische —
        // die Gruppe ist für dieses Teil-Mischen schlicht nicht relevant,
        // kein Fehler (siehe Grill-Notizen: eine Gruppe kann laut Definition
        // ohnehin nie über zwei Tische verteilt sein).
        continue;
      }
      if (seenPlayers.has(pid)) {
        return { error: "Ein Spieler ist in mehreren Gruppen" };
      }
      seenPlayers.add(pid);
    }
    const relevantIds = (groupPlayerIds as string[]).filter((pid) =>
      playerIdSet.has(pid),
    );
    if (relevantIds.length === groupPlayerIds.length) {
      groups.push({ id, playerIds: relevantIds });
    }
  }
  return groups;
}

/**
 * Mischt die Belegung ausgewählter Tische neu, ohne die übrigen Tische
 * oder die Tischgrößen anzufassen (siehe BACKLOG.md "Casual: einzelne
 * Tische selektiv neu mischen", fertig gegrillt).
 *
 * Der Client schickt die vollständige aktuelle Zuteilung mit (`tables`),
 * dazu die Nummern der zu mischenden Tische, den Zuteilungsmodus (wird von
 * der letzten vollen Berechnung übernommen) und ob Gruppen dabei
 * garantiert zusammenbleiben sollen ("Gruppen behalten" vs. "Gruppen
 * auflösen" — bewusst bei jedem Durchgang neu entschieden, keine feste
 * Regel).
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  const tablesResult = parseTables(body?.tables);
  if ("error" in tablesResult) {
    return NextResponse.json({ error: tablesResult.error }, { status: 400 });
  }
  const allTables = tablesResult;

  const tableNumbers: unknown = body?.tableNumbers;
  if (
    !Array.isArray(tableNumbers) ||
    tableNumbers.some((n) => typeof n !== "number") ||
    new Set(tableNumbers).size !== tableNumbers.length
  ) {
    return NextResponse.json(
      { error: "tableNumbers muss ein Array eindeutiger Zahlen sein" },
      { status: 400 },
    );
  }
  if (tableNumbers.length < 2) {
    return NextResponse.json(
      { error: "Mindestens 2 Tische für das Neumischen auswählen" },
      { status: 400 },
    );
  }

  const mode = body?.mode === "skill" ? "skill" : "random";
  const keepGroups = body?.keepGroups === true;

  const selectedTables = allTables.filter((t) =>
    tableNumbers.includes(t.tableNumber),
  );
  if (selectedTables.length !== tableNumbers.length) {
    return NextResponse.json(
      { error: "Eine ausgewählte Tischnummer existiert nicht" },
      { status: 400 },
    );
  }

  const selectedPlayerIds = selectedTables.flatMap((t) => t.playerIds);
  const groupsResult = keepGroups
    ? parseGroups(body?.groups, selectedPlayerIds)
    : [];
  if ("error" in groupsResult) {
    return NextResponse.json({ error: groupsResult.error }, { status: 400 });
  }
  const groups = groupsResult;

  // Bewusst OHNE `archivedAt: null`: wer bereits an einem Tisch sitzt,
  // bleibt mischbar, auch wenn er zwischenzeitlich archiviert wurde. Beim
  // Neumischen wird nicht entschieden, wer anwesend ist (das macht die
  // volle Berechnung in ../pair), sondern nur die bestehende Belegung
  // umgestellt. Seit die Zuteilung einen Reload überlebt, kann sie
  // durchaus einen inzwischen archivierten Spieler enthalten — der Abend
  // soll daran nicht scheitern.
  const players = await prisma.player.findMany({
    where: { id: { in: selectedPlayerIds } },
    select: { id: true, firstName: true, lastName: true, skillLevel: true },
  });
  if (players.length !== selectedPlayerIds.length) {
    return NextResponse.json(
      { error: "Einige Spieler wurden nicht gefunden" },
      { status: 400 },
    );
  }

  try {
    // Tischgrößen bleiben fix — nur wer wo sitzt wird neu gewürfelt.
    // Reihenfolge nach Tischgröße absteigend, weil assignCasualRound /
    // assignSkillBalancedCasualRound intern genauso sortieren und ihr
    // Ergebnis in dieser Reihenfolge zurückgeben; stabile Sortierung
    // erhält dabei die Zuordnung zwischen gleich großen Tischen.
    const orderedSelected = [...selectedTables].sort(
      (a, b) => b.playerIds.length - a.playerIds.length,
    );
    const sizes = orderedSelected.map((t) => t.playerIds.length);

    if (groups.length > 0) {
      const packing = packGroupsIntoTables(
        groups.map((g) => ({ id: g.id, size: g.playerIds.length })),
        sizes,
      );
      if (!packing) {
        return NextResponse.json(
          {
            error:
              "Die Gruppen passen nicht in die Tischgrößen der ausgewählten Tische",
          },
          { status: 400 },
        );
      }
    }

    const newTables =
      mode === "skill"
        ? assignSkillBalancedCasualRound(players, sizes, undefined, groups)
        : assignCasualRound(selectedPlayerIds, sizes, groups);

    const nameById = new Map(players.map((p) => [p.id, formatPlayerName(p)]));
    const skillById = new Map(players.map((p) => [p.id, p.skillLevel]));

    const fullTables = allTables.map((t) => {
      const orderedIndex = orderedSelected.findIndex(
        (s) => s.tableNumber === t.tableNumber,
      );
      if (orderedIndex === -1) return t;
      return { tableNumber: t.tableNumber, playerIds: newTables[orderedIndex] };
    });

    // Sofort als aktuelle Zuteilung übernehmen, wie beim manuellen Tausch.
    await saveCasualPairing(fullTables);
    revalidatePath("/");
    revalidatePath("/admin/casual");

    const updatedTables = orderedSelected.map((t, i) => ({
      tableNumber: t.tableNumber,
      size: newTables[i].length,
      players: newTables[i].map((id) => ({
        id,
        name: nameById.get(id) ?? "?",
        skillLevel: skillById.get(id) ?? 0,
      })),
    }));

    return NextResponse.json({ tables: updatedTables });
  } catch (err) {
    if (err instanceof PairingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
