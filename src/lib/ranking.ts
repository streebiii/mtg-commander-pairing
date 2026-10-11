import type { Breakdown } from "./entrySheet";
import { EVENINGS_PER_SEASON } from "./season";

// Reine Logik der Rangliste (siehe SPEC.md Abschnitt 13) — ohne
// Datenbankzugriff, damit sich Totals, Ränge, Streichresultat und Δ
// unabhängig testen lassen.

export interface RankingPlayer {
  id: string;
  name: string;
  colorIdentity: string | null;
}

/** Ein Abend aus der App mit den Ergebnissen aller, die dort gespielt haben. */
export interface AppEvening {
  round: number;
  date: Date;
  results: Map<string, Breakdown>;
}

export interface RoundCell {
  /** null = an diesem Abend nicht dabei gewesen. */
  points: number | null;
  /** Woher der Wert stammt; Details gibt es nur für Abende aus der App. */
  source: "app" | "import" | null;
  /** Das Streichresultat (kann auch ein verpasster Abend sein). */
  struck: boolean;
  breakdown?: Breakdown;
}

export interface RankingRow {
  id: string;
  name: string;
  colorIdentity: string | null;
  rank: number;
  /** Ränge gewonnen (positiv) oder verloren; "neu" beim ersten Abend; null = keine Angabe. */
  delta: number | "neu" | null;
  total: number;
  rounds: RoundCell[];
}

export interface Ranking {
  rows: RankingRow[];
  /** Höchste Spalte mit Punkten, null vor dem ersten Abend. */
  lastRound: number | null;
  /** Datum der Abende aus der App, je Spalte. */
  appDates: Map<number, Date>;
}

const ROUNDS = Array.from({ length: EVENINGS_PER_SEASON }, (_, i) => i + 1);

/**
 * Total eines Spielers über die gegebenen Spalten. Ist der letzte Abend
 * der Saison dabei, wird das schlechteste Resultat gestrichen — ein
 * verpasster Abend zählt dabei als 0 und ist damit das schlechteste. Bei
 * mehreren gleich schlechten trifft es den letzten.
 */
function totalOf(
  points: (number | null)[],
  rounds: readonly number[],
): { total: number; struckRound: number | null } {
  const total = rounds.reduce((s, r) => s + (points[r - 1] ?? 0), 0);
  if (!rounds.includes(EVENINGS_PER_SEASON)) return { total, struckRound: null };

  let worst = ROUNDS[0];
  for (const r of ROUNDS) {
    if ((points[r - 1] ?? 0) <= (points[worst - 1] ?? 0)) worst = r;
  }
  const allRounds = ROUNDS.reduce((s, r) => s + (points[r - 1] ?? 0), 0);
  return { total: allRounds - (points[worst - 1] ?? 0), struckRound: worst };
}

/**
 * Ränge nach Total: gleiches Total heisst gleicher Rang (1, 2, 2, 4),
 * innerhalb eines Rangs alphabetisch.
 */
function rankBy<T extends { name: string; total: number }>(entries: T[]): (T & { rank: number })[] {
  const sorted = [...entries].sort(
    (a, b) => b.total - a.total || a.name.localeCompare(b.name, "de-CH"),
  );
  let rank = 0;
  return sorted.map((e, i) => {
    if (i === 0 || e.total !== sorted[i - 1].total) rank = i + 1;
    return { ...e, rank };
  });
}

/**
 * Baut die Rangliste aus den importierten Abenden (vor der App) und den
 * Abenden aus der App. Gibt es für eine Spalte einen Abend aus der App,
 * gilt er für alle — auch für wen der Import dort Punkte hätte.
 */
export function buildRanking(
  players: readonly RankingPlayer[],
  imported: readonly { playerId: string; round: number; points: number }[],
  appEvenings: readonly AppEvening[],
): Ranking {
  const appByRound = new Map(appEvenings.map((e) => [e.round, e]));
  const importedByPlayer = new Map<string, Map<number, number>>();
  for (const s of imported) {
    const map = importedByPlayer.get(s.playerId) ?? new Map<number, number>();
    map.set(s.round, s.points);
    importedByPlayer.set(s.playerId, map);
  }

  const cells = new Map<string, RoundCell[]>(
    players.map((p) => [
      p.id,
      ROUNDS.map((round): RoundCell => {
        const app = appByRound.get(round);
        if (app) {
          const breakdown = app.results.get(p.id);
          return breakdown
            ? { points: breakdown.total, source: "app", struck: false, breakdown }
            : { points: null, source: null, struck: false };
        }
        const points = importedByPlayer.get(p.id)?.get(round);
        return points === undefined
          ? { points: null, source: null, struck: false }
          : { points, source: "import", struck: false };
      }),
    ]),
  );

  // Spalten, die schon gespielt sind: ein Abend aus der App oder
  // irgendein importierter Wert.
  const playedRounds = ROUNDS.filter(
    (r) =>
      appByRound.has(r) ||
      players.some((p) => cells.get(p.id)![r - 1].points !== null),
  );
  const lastRound = playedRounds.at(-1) ?? null;

  const standings = (rounds: readonly number[]) =>
    rankBy(
      players.map((p) => {
        const points = cells.get(p.id)!.map((c) => c.points);
        return { id: p.id, name: p.name, ...totalOf(points, rounds) };
      }),
    );

  const current = standings(playedRounds);
  const earlierRounds = playedRounds.filter((r) => r !== lastRound);
  const previousRank =
    earlierRounds.length > 0
      ? new Map(standings(earlierRounds).map((s) => [s.id, s.rank]))
      : null;

  const playerById = new Map(players.map((p) => [p.id, p]));
  const rows = current.map((s): RankingRow => {
    const playerCells = cells.get(s.id)!.map((c, i) =>
      i + 1 === s.struckRound ? { ...c, struck: true } : c,
    );
    const hadEarlier = earlierRounds.some((r) => playerCells[r - 1].points !== null);
    const playedLast = lastRound !== null && playerCells[lastRound - 1].points !== null;

    let delta: RankingRow["delta"] = null;
    if (previousRank) {
      delta = !hadEarlier && playedLast ? "neu" : previousRank.get(s.id)! - s.rank;
    }

    return {
      id: s.id,
      name: s.name,
      colorIdentity: playerById.get(s.id)!.colorIdentity,
      rank: s.rank,
      delta,
      total: s.total,
      rounds: playerCells,
    };
  });

  return {
    rows,
    lastRound,
    appDates: new Map(appEvenings.map((e) => [e.round, e.date])),
  };
}
