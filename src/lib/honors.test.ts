import { describe, expect, it } from "vitest";
import type { SheetAchievement } from "./entrySheet";
import { computeHonors, type HonorsEvening, type HonorsPlayer } from "./honors";

const players: HonorsPlayer[] = [
  { id: "anna", name: "Anna" },
  { id: "ben", name: "Ben" },
  { id: "cara", name: "Cara" },
];

function achievement(
  id: string,
  title: string,
  extra: Partial<SheetAchievement> = {},
): SheetAchievement {
  return {
    id,
    title,
    description: "",
    points: 1,
    category: "FIXED",
    scope: "MATCH",
    systemKey: null,
    sortOrder: 0,
    ...extra,
  };
}

const sheet: SheetAchievement[] = [
  achievement("part", "Participation", { systemKey: "participation" }),
  achievement("win", "Winner winner – chicken dinner", { systemKey: "winner" }),
  achievement("first", "I’ve seen this movie"),
  achievement("hard", "Hardcore Mode"),
  achievement("nosol", "No Sol Ring", { category: "DECKBUILDING", scope: "EVENING" }),
  achievement("flush", "Flush", { category: "ROTATING" }),
];

/** Markierungen als «Achievement:Spiel» → Anzahl. */
function evening(
  round: number,
  entries: Record<string, { games?: number[]; marks?: Record<string, number> }>,
): HonorsEvening {
  return {
    round,
    lastEvening: false,
    achievements: sheet,
    players: Object.entries(entries).map(([playerId, e]) => ({
      playerId,
      games: e.games ?? [1, 2],
      marks: new Map(Object.entries(e.marks ?? {})),
      hasMarks: Object.keys(e.marks ?? {}).length > 0,
    })),
  };
}

const honor = (result: ReturnType<typeof computeHonors>, id: string) =>
  result.honors.find((h) => h.id === id)!;
const names = (entries: { name: string }[]) => entries.map((e) => e.name);

describe("computeHonors", () => {
  it("zählt über alle Runden und ehrt bei Gleichstand alle", () => {
    const result = computeHonors(players, [
      evening(1, {
        anna: { marks: { "first:1": 1, "first:2": 1 } },
        ben: { marks: { "first:1": 1 } },
      }),
      evening(2, { ben: { marks: { "first:2": 1 } }, cara: { marks: { "first:1": 1 } } }),
    ]);
    const firstOut = honor(result, "zuerst-raus");
    expect(names(firstOut.winners)).toEqual(["Anna", "Ben"]);
    expect(firstOut.winners[0].label).toBe("2-mal");
    expect(names(firstOut.runnersUp)).toEqual(["Cara"]);
    expect(result.rounds).toEqual([1, 2]);
  });

  it("ehrt niemanden, solange niemand das Achievement hat", () => {
    const result = computeHonors(players, [evening(1, { anna: { marks: { "flush:1": 1 } } })]);
    expect(honor(result, "hardcore").winners).toEqual([]);
  });

  it("ignoriert Markierungen für ein nicht gespieltes Match", () => {
    const result = computeHonors(players, [
      evening(1, { anna: { games: [1], marks: { "hard:1": 1, "hard:2": 1 } } }),
    ]);
    expect(honor(result, "hardcore").winners[0].value).toBe(1);
  });

  it("Herr des Rings: nie «No Sol Ring», Runden ohne eigene Erfassung zählen nicht", () => {
    const result = computeHonors(players, [
      evening(1, {
        anna: { marks: { "flush:1": 1 } },
        ben: { marks: { "nosol:0": 1 } },
        cara: {},
      }),
      evening(2, { anna: { marks: { "first:1": 1 } }, ben: { marks: { "flush:2": 1 } } }),
    ]);
    const solRing = honor(result, "sol-ring");
    expect(names(solRing.winners)).toEqual(["Anna"]);
    expect(solRing.winners[0].label).toBe("2 Runden");
  });

  it("Immer dabei: wer jedes Match gespielt hat", () => {
    const result = computeHonors(players, [
      evening(1, { anna: {}, ben: { games: [1] } }),
      evening(2, { anna: {}, ben: {} }),
    ]);
    expect(names(honor(result, "immer-dabei").winners)).toEqual(["Anna"]);
  });

  it("Siege folgen dem Sieger-Achievement, die Sternstunde nennt die Runde", () => {
    const result = computeHonors(players, [
      evening(1, { anna: { marks: { "win:1": 1 } }, ben: { marks: { "win:2": 1, "flush:2": 1 } } }),
      evening(3, { anna: { marks: { "win:1": 1, "win:2": 1, "flush:1": 1 } } }),
    ]);
    expect(honor(result, "chicken-dinner").winners).toMatchObject([
      { name: "Anna", value: 3, label: "3 Siege" },
    ]);
    // R3: 2 Teilnahmen + 2 Siege + Flush = 5 Punkte.
    expect(honor(result, "sternstunde").winners[0].label).toBe("5 Punkte in R3");
  });

  it("Einzigartig: Achievements, die nur eine Person erreicht hat", () => {
    const result = computeHonors(players, [
      evening(1, {
        anna: { marks: { "flush:1": 1, "first:1": 1 } },
        ben: { marks: { "first:2": 1 } },
      }),
    ]);
    expect(honor(result, "einzigartig").winners).toMatchObject([
      { name: "Anna", label: "Flush" },
    ]);
  });

  it("lässt Spieler ausserhalb der Liga weg", () => {
    const result = computeHonors(players, [
      evening(1, { dora: { marks: { "hard:1": 1 } }, anna: { marks: { "flush:1": 1 } } }),
    ]);
    expect(honor(result, "hardcore").winners).toEqual([]);
    expect(result.facts[0]).toEqual({ value: 1, label: "Spielerinnen und Spieler" });
  });
});
