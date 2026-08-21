import { describe, expect, it } from "vitest";
import { assignCasualRound } from "./casualAssignment";
import { computeTableSizes } from "./tableSizes";
import { PairingError } from "./errors";
import type { PlayerGroup } from "./groups";

describe("assignCasualRound", () => {
  it("verteilt alle Spieler genau einmal auf die berechneten Tischgrößen", () => {
    const playerIds = Array.from({ length: 11 }, (_, i) => `p${i}`);
    const sizes = computeTableSizes(playerIds.length);
    const tables = assignCasualRound(playerIds, sizes);

    expect(tables.map((t) => t.length).sort()).toEqual([...sizes].sort());
    const all = tables.flat();
    expect(new Set(all)).toEqual(new Set(playerIds));
    expect(all.length).toBe(playerIds.length);
  });

  it("wirft PairingError bei nicht passender Summe", () => {
    expect(() => assignCasualRound(["a", "b", "c"], [4])).toThrow(
      PairingError,
    );
  });

  it("hält eine Gruppe zu 2 immer am selben Tisch zusammen", () => {
    const playerIds = Array.from({ length: 7 }, (_, i) => `p${i}`); // -> [4,3]
    const groups: PlayerGroup[] = [{ id: "g1", playerIds: ["p0", "p1"] }];
    const sizes = computeTableSizes(playerIds.length);

    for (let i = 0; i < 30; i++) {
      const tables = assignCasualRound(playerIds, sizes, groups);
      const tableWithP0 = tables.find((t) => t.includes("p0"))!;
      expect(tableWithP0).toContain("p1");
    }
  });

  it("hält eine Gruppe zu 4 zusammen und respektiert die Tischgrößen", () => {
    const playerIds = Array.from({ length: 11 }, (_, i) => `p${i}`); // -> [4,4,3]
    const groups: PlayerGroup[] = [
      { id: "g1", playerIds: ["p0", "p1", "p2", "p3"] },
    ];
    const sizes = computeTableSizes(playerIds.length);
    const tables = assignCasualRound(playerIds, sizes, groups);

    const tableWithGroup = tables.find((t) => t.includes("p0"))!;
    expect(new Set(tableWithGroup)).toEqual(new Set(["p0", "p1", "p2", "p3"]));
    expect(tables.map((t) => t.length).sort()).toEqual([...sizes].sort());
  });

  it("erlaubt zwei Zweier-Gruppen am selben 4er-Tisch (N=8)", () => {
    const playerIds = Array.from({ length: 8 }, (_, i) => `p${i}`); // -> [4,4]
    const groups: PlayerGroup[] = [
      { id: "a", playerIds: ["p0", "p1"] },
      { id: "b", playerIds: ["p2", "p3"] },
      { id: "c", playerIds: ["p4", "p5"] },
      { id: "d", playerIds: ["p6", "p7"] },
    ];
    const sizes = computeTableSizes(playerIds.length);
    const tables = assignCasualRound(playerIds, sizes, groups);

    expect(tables.map((t) => t.length).sort()).toEqual([4, 4]);
    for (const [a, b] of [
      ["p0", "p1"],
      ["p2", "p3"],
      ["p4", "p5"],
      ["p6", "p7"],
    ]) {
      const table = tables.find((t) => t.includes(a))!;
      expect(table).toContain(b);
    }
  });

  it("wirft PairingError, wenn eine Gruppe nicht in die Tischgrößen passt", () => {
    const playerIds = Array.from({ length: 6 }, (_, i) => `p${i}`); // -> [3,3]
    const groups: PlayerGroup[] = [
      { id: "g1", playerIds: ["p0", "p1", "p2", "p3"] },
    ];
    const sizes = computeTableSizes(playerIds.length);
    expect(() => assignCasualRound(playerIds, sizes, groups)).toThrow(
      PairingError,
    );
  });
});
