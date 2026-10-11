import { prisma } from "@/lib/prisma";
import { toSheetAchievement } from "@/lib/entries";
import { computeBreakdown, marksToMap, type Breakdown } from "@/lib/entrySheet";
import { formatPlayerName } from "@/lib/players";
import { buildRanking, type AppEvening } from "@/lib/ranking";
import { isInSeason, isLastEvening } from "@/lib/season";

/**
 * Lädt alles für die Rangliste (siehe SPEC.md Abschnitt 13): die
 * Liga-Teilnehmenden, ihre importierten Abende und die Abende aus der
 * App, deren Erfassung geschlossen und einer Spalte zugeordnet ist.
 *
 * Mit einer festen Zahl von Abfragen statt einer pro Abend oder Spieler,
 * weil Neon von Vercel aus jede Abfrage einzeln kostet.
 */
export async function loadRanking() {
  const [players, imported, evenings] = await Promise.all([
    prisma.player.findMany({
      where: { leagueActive: true },
      select: { id: true, firstName: true, lastName: true, colorIdentity: true },
    }),
    prisma.importedEveningScore.findMany({
      where: { player: { leagueActive: true } },
      select: { playerId: true, round: true, points: true },
    }),
    prisma.evening.findMany({
      where: { entryClosedAt: { not: null }, seasonRound: { not: null } },
      select: { id: true, date: true, seasonRound: true },
      orderBy: { date: "asc" },
    }),
  ]);

  // Pro Spalte zählt höchstens ein Abend (beim Schliessen geprüft); falls
  // doch zwei, gilt der spätere.
  const byRound = new Map(
    evenings.filter((e) => isInSeason(e.date)).map((e) => [e.seasonRound!, e]),
  );
  const counted = [...byRound.values()];
  const eveningIds = counted.map((e) => e.id);

  const [achievements, assignments, entries] = await Promise.all([
    prisma.eveningAchievement.findMany({ where: { eveningId: { in: eveningIds } } }),
    prisma.tableAssignment.findMany({
      where: { table: { round: { eveningId: { in: eveningIds }, publishedAt: { not: null } } } },
      select: {
        playerId: true,
        table: { select: { round: { select: { eveningId: true, number: true } } } },
      },
    }),
    prisma.playerEntry.findMany({
      where: { eveningId: { in: eveningIds } },
      select: { eveningId: true, playerId: true, marks: true },
    }),
  ]);

  const appEvenings: AppEvening[] = counted.map((evening) => {
    const sheet = achievements
      .filter((a) => a.eveningId === evening.id)
      .map(toSheetAchievement);
    const lastEvening = isLastEvening(evening.date);

    // Wer in einer veröffentlichten Runde sass, hat gespielt — auch ohne
    // eigene Erfassung (dann zählt nur Participation).
    const games = new Map<string, number[]>();
    for (const a of assignments) {
      if (a.table.round.eveningId !== evening.id) continue;
      games.set(a.playerId, [...(games.get(a.playerId) ?? []), a.table.round.number]);
    }

    const results = new Map<string, Breakdown>();
    for (const [playerId, played] of games) {
      const entry = entries.find((e) => e.eveningId === evening.id && e.playerId === playerId);
      results.set(
        playerId,
        computeBreakdown(sheet, marksToMap(entry?.marks ?? []), played, lastEvening),
      );
    }
    return { round: evening.seasonRound!, date: evening.date, results };
  });

  return buildRanking(
    players.map((p) => ({
      id: p.id,
      name: formatPlayerName(p),
      colorIdentity: p.colorIdentity,
    })),
    imported,
    appEvenings,
  );
}
