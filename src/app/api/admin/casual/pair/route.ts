import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import { saveCasualPairing } from "@/lib/casualPairing";
import { prisma } from "@/lib/prisma";
import { computeTableSizes } from "@/lib/pairing/tableSizes";
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
        return { error: "Gruppe enthält einen nicht anwesenden Spieler" };
      }
      if (seenPlayers.has(pid)) {
        return { error: "Ein Spieler ist in mehreren Gruppen" };
      }
      seenPlayers.add(pid);
    }
    groups.push({ id, playerIds: groupPlayerIds as string[] });
  }
  return groups;
}

/**
 * Berechnet eine Modus-A-Tischzuteilung (Casual, keine Persistenz — siehe
 * SPEC.md Abschnitt 4). Zwei Untermodi (siehe Abschnitt 4.2):
 * - "random" (Standard): rein zufällige Zuteilung.
 * - "skill": nach Skill-Level balanciert, mit Zufallsfaktor.
 *
 * Mit `allowFiveTable` darf ein einzelner 5er-Tisch entstehen, wo er die
 * Verteilung verbessert (siehe SPEC.md Abschnitt 3.1) — eine reine
 * Casual-Option, die Liga rechnet weiterhin ohne.
 *
 * Optional werden Gruppen mitgegeben (siehe SPEC.md Abschnitt 4.1):
 * ihre Mitglieder landen garantiert am selben Tisch. Das UI prüft die
 * Machbarkeit bereits vorab, hier wird zusätzlich serverseitig validiert.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const playerIds: unknown = body?.playerIds;
  const mode = body?.mode === "skill" ? "skill" : "random";
  const allowFiveTable = body?.allowFiveTable === true;

  if (!Array.isArray(playerIds) || playerIds.some((id) => typeof id !== "string")) {
    return NextResponse.json(
      { error: "playerIds muss ein Array von Strings sein" },
      { status: 400 },
    );
  }

  if (playerIds.length < 3) {
    return NextResponse.json(
      { error: "Mindestens 3 Spieler nötig für ein Pairing" },
      { status: 400 },
    );
  }

  const groupsResult = parseGroups(body?.groups, playerIds as string[]);
  if ("error" in groupsResult) {
    return NextResponse.json({ error: groupsResult.error }, { status: 400 });
  }
  const groups = groupsResult;

  const players = await prisma.player.findMany({
    where: { id: { in: playerIds as string[] }, archivedAt: null },
    select: { id: true, firstName: true, lastName: true, skillLevel: true },
  });

  if (players.length !== playerIds.length) {
    return NextResponse.json(
      { error: "Einige Spieler-IDs wurden nicht gefunden" },
      { status: 400 },
    );
  }

  try {
    const sizes = computeTableSizes(players.length, { allowFiveTable });

    if (groups.length > 0) {
      const packing = packGroupsIntoTables(
        groups.map((g) => ({ id: g.id, size: g.playerIds.length })),
        sizes,
      );
      if (!packing) {
        return NextResponse.json(
          {
            error:
              "Die Gruppen passen nicht in die berechneten Tischgrößen",
          },
          { status: 400 },
        );
      }
    }

    const tables =
      mode === "skill"
        ? assignSkillBalancedCasualRound(players, sizes, undefined, groups)
        : assignCasualRound(
            players.map((p) => p.id),
            sizes,
            groups,
          );
    const nameById = new Map(players.map((p) => [p.id, formatPlayerName(p)]));
    const skillById = new Map(players.map((p) => [p.id, p.skillLevel]));

    // Sofort als aktuelle Zuteilung übernehmen, damit die öffentliche
    // Lese-Ansicht dieselben Tische zeigt (siehe SPEC.md Abschnitt 4).
    // Ersetzt eine eventuell vorhandene frühere Zuteilung vollständig.
    await saveCasualPairing(
      tables.map((table, i) => ({ tableNumber: i + 1, playerIds: table })),
    );
    revalidatePath("/");

    return NextResponse.json({
      tables: tables.map((table, i) => ({
        tableNumber: i + 1,
        size: table.length,
        players: table.map((id) => ({
          id,
          name: nameById.get(id) ?? "?",
          skillLevel: skillById.get(id) ?? 0,
        })),
      })),
    });
  } catch (err) {
    if (err instanceof PairingError) {
      return NextResponse.json({ error: err.message }, { status: 400 });
    }
    throw err;
  }
}
