import { describe, expect, it } from "vitest";
import { computeTableSizes } from "./tableSizes";
import { PairingError } from "./errors";

describe("computeTableSizes", () => {
  // Tabelle aus SPEC.md Abschnitt 3
  const expected: Record<number, number[]> = {
    3: [3],
    4: [4],
    5: [5],
    6: [3, 3],
    7: [4, 3],
    8: [4, 4],
    9: [3, 3, 3],
    10: [4, 3, 3],
    11: [4, 4, 3],
    12: [4, 4, 4],
    13: [4, 3, 3, 3],
    14: [4, 4, 3, 3],
  };

  for (const [n, tables] of Object.entries(expected)) {
    it(`verteilt N=${n} als ${JSON.stringify(tables)}`, () => {
      expect(computeTableSizes(Number(n))).toEqual(tables);
    });
  }

  it("verwendet nie mehr als einen 5er-Tisch-Fall (nur N=5)", () => {
    for (let n = 6; n <= 60; n++) {
      const tables = computeTableSizes(n);
      expect(tables).not.toContain(5);
    }
  });

  it("jede Verteilung summiert sich exakt auf N", () => {
    for (let n = 3; n <= 60; n++) {
      const tables = computeTableSizes(n);
      expect(tables.reduce((a, b) => a + b, 0)).toBe(n);
    }
  });

  it("jede Tischgröße ist 3, 4 oder 5", () => {
    for (let n = 3; n <= 60; n++) {
      const tables = computeTableSizes(n);
      for (const size of tables) {
        expect([3, 4, 5]).toContain(size);
      }
    }
  });

  it("maximiert die Anzahl 4er-Tische innerhalb reiner 3/4-Lösungen", () => {
    // N=20 liesse sich als 5x4 oder z.B. 4x4+... prüfen wir explizit:
    expect(computeTableSizes(20)).toEqual([4, 4, 4, 4, 4]);
    // N=15: 5x3 wäre möglich, aber 3x4+1x3 hat mehr 4er (max fours = 3)
    expect(computeTableSizes(15)).toEqual([4, 4, 4, 3]);
  });

  it("wirft einen PairingError bei weniger als 3 Spielern", () => {
    expect(() => computeTableSizes(0)).toThrow(PairingError);
    expect(() => computeTableSizes(1)).toThrow(PairingError);
    expect(() => computeTableSizes(2)).toThrow(PairingError);
    expect(() => computeTableSizes(-1)).toThrow(PairingError);
  });

  it("wirft einen PairingError bei nicht-ganzzahliger Eingabe", () => {
    expect(() => computeTableSizes(4.5)).toThrow(PairingError);
  });
});
