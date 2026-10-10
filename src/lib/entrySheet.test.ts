import { describe, expect, it } from "vitest";
import {
  type SheetAchievement,
  computeTotals,
  markKey,
  maxCount,
  validGame,
  visibleAchievements,
} from "./entrySheet";
import { eveningNumber, isLastEvening } from "./season";

function a(
  id: string,
  partial: Partial<SheetAchievement> = {},
): SheetAchievement {
  return {
    id,
    title: id,
    description: "",
    points: 1,
    category: "FIXED",
    scope: "MATCH",
    systemKey: null,
    sortOrder: 0,
    ...partial,
  };
}

const participation = a("participation", { systemKey: "participation" });
const winner = a("winner");
const pauper = a("pauper", { category: "DECKBUILDING", scope: "EVENING", points: 4 });
const evergreen = a("evergreen", { category: "DECKBUILDING", scope: "SEASON", points: 7 });
const classic = a("classic", { category: "ROTATING", scope: "PER_PLAYER" });
const smash = a("smash", { category: "ROTATING", points: 2 });

describe("computeTotals", () => {
  it("zählt Participation automatisch je gespieltem Spiel", () => {
    const t = computeTotals([participation], new Map(), [1, 2], false);
    expect(t).toEqual({ core: 2, deckbau: 0, rotate: 0, total: 2 });
  });

  it("summiert pro Spiel, pro Abend und mehrfach zählende nach Kategorie", () => {
    const marks = new Map([
      [markKey("winner", 1), 1],
      [markKey("pauper", 0), 1],
      [markKey("classic", 2), 3],
      [markKey("smash", 1), 1],
    ]);
    const t = computeTotals(
      [participation, winner, pauper, classic, smash],
      marks,
      [1, 2],
      false,
    );
    expect(t).toEqual({ core: 3, deckbau: 4, rotate: 5, total: 12 });
  });

  it("ignoriert Markierungen für nicht gespielte Spiele", () => {
    const marks = new Map([[markKey("winner", 2), 1]]);
    const t = computeTotals([participation, winner], marks, [1], false);
    expect(t.total).toBe(1);
  });

  it("zählt «1x am Ende der Liga» nur am letzten Abend", () => {
    const marks = new Map([[markKey("evergreen", 0), 1]]);
    expect(computeTotals([evergreen], marks, [1, 2], false).total).toBe(0);
    expect(computeTotals([evergreen], marks, [1, 2], true).total).toBe(7);
  });
});

describe("Regeln des Blatts", () => {
  it("blendet «1x am Ende der Liga» ausser am letzten Abend aus", () => {
    expect(visibleAchievements([pauper, evergreen], false)).toEqual([pauper]);
    expect(visibleAchievements([pauper, evergreen], true)).toHaveLength(2);
  });

  it("erlaubt pro Match nur gespielte Spiele, pro Abend nur Spiel 0", () => {
    expect(validGame("MATCH", 1, [1, 2])).toBe(true);
    expect(validGame("MATCH", 2, [1])).toBe(false);
    expect(validGame("MATCH", 0, [1])).toBe(false);
    expect(validGame("EVENING", 0, [1])).toBe(true);
    expect(validGame("MULTIPLE", 1, [1])).toBe(false);
  });

  it("lässt Anzahlen nur bei mehrfach zählenden zu", () => {
    expect(maxCount("MATCH")).toBe(1);
    expect(maxCount("PER_PLAYER")).toBeGreaterThan(1);
    expect(maxCount("MULTIPLE")).toBeGreaterThan(1);
  });
});

describe("eveningNumber", () => {
  it("ordnet Daten den Liga-Terminen 2026 zu", () => {
    expect(eveningNumber(new Date("2026-04-24T18:00:00+02:00"))).toBe(1);
    expect(eveningNumber(new Date("2026-10-16T19:30:00+02:00"))).toBe(5);
    // Kurz nach Mitternacht Schweizer Zeit zählt noch zum selben Abend.
    expect(eveningNumber(new Date("2026-10-16T23:30:00Z"))).toBe(5);
    expect(eveningNumber(new Date("2026-11-06T19:00:00+01:00"))).toBe(6);
  });

  it("erkennt den letzten Abend der Saison", () => {
    expect(isLastEvening(new Date("2026-10-16T19:00:00+02:00"))).toBe(false);
    expect(isLastEvening(new Date("2026-11-06T19:00:00+01:00"))).toBe(true);
  });
});
