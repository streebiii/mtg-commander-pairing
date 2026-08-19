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
 */

export interface ParsedImportRow {
  importName: string;
  total: number;
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

  if (nameIdx === -1 || totalIdx === -1) {
    return {
      rows: [],
      warnings: [
        "Spalten 'Spieler' und/oder 'Total' wurden im Tabellenkopf nicht gefunden.",
      ],
    };
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

    rows.push({ importName, total });
  }

  return { rows, warnings };
}
