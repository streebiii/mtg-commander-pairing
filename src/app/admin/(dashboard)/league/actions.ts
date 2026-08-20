"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { computeTableSizes } from "@/lib/pairing/tableSizes";
import { assignLeagueRound } from "@/lib/pairing/leagueAssignment";
import { buildPreviousPairings } from "@/lib/pairing/leagueHistory";

const MAX_ROUNDS = 3;

/**
 * Auto-Save für die Liga-Verwaltung: Punktestand und Liga-Teilnahme-Flag
 * eines Spielers. Die Teilnahme-Flag wirkt rein zukunftsgerichtet (siehe
 * SPEC.md Abschnitt 6) — sie filtert nur die Auswahlliste für neue
 * Liga-Abende, bestehende Abende/Ergebnisse bleiben unberührt.
 */
export async function updateLeaguePlayer(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const pointsRaw = String(formData.get("points") ?? "").trim();
  const points = Number.parseInt(pointsRaw, 10);
  const leagueActive = formData.get("leagueActive") === "true";

  if (!id || !Number.isFinite(points)) return;

  await prisma.player.update({
    where: { id },
    data: { points, leagueActive },
  });
  revalidatePath("/admin/league");
}

async function createRoundInDb(
  eveningId: string,
  roundNumber: number,
  tables: string[][],
) {
  await prisma.round.create({
    data: {
      eveningId,
      number: roundNumber,
      tables: {
        create: tables.map((players, i) => ({
          tableNumber: i + 1,
          size: players.length,
          assignments: {
            create: players.map((playerId) => ({ playerId })),
          },
        })),
      },
    },
  });
}

/** Startet einen neuen Liga-Abend (Modus B) mit Runde 1. */
export async function startEvening(formData: FormData) {
  const playerIds = formData.getAll("playerIds").map(String);
  if (playerIds.length < 3) return;

  const active = await prisma.evening.findFirst({
    where: { mode: "LEAGUE", finishedAt: null },
  });
  if (active) return; // es läuft bereits ein Abend — erst beenden

  // leagueActive: true zur Sicherheit auch hier geprüft (nicht nur in der
  // UI-Auswahlliste) — nur Liga-teilnehmende Spieler dürfen in einen
  // Liga-Abend aufgenommen werden (siehe SPEC.md Abschnitt 6).
  const players = await prisma.player.findMany({
    where: { id: { in: playerIds }, leagueActive: true, archivedAt: null },
    select: { id: true, points: true },
  });
  if (players.length !== playerIds.length) return;

  const sizes = computeTableSizes(players.length);
  const tables = assignLeagueRound(players, sizes); // Runde 1: keine Historie

  const evening = await prisma.evening.create({
    data: { mode: "LEAGUE" },
  });
  await createRoundInDb(evening.id, 1, tables);

  revalidatePath("/admin/league");
}

/** Speichert die Rundenergebnisse (Punkte pro Spieler) und schreibt die
 * Gesamt-Liga-Punkte der Spieler fort. Erneutes Speichern korrigiert den
 * Punktestand um die Differenz zum vorherigen Wert (idempotent). */
export async function submitRoundResults(formData: FormData) {
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) return;

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: { tables: { include: { assignments: true } } },
  });
  if (!round) return;

  const updates: { assignmentId: string; playerId: string; newPoints: number; oldPoints: number }[] =
    [];

  for (const table of round.tables) {
    for (const assignment of table.assignments) {
      const raw = formData.get(`points_${assignment.id}`);
      if (raw === null) continue;
      const newPoints = Number.parseInt(String(raw), 10);
      if (!Number.isFinite(newPoints)) continue;
      updates.push({
        assignmentId: assignment.id,
        playerId: assignment.playerId,
        newPoints,
        oldPoints: assignment.pointsAwarded ?? 0,
      });
    }
  }

  await prisma.$transaction(
    updates.flatMap(({ assignmentId, playerId, newPoints, oldPoints }) => [
      prisma.tableAssignment.update({
        where: { id: assignmentId },
        data: { pointsAwarded: newPoints },
      }),
      prisma.player.update({
        where: { id: playerId },
        data: { points: { increment: newPoints - oldPoints } },
      }),
    ]),
  );

  revalidatePath("/admin/league");
}

