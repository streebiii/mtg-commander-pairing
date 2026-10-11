"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/adminGuard";
import {
  clearCasualPairing,
  publishCasualPairing,
  saveCasualPairing,
} from "@/lib/casualPairing";
import { prisma } from "@/lib/prisma";
import { formatPlayerName } from "@/lib/players";
import { assignCasualRound } from "@/lib/pairing/casualAssignment";
import { assignSkillBalancedCasualRound } from "@/lib/pairing/skillAssignment";
import { computeTableSizes } from "@/lib/pairing/tableSizes";
import {
  packGroupsIntoTables,
  parseGroups,
  type PlayerGroup,
} from "@/lib/pairing/groups";
import { PairingError } from "@/lib/pairing/errors";

export interface CasualTable {
  tableNumber: number;
  size: number;
  players: { id: string; name: string }[];
}

type Mode = "random" | "skill";

/** Beide Ansichten zeigen die Zuteilung — nach Änderungen auffrischen. */
function revalidateCasualViews() {
  revalidatePath("/");
  revalidatePath("/admin/casual");
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((v) => typeof v === "string");
}

/**
 * Teilt die Spieler nach der gewählten Zuteilungsart (SPEC.md Abschnitt
 * 4.2) auf Tische der gegebenen Grössen auf. Gruppen sitzen garantiert
 * zusammen; passen sie nicht, gibt es eine Fehlermeldung.
 */
function assign(
  players: { id: string; skillLevel: number }[],
  sizes: number[],
  mode: Mode,
  groups: PlayerGroup[],
): string[][] | { error: string } {
  if (
    groups.length > 0 &&
    !packGroupsIntoTables(
      groups.map((g) => ({ id: g.id, size: g.playerIds.length })),
      sizes,
    )
  ) {
    return { error: "Die Gruppen passen nicht in die Tischgrössen" };
  }
  return mode === "skill"
    ? assignSkillBalancedCasualRound(players, sizes, undefined, groups)
    : assignCasualRound(
        players.map((p) => p.id),
        sizes,
        groups,
      );
}

/**
 * Berechnet eine neue Zuteilung (siehe SPEC.md Abschnitt 4). Sie ersetzt
 * eine eventuell vorhandene und landet im Warteraum — öffentlich wird sie
 * erst mit `publishCasual`.
 *
 * Mit `allowFiveTable` darf ein einzelner 5er-Tisch entstehen, wo er die
 * Verteilung verbessert (Abschnitt 3.1). Gruppen (Abschnitt 4.1) prüft das
 * UI bereits vorab, hier wird zusätzlich serverseitig validiert.
 */
export async function computeCasual(input: {
  playerIds: unknown;
  mode: unknown;
  allowFiveTable: unknown;
  groups: unknown;
}): Promise<{ tables: CasualTable[] } | { error: string }> {
  await requireAdmin();
  const { playerIds } = input;
  const mode: Mode = input.mode === "skill" ? "skill" : "random";
  if (!isStringArray(playerIds)) return { error: "Ungültige Spielerauswahl" };
  if (playerIds.length < 3) return { error: "Mindestens 3 Spieler nötig für ein Pairing" };

  const groups = parseGroups(input.groups);
  if ("error" in groups) return groups;
  const present = new Set(playerIds);
  if (groups.some((g) => g.playerIds.some((id) => !present.has(id)))) {
    return { error: "Gruppe enthält einen nicht anwesenden Spieler" };
  }

  const players = await prisma.player.findMany({
    where: { id: { in: playerIds }, archivedAt: null },
    select: { id: true, firstName: true, lastName: true, skillLevel: true },
  });
  if (players.length !== playerIds.length) {
    return { error: "Einige Spieler wurden nicht gefunden" };
  }

  try {
    const sizes = computeTableSizes(players.length, {
      allowFiveTable: input.allowFiveTable === true,
    });
    const tables = assign(players, sizes, mode, groups);
    if ("error" in tables) return tables;

    await saveCasualPairing(
      tables.map((ids, i) => ({ tableNumber: i + 1, playerIds: ids })),
      { keepPublished: false },
    );
    revalidateCasualViews();

    const nameById = new Map(players.map((p) => [p.id, formatPlayerName(p)]));
    return {
      tables: tables.map((ids, i) => ({
        tableNumber: i + 1,
        size: ids.length,
        players: ids.map((id) => ({ id, name: nameById.get(id) ?? "?" })),
      })),
    };
  } catch (err) {
    if (err instanceof PairingError) return { error: err.message };
    throw err;
  }
}

/**
 * Mischt die Belegung ausgewählter Tische neu, ohne die übrigen Tische
 * oder die Tischgrössen anzufassen.
 *
 * Der Browser schickt die vollständige aktuelle Zuteilung mit, dazu die
 * Nummern der zu mischenden Tische, die Zuteilungsart (von der letzten
 * vollen Berechnung übernommen) und ob Gruppen dabei zusammenbleiben
 * ("Gruppen behalten" vs. "Gruppen auflösen" — bei jedem Durchgang neu
 * entschieden). Eine bereits live geschaltete Zuteilung bleibt live.
 *
 * @returns Nur die neu gemischten Tische.
 */
