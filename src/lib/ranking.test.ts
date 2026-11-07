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

  it("streicht Evergreen nicht mit: es zählt neben den Abenden, R6 wird ohne verglichen", () => {
    // Anna: R6 nur 4 Punkte plus 7 Evergreen. Mit Evergreen wäre R6 (11)
    // besser als R1 (8) — gestrichen wird trotzdem R6, Evergreen bleibt.
    const evening6: AppEvening = {
      round: 6,
      date: new Date("2026-11-06T19:00:00+01:00"),
      results: new Map([
        [
          "anna",
          {
            total: 11,
            sections: [
              { label: "Match 1", total: 4, items: [{ title: "Participation", points: 4, count: 1 }] },
              {
                label: "Ganze Runde",
                total: 7,
                items: [{ title: "Evergreen", points: 7, count: 1, season: true }],
              },
            ],
          },
        ],
        ["ben", breakdown(9)],
      ]),
    };
    const ranking = buildRanking(
      players,
      scores({ anna: [8, 10, 10, 10, 10], ben: [9, 9, 9, 9, 9] }),
      [evening6],
    );
    const { anna, ben } = byId(ranking);
    expect(anna.rounds[5]).toMatchObject({ points: 4, struck: true });
    expect(anna.rounds[5].breakdown).toEqual({
      total: 4,
      sections: [{ label: "Match 1", total: 4, items: [{ title: "Participation", points: 4, count: 1 }] }],
    });
    expect(anna.rounds[0].struck).toBe(false);
    expect(anna).toMatchObject({ evergreen: 7, total: 48 + 7 });
    expect(ben).toMatchObject({ evergreen: 0, total: 45 });
    // Δ vergleicht mit dem Stand nach R5, dort gab es noch kein Evergreen.
    expect(anna.delta).toBe(0);
  });

  it("zählt Evergreen auch vor dem Streichen ins Total", () => {
    const ranking = buildRanking(players, [], [
      {
        round: 2,
        date: new Date("2026-05-22T19:00:00+02:00"),
        results: new Map([
          [
            "cara",
            {
              total: 9,
              sections: [
                {
                  label: "Ganze Runde",
                  total: 9,
                  items: [
                    { title: "Pauper", points: 2, count: 1 },
                    { title: "Evergreen", points: 7, count: 1, season: true },
                  ],
                },
              ],
            },
          ],
        ]),
      },
    ]);
    expect(byId(ranking).cara).toMatchObject({ total: 9, evergreen: 7 });
    expect(byId(ranking).cara.rounds[1].points).toBe(2);
  });

  it("zählt Evergreen auch für Abwesende, ohne Abend in der Spalte", () => {
    const ranking = buildRanking(
      players,
      scores({ anna: [10, 10, 10, 10, 10], ben: [9, 9, 9, 9, 9] }),
      [
        {
          round: 6,
          date: new Date("2026-11-06T19:00:00+01:00"),
          results: new Map([["ben", breakdown(9)]]),
          absentSeason: new Map([["anna", 7]]),
        },
      ],
    );
    const { anna } = byId(ranking);
    expect(anna.rounds[5]).toMatchObject({ points: null, source: null, struck: true });
    expect(anna).toMatchObject({ evergreen: 7, total: 50 + 7 });
  });
});
