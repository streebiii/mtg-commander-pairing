import { describe, expect, it } from "vitest";
import type { Breakdown } from "./entrySheet";
import { buildRanking, type AppEvening, type RankingPlayer } from "./ranking";

const players: RankingPlayer[] = [
  { id: "anna", name: "Anna", colorIdentity: "WR" },
  { id: "ben", name: "Ben", colorIdentity: null },
  { id: "cara", name: "Cara", colorIdentity: "G" },
];

function scores(table: Record<string, (number | null)[]>) {
  return Object.entries(table).flatMap(([playerId, values]) =>
    values.flatMap((points, i) => (points === null ? [] : [{ playerId, round: i + 1, points }])),
  );
}

function breakdown(total: number): Breakdown {
  return { total, sections: [{ label: "Spiel 1", total, items: [] }] };
}

function appEvening(round: number, results: Record<string, number>): AppEvening {
  return {
    round,
    date: new Date("2026-10-16T19:00:00+02:00"),
    results: new Map(Object.entries(results).map(([id, t]) => [id, breakdown(t)])),
  };
}

const byId = (ranking: ReturnType<typeof buildRanking>) =>
  Object.fromEntries(ranking.rows.map((r) => [r.id, r]));

describe("buildRanking", () => {
  it("summiert die Abende und vergibt bei Gleichstand denselben Rang", () => {
    const ranking = buildRanking(
      players,
      scores({ anna: [10, 5], ben: [8, 7], cara: [3, null] }),
      [],
    );
    expect(ranking.rows.map((r) => [r.name, r.rank, r.total])).toEqual([
      ["Anna", 1, 15],
      ["Ben", 1, 15],
      ["Cara", 3, 3],
    ]);
    expect(ranking.lastRound).toBe(2);
  });

  it("zeigt Liga-Teilnehmende ohne Abend mit Total 0", () => {
    const ranking = buildRanking(players, scores({ anna: [10] }), []);
    expect(byId(ranking).cara).toMatchObject({ total: 0, rank: 2 });
    expect(byId(ranking).cara.rounds[0]).toMatchObject({ points: null, source: null });
  });

  it("nimmt für eine Spalte mit einem App-Abend dessen Werte, auch vor dem Import", () => {
    const ranking = buildRanking(
      players,
      scores({ anna: [10, 9], ben: [8, 4] }),
      [appEvening(2, { anna: 12 })],
    );
    const { anna, ben } = byId(ranking);
    expect(anna.rounds[1]).toMatchObject({ points: 12, source: "app" });
    expect(anna.rounds[1].breakdown?.total).toBe(12);
    // Ben war am App-Abend nicht dabei: der importierte Wert gilt nicht.
    expect(ben.rounds[1]).toMatchObject({ points: null, source: null });
    expect(ben.total).toBe(8);
  });

  it("streicht nach Abend 6 das schlechteste Resultat, einen verpassten Abend zuerst", () => {
    const ranking = buildRanking(
      players,
      scores({
        anna: [10, 8, null, 12, 9, 11],
        ben: [5, 7, 5, 9, 6, 8],
      }),
      [],
    );
    const { anna, ben } = byId(ranking);
    expect(anna.total).toBe(50);
    expect(anna.rounds.map((c) => c.struck)).toEqual([false, false, true, false, false, false]);
    // Zwei gleich schlechte (R1 und R3): gestrichen wird der letzte.
    expect(ben.total).toBe(35);
    expect(ben.rounds[2].struck).toBe(true);
    expect(ben.rounds[0].struck).toBe(false);
  });

  it("streicht vor Abend 6 nichts", () => {
    const ranking = buildRanking(players, scores({ anna: [10, null, 3] }), []);
    expect(byId(ranking).anna.total).toBe(13);
    expect(byId(ranking).anna.rounds.some((c) => c.struck)).toBe(false);
  });

  it("berechnet Δ gegenüber dem Stand vor dem letzten Abend und markiert Neue", () => {
    const ranking = buildRanking(
      players,
      scores({ anna: [10, 1], ben: [8, 9] }),
      [appEvening(3, { cara: 30, anna: 1 })],
    );
    const { anna, ben, cara } = byId(ranking);
    // Vorher: Ben 17 (1.), Anna 11 (2.), Cara 0 (3.).
    // Nachher: Cara 30 (1.), Ben 17 (2.), Anna 12 (3.).
    expect(ben).toMatchObject({ rank: 2, delta: -1 });
    expect(anna).toMatchObject({ rank: 3, delta: -1 });
    expect(cara).toMatchObject({ rank: 1, delta: "neu" });
  });

  it("zeigt kein Δ, solange es erst einen Abend gibt", () => {
    const ranking = buildRanking(players, scores({ anna: [10] }), []);
    expect(ranking.rows.every((r) => r.delta === null)).toBe(true);
  });

  it("vergleicht nach Abend 6 mit dem Stand nach Abend 5 ohne Streichresultat", () => {
    const ranking = buildRanking(
      players,
      scores({
        anna: [10, 10, 10, 10, 10, 0],
        ben: [9, 9, 9, 9, 9, 9],
      }),
      [],
    );
    const { anna, ben } = byId(ranking);
    // Vorher 50 zu 45, nachher 50 (0 gestrichen) zu 45 (9 gestrichen).
    expect(anna).toMatchObject({ total: 50, rank: 1, delta: 0 });
    expect(ben).toMatchObject({ total: 45, rank: 2, delta: 0 });
  });
});
