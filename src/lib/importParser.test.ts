import { describe, expect, it } from "vitest";
import { parseLeagueImport } from "./importParser";

const SAMPLE = `
| #  | Spieler       | F   | Total | R1 | R2 | R3    | R4 | R5 | R6 |
|:--:|:--------------|:---:|:-----:|:--:|:--:|:-----:|:--:|:--:|:--:|
| 1  | Marc S.       | WR  | 50    | 14 | 18 | 18    | -  | -  | -  |
| 2  | Thomas S.     | RG  | 44    | 16 | 12 | 16    | -  | -  | -  |
| 3  | Tyrone        | WUR | 40    | 12 | 13 | 15    | -  | -  | -  |
| 4  | Rafael S.     | UBG | 39    | 12 | 12 | 15    | -  | -  | -  |
| 5  | Georg         | WUB | 36    | 13 | 12 | 11    | -  | -  | -  |
| 6  | Fabian        | UG  | 36    | 14 |  8 | 14    | -  | -  | -  |
`;

describe("parseLeagueImport", () => {
  it("extrahiert Spielername und Total-Punktestand für jede Zeile", () => {
    const { rows, warnings } = parseLeagueImport(SAMPLE);
    expect(warnings).toEqual([]);
    expect(rows).toEqual([
      { importName: "Marc S.", total: 50, attendedEvenings: 3 },
      { importName: "Thomas S.", total: 44, attendedEvenings: 3 },
      { importName: "Tyrone", total: 40, attendedEvenings: 3 },
      { importName: "Rafael S.", total: 39, attendedEvenings: 3 },
      { importName: "Georg", total: 36, attendedEvenings: 3 },
      { importName: "Fabian", total: 36, attendedEvenings: 3 },
    ]);
  });

  it("ignoriert die Trennzeile zwischen Header und Daten", () => {
    const { rows } = parseLeagueImport(SAMPLE);
    expect(rows.some((r) => r.importName.includes("-"))).toBe(false);
  });

  it("funktioniert unabhängig von der Spaltenreihenfolge, solange die Header stimmen", () => {
    const reordered = `
| Total | Spieler | R1 |
|:-----:|:--------|:--:|
| 50    | Marc S. | 14 |
`;
    const { rows } = parseLeagueImport(reordered);
    expect(rows).toEqual([
      { importName: "Marc S.", total: 50, attendedEvenings: 1 },
    ]);
  });

  it("meldet einen Fehler, wenn Spalten 'Spieler'/'Total' fehlen", () => {
    const { rows, warnings } = parseLeagueImport("| A | B |\n|---|---|\n| 1 | 2 |");
    expect(rows).toEqual([]);
    expect(warnings.length).toBeGreaterThan(0);
  });

  it("überspringt Zeilen mit nicht-numerischem Total und warnt", () => {
    const withBye = `
| Spieler | Total | R1 |
|:--------|:-----:|:--:|
| Marc S. | 50    | 14 |
| Pausiert | -    | -  |
`;
    const { rows, warnings } = parseLeagueImport(withBye);
    expect(rows).toEqual([
      { importName: "Marc S.", total: 50, attendedEvenings: 1 },
    ]);
    expect(warnings.length).toBe(1);
  });

  it("gibt leere rows zurück, wenn kein Pipe-Zeichen im Text vorkommt", () => {
    const { rows, warnings } = parseLeagueImport("kein tabellen text hier");
    expect(rows).toEqual([]);
    expect(warnings.length).toBe(1);
  });

  it("zaehlt nur Rundenspalten mit einer Zahl als besuchten Abend", () => {
    // Fehlende Abende stehen als Strich oder leer in der Tabelle.
    const teilweise = `
| Spieler | Total | R1 | R2 | R3 |
|:--------|:-----:|:--:|:--:|:--:|
| David   | 11    | —  | —  | 11 |
| Mario   | 21    | 11 | 10 |    |
| Marc S. | 50    | 14 | 18 | 18 |
`;
    const { rows } = parseLeagueImport(teilweise);
    expect(rows.map((r) => [r.importName, r.attendedEvenings])).toEqual([
      ["David", 1],
      ["Mario", 2],
      ["Marc S.", 3],
    ]);
  });

  it("warnt, wenn die Tabelle gar keine Rundenspalten hat", () => {
    const ohneRunden = `
| Spieler | Total |
|:--------|:-----:|
| Marc S. | 50    |
`;
    const { rows, warnings } = parseLeagueImport(ohneRunden);
    expect(rows).toEqual([
      { importName: "Marc S.", total: 50, attendedEvenings: 0 },
    ]);
    expect(warnings.some((w) => w.includes("Rundenspalten"))).toBe(true);
  });
});
