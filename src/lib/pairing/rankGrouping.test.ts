import { describe, expect, it } from "vitest";
import { groupByValueWithJitter } from "./rankGrouping";
import { PairingError } from "./errors";

describe("groupByValueWithJitter", () => {
  it("teilt alle Einheiten korrekt auf die Tischgrößen auf", () => {
    const entities = [
      { id: "a", value: 10 },
      { id: "b", value: 9 },
      { id: "c", value: 8 },
      { id: "d", value: 7 },
      { id: "e", value: 6 },
      { id: "f", value: 5 },
      { id: "g", value: 4 },
    ];
    const tables = groupByValueWithJitter(entities, [4, 3], 0);
    expect(tables.map((t) => t.length).sort()).toEqual([3, 4]);
    expect(new Set(tables.flat()).size).toBe(7);
  });

  it("gruppiert ohne Jitter (0) deterministisch nach Rang", () => {
    const entities = [
      { id: "a", value: 100 },
      { id: "b", value: 90 },
      { id: "c", value: 80 },
      { id: "d", value: 70 },
    ];
    const tables = groupByValueWithJitter(entities, [4], 0);
    expect(tables).toEqual([["a", "b", "c", "d"]]);
  });

  it("wirft PairingError bei nicht passender Größen-Summe", () => {
    const entities = [{ id: "a", value: 1 }];
    expect(() => groupByValueWithJitter(entities, [4], 0)).toThrow(
      PairingError,
    );
  });
});