/** Berechnet und erstellt die nächste Runde (bis max. 3 Runden pro Abend). */
export async function startNextRound(formData: FormData) {
  const eveningId = String(formData.get("eveningId") ?? "");
  if (!eveningId) return;

  const evening = await prisma.evening.findUnique({
    where: { id: eveningId },
    include: {
      rounds: {
        orderBy: { number: "desc" },
        take: 1,
        include: { tables: { include: { assignments: true } } },
      },
    },
  });
  if (!evening || evening.finishedAt) return;

  const lastRound = evening.rounds[0];
  if (!lastRound) return;
  if (lastRound.number >= MAX_ROUNDS) return;

  const allEntered = lastRound.tables.every((t) =>
    t.assignments.every((a) => a.pointsAwarded !== null),
  );
  if (!allEntered) return; // erst Ergebnisse der letzten Runde eintragen

  const attendeeIds = lastRound.tables.flatMap((t) =>
    t.assignments.map((a) => a.playerId),
  );
  const players = await prisma.player.findMany({
    where: { id: { in: attendeeIds } },
    select: { id: true, points: true },
  });

  const sizes = computeTableSizes(players.length);
  const previousPairings = await buildPreviousPairings(eveningId);
  const tables = assignLeagueRound(players, sizes, previousPairings);

  await createRoundInDb(eveningId, lastRound.number + 1, tables);
  revalidatePath("/admin/league");
}

/**
 * Würfelt die Tischzuteilung einer Runde neu aus (gleicher Spieler-Pool,
 * neue Zufallsziehung inkl. Rang-Jitter, siehe SPEC.md Abschnitt 5.1).
 * Nur für die jeweils letzte Runde eines Abends möglich, und nur solange
 * noch keine Ergebnisse für sie eingetragen wurden — sonst würden bereits
 * erfasste Punkte ihre Zuordnung verlieren.
 */
export async function regenerateRound(formData: FormData) {
  const roundId = String(formData.get("roundId") ?? "");
  if (!roundId) return;

  const round = await prisma.round.findUnique({
    where: { id: roundId },
    include: {
      evening: { include: { rounds: { orderBy: { number: "desc" }, take: 1 } } },
      tables: { include: { assignments: true } },
    },
  });
  if (!round) return;

  const isLastRound = round.evening.rounds[0]?.id === round.id;
  if (!isLastRound) return;

  const anyResultEntered = round.tables.some((t) =>
    t.assignments.some((a) => a.pointsAwarded !== null),
  );
  if (anyResultEntered) return;

  const attendeeIds = round.tables.flatMap((t) =>
    t.assignments.map((a) => a.playerId),
  );
  const players = await prisma.player.findMany({
    where: { id: { in: attendeeIds } },
    select: { id: true, points: true },
  });

  const sizes = computeTableSizes(players.length);
  const previousPairings = await buildPreviousPairings(
    round.eveningId,
    round.number,
  );
  const tables = assignLeagueRound(players, sizes, previousPairings);

  await prisma.$transaction([
    prisma.table.deleteMany({ where: { roundId: round.id } }),
    ...tables.map((tablePlayers, i) =>
      prisma.table.create({
        data: {
          roundId: round.id,
          tableNumber: i + 1,
          size: tablePlayers.length,
          assignments: { create: tablePlayers.map((playerId) => ({ playerId })) },
        },
      }),
    ),
  ]);

  revalidatePath("/admin/league");
}

/** Verschiebt einen Spieler manuell an einen anderen Tisch derselben Runde. */
export async function reassignTable(formData: FormData) {
  const assignmentId = String(formData.get("assignmentId") ?? "");
  const newTableId = String(formData.get("newTableId") ?? "");
  if (!assignmentId || !newTableId) return;

  await prisma.tableAssignment.update({
    where: { id: assignmentId },
    data: { tableId: newTableId },
  });
  revalidatePath("/admin/league");
}

/** Beendet den aktuellen Liga-Abend (keine weiteren Runden mehr möglich). */
export async function finishEvening(formData: FormData) {
  const eveningId = String(formData.get("eveningId") ?? "");
  if (!eveningId) return;

  await prisma.evening.update({
    where: { id: eveningId },
    data: { finishedAt: new Date() },
  });
  revalidatePath("/admin/league");
}