export async function reshuffleCasual(input: {
  tables: unknown;
  tableNumbers: unknown;
  mode: unknown;
  keepGroups: unknown;
  groups: unknown;
}): Promise<{ tables: CasualTable[] } | { error: string }> {
  await requireAdmin();
  const mode: Mode = input.mode === "skill" ? "skill" : "random";

  if (
    !Array.isArray(input.tables) ||
    !input.tables.every(
      (t) => typeof t?.tableNumber === "number" && isStringArray(t?.playerIds),
    )
  ) {
    return { error: "Ungültiges Tisch-Format" };
  }
  const allTables = input.tables as { tableNumber: number; playerIds: string[] }[];
  if (new Set(allTables.map((t) => t.tableNumber)).size !== allTables.length) {
    return { error: "Doppelte Tischnummer" };
  }

  const tableNumbers = input.tableNumbers;
  if (
    !Array.isArray(tableNumbers) ||
    tableNumbers.some((n) => typeof n !== "number") ||
    new Set(tableNumbers).size !== tableNumbers.length
  ) {
    return { error: "Ungültige Tischauswahl" };
  }
  if (tableNumbers.length < 2) {
    return { error: "Mindestens 2 Tische für das Neumischen auswählen" };
  }

  // Grösste Tische zuerst, weil die Zuteilung ihr Ergebnis in dieser
  // Reihenfolge zurückgibt; die stabile Sortierung erhält dabei die
  // Zuordnung zwischen gleich grossen Tischen.
  const selected = allTables
    .filter((t) => tableNumbers.includes(t.tableNumber))
    .sort((a, b) => b.playerIds.length - a.playerIds.length);
  if (selected.length !== tableNumbers.length) {
    return { error: "Eine ausgewählte Tischnummer existiert nicht" };
  }
  const selectedIds = selected.flatMap((t) => t.playerIds);

  // Nur Gruppen, die komplett auf den gewählten Tischen sitzen — eine
  // Gruppe sitzt ohnehin nie über zwei Tische verteilt.
  let groups: PlayerGroup[] = [];
  if (input.keepGroups === true) {
    const parsed = parseGroups(input.groups);
    if ("error" in parsed) return parsed;
    const onSelected = new Set(selectedIds);
    groups = parsed.filter((g) => g.playerIds.every((id) => onSelected.has(id)));
  }

  // Bewusst ohne `archivedAt: null`: wer bereits an einem Tisch sitzt,
  // bleibt mischbar, auch wenn er inzwischen archiviert wurde. Hier wird
  // nicht entschieden, wer anwesend ist, nur die Belegung umgestellt.
  const players = await prisma.player.findMany({
    where: { id: { in: selectedIds } },
    select: { id: true, firstName: true, lastName: true, skillLevel: true },
  });
  if (players.length !== selectedIds.length) {
    return { error: "Einige Spieler wurden nicht gefunden" };
  }
  // Reihenfolge wie auf den Tischen, damit "Zufällig" nicht von der
  // Datenbank-Reihenfolge abhängt.
  const byId = new Map(players.map((p) => [p.id, p]));
  const ordered = selectedIds.map((id) => byId.get(id)!);

  try {
    const newTables = assign(
      ordered,
      selected.map((t) => t.playerIds.length),
      mode,
      groups,
    );
    if ("error" in newTables) return newTables;

    const newByNumber = new Map(selected.map((t, i) => [t.tableNumber, newTables[i]]));
    await saveCasualPairing(
      allTables.map((t) => ({
        tableNumber: t.tableNumber,
        playerIds: newByNumber.get(t.tableNumber) ?? t.playerIds,
      })),
      { keepPublished: true },
    );
    revalidateCasualViews();

    return {
      tables: selected.map((t, i) => ({
        tableNumber: t.tableNumber,
        size: newTables[i].length,
        players: newTables[i].map((id) => ({
          id,
          name: formatPlayerName(byId.get(id)!),
        })),
      })),
    };
  } catch (err) {
    if (err instanceof PairingError) return { error: err.message };
    throw err;
  }
}

/**
 * Übernimmt eine von Hand angepasste Zuteilung (zwei Spieler getauscht).
 * Eine bereits live geschaltete Zuteilung bleibt live.
 */
export async function saveCasualSwap(
  tables: { tableNumber: number; playerIds: string[] }[],
): Promise<void> {
  await requireAdmin();
  await saveCasualPairing(tables, { keepPublished: true });
  revalidateCasualViews();
}

/** «Live schalten»: die Zuteilung erscheint auf der öffentlichen Seite. */
export async function publishCasual(): Promise<void> {
  await requireAdmin();
  await publishCasualPairing();
  revalidateCasualViews();
}

/** Verwirft die aktuelle Zuteilung (Knopf "Zurücksetzen"). */
export async function resetCasual(): Promise<void> {
  await requireAdmin();
  await clearCasualPairing();
  revalidateCasualViews();
}
