import { prisma } from "@/lib/prisma";
import { toSheetAchievement } from "@/lib/entries";
import {
  computeBreakdown,
  marksToMap,
  type Breakdown,
  type SheetAchievement,
} from "@/lib/entrySheet";
import { loadPublicNames } from "@/lib/publicRoster";
import { buildRanking, type AppEvening } from "@/lib/ranking";
import type { LeaguePlayerStanding } from "@/lib/pairing/leagueRanking";
import { isInSeason, isLastEvening } from "@/lib/season";

/** Ein Abend, der in der Rangliste zählt, mit den Erfassungen aller, die dort gespielt haben. */
export interface SeasonEvening {
  round: number;
  date: Date;
  lastEvening: boolean;
  achievements: SheetAchievement[];
  players: {
    playerId: string;
    games: number[];
    marks: Map<string, number>;
    /**
     * Hat selbst etwas erfasst. Ohne Markierung lässt sich nicht sagen, ob
     * ein Achievement fehlt oder nur nichts eingetragen wurde.
     */
    hasMarks: boolean;
  }[];
  /**
   * Erfassungen von Liga-Teilnehmenden, die an diesem Abend nicht gespielt
   * haben. Daraus zählt nur Evergreen («1x am Ende der Liga»), das der
   * Organisator auch Abwesenden geben kann (SPEC.md Abschnitt 13.1).
   */
  absent: { playerId: string; marks: Map<string, number> }[];
}

/**
 * Die Abende aus der App, deren Erfassung geschlossen und einer Spalte
 * zugeordnet ist — Grundlage der Rangliste (SPEC.md Abschnitt 13) und der
 * Ehrungen (Abschnitt 15). Mit einer festen Zahl von Abfragen statt einer
 * pro Abend oder Spieler, weil Neon von Vercel aus jede Abfrage einzeln
 * kostet.
 *
 * @param publicOnly lässt das Finale weg, solange der Organisator die
 *   Endrangliste nicht freigegeben hat (Abschnitt 13.5). Nur für öffentliche
 *   Seiten; der Organisator sieht immer alles.
 */
export async function loadSeasonEvenings({ publicOnly = false } = {}): Promise<SeasonEvening[]> {
  const evenings = await prisma.evening.findMany({
    where: {
      entryClosedAt: { not: null },
      seasonRound: { not: null },
      ...(publicOnly
        ? { OR: [{ pairByPoints: false }, { rankingPublishedAt: { not: null } }] }
        : {}),
    },
    select: { id: true, date: true, seasonRound: true },
    orderBy: { date: "asc" },
  });

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
      select: { eveningId: true, playerId: true, marks: true, games: true },
    }),
  ]);

  return counted.map((evening) => {
    // Wer in einer veröffentlichten Runde sass, hat gespielt — auch ohne
    // eigene Erfassung (dann zählt nur Participation). Nachgetragene Abende
    // haben keine Tische; dort steht in der Erfassung, welche Spiele es waren.
    const games = new Map<string, number[]>();
    for (const a of assignments) {
      if (a.table.round.eveningId !== evening.id) continue;
      games.set(a.playerId, [...(games.get(a.playerId) ?? []), a.table.round.number]);
    }
    for (const e of entries) {
      if (e.eveningId === evening.id && e.games.length > 0 && !games.has(e.playerId)) {
        games.set(e.playerId, e.games);
      }
    }

    return {
      round: evening.seasonRound!,
      date: evening.date,
      lastEvening: isLastEvening(evening.date),
      achievements: achievements
        .filter((a) => a.eveningId === evening.id)
        .map(toSheetAchievement),
      players: [...games].map(([playerId, played]) => {
        const entry = entries.find((e) => e.eveningId === evening.id && e.playerId === playerId);
        return {
          playerId,
          games: played,
          marks: marksToMap(entry?.marks ?? []),
          hasMarks: (entry?.marks.length ?? 0) > 0,
        };
      }),
      absent: entries
        .filter((e) => e.eveningId === evening.id && !games.has(e.playerId) && e.marks.length > 0)
        .map((e) => ({ playerId: e.playerId, marks: marksToMap(e.marks) })),
    };
  });
}

/**
 * Lädt alles für die Rangliste (siehe SPEC.md Abschnitt 13): die
 * Liga-Teilnehmenden, ihre importierten Abende und die gezählten Abende
 * aus der App.
 */
export async function loadRanking({ publicOnly = false } = {}) {
  const [players, imported, evenings, names] = await Promise.all([
    prisma.player.findMany({
      where: { leagueActive: true },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        colorIdentity: true,
        decklistUrl: true,
      },
    }),
    prisma.importedEveningScore.findMany({
      where: { player: { leagueActive: true } },
      select: { playerId: true, round: true, points: true },
    }),
    loadSeasonEvenings({ publicOnly }),
    loadPublicNames(),
  ]);

  const appEvenings: AppEvening[] = evenings.map((evening) => {
    const results = new Map<string, Breakdown>();
    for (const p of evening.players) {
      results.set(
        p.playerId,
        computeBreakdown(evening.achievements, p.marks, p.games, evening.lastEvening),
      );
    }
    // Abwesende bekommen nur Evergreen, ohne Abend in der Spalte.
    const seasonAchievements = evening.achievements.filter((a) => a.scope === "SEASON");
    const absentSeason = new Map<string, number>();
    for (const p of evening.absent) {
      const points = computeBreakdown(seasonAchievements, p.marks, [], evening.lastEvening).total;
      if (points > 0) absentSeason.set(p.playerId, points);
    }
    return { round: evening.round, date: evening.date, results, absentSeason };
  });

  return buildRanking(
    players.map((p) => ({
      id: p.id,
      // Öffentlich nur Vorname und Initial (siehe publicNames).
      name: names.get(p.id) ?? p.firstName,
      colorIdentity: p.colorIdentity,
      decklistUrl: p.decklistUrl,
    })),
    imported,
    appEvenings,
  );
}

/**
 * Punkte und besuchte Abende je Spieler für die Paarung von Runde 1 (siehe
 * SPEC.md Abschnitt 5.1) — aus derselben Rangliste wie `/rangliste`, also
 * aus den nachgetragenen Abenden und den Abenden der App. Gezählt wird nur,
 * was geschlossen ist; der laufende Abend selbst fliesst nicht ein («Stand
 * vor diesem Abend»).
 *
 * Bewusst die Summe aller Abende, nicht das Total mit Streichresultat: der
 * gedämpfte Schnitt (leagueRanking.ts) teilt durch die besuchten Abende.
 * Wer nicht (mehr) an der Liga teilnimmt, steht nicht in der Rangliste und
 * zählt mit 0 Punkten und 0 Abenden.
 */
export async function loadPairingStandings(
  playerIds: readonly string[],
): Promise<LeaguePlayerStanding[]> {
  const { rows } = await loadRanking();
  const byId = new Map(rows.map((r) => [r.id, r]));
  return playerIds.map((id) => {
    const played = byId.get(id)?.rounds.filter((c) => c.points !== null) ?? [];
    return {
      id,
      points: played.reduce((sum, c) => sum + (c.points ?? 0), 0),
      attendedEvenings: played.length,
    };
  });
}
