import { describe, expect, it } from "vitest";
import { assignCasualRound } from "./casualAssignment";
import { computeTableSizes } from "./tableSizes";
import { PairingError } from "./errors";

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
});
