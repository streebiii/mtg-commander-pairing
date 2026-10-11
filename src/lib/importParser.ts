/**
 * Parser für die per Copy-Paste eingefügte Liga-Rangliste (Markdown-
 * ähnliche Pipe-Tabelle, siehe Beispiel aus der Community-Anfrage):
 *
 * | #  | Spieler       | F   | Total | R1 | R2 | R3 | ... |
 * |:--:|:--------------|:---:|:-----:|:--:|:--:|:--:|
 * | 1  | Marc S.       | WR  | 50    | 14 | 18 | 18 |
 *
 * Die Spalten "Spieler" und "Total" werden anhand des Spaltenkopfs erkannt
 * (nicht anhand der Position), damit variierende Rundenanzahlen (R1..R6)
 * keine Rolle spielen.
 *
 * Aus den Rundenspalten (R1, R2, ...) kommen die Punkte pro Abend für die
 * Rangliste (SPEC.md Abschnitt 13) und die Zahl der besuchten Abende für
 * die Paarung, die nach Punkten **pro Abend** sortiert statt nach der
 * Gesamtsumme (Abschnitt 5.1). Die Spalte F liefert die Farbidentität.
 */

import { normalizeColorIdentity } from "./colorIdentity";

export interface ParsedImportRow {
  importName: string;
  total: number;
  /** Anzahl Rundenspalten mit einer Zahl — also besuchte Liga-Abende. */
  attendedEvenings: number;
  /** Punkte je besuchtem Abend; ein Strich oder eine leere Zelle fehlt hier. */
  roundPoints: { round: number; points: number }[];
  /**
   * Farbidentität aus der Spalte F. undefined, wenn die Tabelle keine
   * Spalte F hat — dann bleibt die gespeicherte unangetastet.
   */
  colorIdentity?: string | null;
}

export interface ParseResult {
  rows: ParsedImportRow[];
  warnings: string[];
}

function splitTableRow(line: string): string[] {
  let trimmed = line.trim();
  if (trimmed.startsWith("|")) trimmed = trimmed.slice(1);
  if (trimmed.endsWith("|")) trimmed = trimmed.slice(0, -1);
  return trimmed.split("|").map((cell) => cell.trim());
}

function isSeparatorRow(cells: string[]): boolean {
  return cells.every((cell) => /^:?-+:?$/.test(cell) || cell === "");
}

export function parseLeagueImport(text: string): ParseResult {
  const warnings: string[] = [];
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.includes("|"));

  if (lines.length === 0) {
    return { rows: [], warnings: ["Kein Tabellen-Inhalt gefunden (keine Zeile mit '|')."] };
  }

  const headerCells = splitTableRow(lines[0]).map((c) => c.toLowerCase());
  const nameIdx = headerCells.findIndex((c) => c.includes("spieler"));
  const totalIdx = headerCells.findIndex((c) => c.includes("total"));
  const colorIdx = headerCells.findIndex((c) => c === "f");
  // Rundenspalten heissen R1, R2, ... — Leerzeichen und Grossschreibung egal.
  const roundCols = headerCells
    .map((c, i) => ({ match: /^r\s*(\d+)$/.exec(c), i }))
    .filter(({ match }) => match !== null)
    .map(({ match, i }) => ({ round: Number(match![1]), idx: i }));

  if (nameIdx === -1 || totalIdx === -1) {
    return {
      rows: [],
      warnings: [
        "Spalten 'Spieler' und/oder 'Total' wurden im Tabellenkopf nicht gefunden.",
      ],
    };
  }

  if (roundCols.length === 0) {
    warnings.push(
      "Keine Rundenspalten (R1, R2, ...) gefunden — die Paarung sortiert dann " +
        "nach Gesamtpunkten statt nach Punkten pro Abend.",
    );
  }

  const rows: ParsedImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cells = splitTableRow(lines[i]);
    if (isSeparatorRow(cells)) continue;

    const importName = cells[nameIdx]?.trim();
    const totalRaw = cells[totalIdx]?.trim();

    if (!importName) {
      warnings.push(`Zeile ${i + 1}: kein Spielername gefunden, übersprungen.`);
      continue;
    }
    const total = Number.parseInt(totalRaw ?? "", 10);
    if (!Number.isFinite(total)) {
      warnings.push(
        `Zeile ${i + 1} (${importName}): Punktestand "${totalRaw}" ist keine Zahl, übersprungen.`,
      );
      continue;
    }

    // Ein Abend zählt als besucht, sobald in seiner Spalte eine Zahl steht.
    // Leere Zellen und Platzhalter wie "—" bedeuten: nicht dabei gewesen.
    const roundPoints = roundCols.flatMap(({ round, idx }) => {
      const points = Number.parseInt(cells[idx]?.trim() ?? "", 10);
      return Number.isFinite(points) ? [{ round, points }] : [];
    });

    rows.push({
      importName,
      total,
      attendedEvenings: roundPoints.length,
      roundPoints,
      ...(colorIdx === -1
        ? {}
        : { colorIdentity: normalizeColorIdentity(cells[colorIdx]) }),
    });
  }

  return { rows, warnings };
}
