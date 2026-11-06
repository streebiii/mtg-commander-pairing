import { describe, expect, it } from "vitest";
import { insertIntoTables } from "./insertPlayer";
import { computeTableSizes } from "./tableSizes";

/** Tische mit fortlaufenden IDs, z.B. [4, 3] → [["p1".."p4"], ["p5".."p7"]]. */
function tablesOf(sizes: number[]): string[][] {
  let n = 0;
  return sizes.map((size) => Array.from({ length: size }, () => `p${++n}`));
}

describe("insertIntoTables", () => {
  it("setzt den Neuen an den kleinsten Tisch, alle anderen bleiben sitzen", () => {
    const tables = tablesOf([4, 4, 3]);
    const result = insertIntoTables(tables, "neu")!;
    expect(result).toEqual([tables[0], tables[1], [...tables[2], "neu"]]);
  });

  it("nimmt bei gleich kleinen Tischen den vorderen", () => {
    const tables = tablesOf([3, 3, 3]);
    expect(insertIntoTables(tables, "neu")).toEqual([
      [...tables[0], "neu"],
      tables[1],
      tables[2],
    ]);
  });

  it("eröffnet einen neuen Tisch, wenn alle voll sind, und holt so wenige wie nötig", () => {
    const tables = tablesOf([4, 4, 4]);
    const result = insertIntoTables(tables, "neu", () => 0)!;
    expect(result.map((t) => t.length)).toEqual([4, 3, 3, 3]);
    expect(result[0]).toEqual(tables[0]);
    expect(result[3]).toContain("neu");
    // Genau zwei sind umgesetzt worden.
    const moved = result[3].filter((id) => id !== "neu");
    expect(moved).toHaveLength(2);
  });

  it("ergibt für jede Spielerzahl die übliche Verteilung, ohne Spieler zu verlieren", () => {
    for (let n = 3; n <= 40; n++) {
      const tables = tablesOf(computeTableSizes(n));
      const result = insertIntoTables(tables, "neu")!;
      expect(result, `N=${n}`).not.toBeNull();
      expect([...result.map((t) => t.length)].sort((a, b) => b - a)).toEqual(
        computeTableSizes(n + 1),
      );
      expect(result.flat().sort()).toEqual([...tables.flat(), "neu"].sort());
    }
  });

  it("füllt auch einen vorderen kleineren Tisch auf", () => {
    const tables = [["a", "b", "c"], ["d", "e", "f", "g"]];
    expect(insertIntoTables(tables, "neu")).toEqual([
      ["a", "b", "c", "neu"],
      ["d", "e", "f", "g"],
    ]);
  });
});
