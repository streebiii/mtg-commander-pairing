import { shuffle } from "./shuffle";
import { PairingError } from "./errors";

export interface RankedPlayer {
  id: string;
  points: number;
}

/** Eindeutiger, ordnungsunabhängiger Schlüssel für ein Spielerpaar. */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

/** Baut alle Paar-Schlüssel innerhalb eines Tisches (jeder mit jedem). */
function tablePairKeys(table: string[]): string[] {
  const keys: string[] = [];
  for (let i = 0; i < table.length; i++) {
    for (let j = i + 1; j < table.length; j++) {
      keys.push(pairKey(table[i], table[j]));
    }
  }
  return keys;
}

function countRematches(table: string[], previousPairings: ReadonlySet<string>): number {
  let count = 0;
  for (const key of tablePairKeys(table)) {
    if (previousPairings.has(key)) count++;
  }
  return count;
}

/**
 * Weist Spieler den Tischen einer Modus-B-Runde zu.
 *
 * Vorgehen (siehe SPEC.md Abschnitt 5.1 und 5.2):
 * 1. Spieler nach Punkten absteigend sortieren; bei Punktegleichstand
 *    zufällige Reihenfolge.
 * 2. In aufeinanderfolgende Blöcke gemäß der übergebenen Tischgrößen
 *    einteilen (Rang-Gruppierung, analog Swiss-Pairing).
 * 3. Lokale Verbesserung: Spieler mit identischem Punktestand dürfen
 *    zwischen zwei Tischen getauscht werden, wenn das Wiederholungs-
 *    begegnungen (Rematches) aus vorherigen Runden desselben Abends
 *    reduziert, ohne die Tischgrößen-Verteilung zu verändern.
 *
 * @param players Anwesende Spieler mit ihrem aktuellen Punktestand.
 * @param tableSizes Tischgrößen gemäß computeTableSizes, Summe muss der
 *   Spieleranzahl entsprechen.
 * @param previousPairings Set von pairKey(a,b) für Spieler, die an diesem
 *   Abend in einer früheren Runde bereits am selben Tisch saßen.
 * @returns Array von Tischen (jeweils ein Array von Spieler-IDs), in der
 *   gleichen Reihenfolge wie tableSizes.
 */
export function assignLeagueRound(
  players: readonly RankedPlayer[],
  tableSizes: readonly number[],
  previousPairings: ReadonlySet<string> = new Set(),
): string[][] {
  const totalSeats = tableSizes.reduce((a, b) => a + b, 0);
  if (totalSeats !== players.length) {
    throw new PairingError(
      `Tischgrößen (Summe ${totalSeats}) passen nicht zur Spieleranzahl (${players.length})`,
    );
  }

  // Schritt 1: nach Punkten absteigend sortieren, Gleichstand zufällig.
  const sorted = shuffle(players).sort((a, b) => b.points - a.points);

  // Schritt 2: in Blöcke gemäß Tischgrößen einteilen (größte Tische zuerst,
  // für eine deterministische/lesbare Reihenfolge).
  const orderedSizes = [...tableSizes].sort((a, b) => b - a);
  const tables: string[][] = [];
  let cursor = 0;
  for (const size of orderedSizes) {
    tables.push(sorted.slice(cursor, cursor + size).map((p) => p.id));
    cursor += size;
  }

  // Schritt 3: lokale Verbesserung durch Tausch punktegleicher Spieler.
  if (previousPairings.size > 0) {
    improveRematches(tables, players, previousPairings);
  }

  return tables;
}

function improveRematches(
  tables: string[][],
  players: readonly RankedPlayer[],
  previousPairings: ReadonlySet<string>,
): void {
  const pointsById = new Map(players.map((p) => [p.id, p.points]));
  const MAX_PASSES = 20;

  for (let pass = 0; pass < MAX_PASSES; pass++) {
    let improved = false;

    for (let i = 0; i < tables.length && !improved; i++) {
      for (let j = i + 1; j < tables.length && !improved; j++) {
        const tableA = tables[i];
        const tableB = tables[j];

        for (let ai = 0; ai < tableA.length && !improved; ai++) {
          for (let bi = 0; bi < tableB.length && !improved; bi++) {
            const playerA = tableA[ai];
            const playerB = tableB[bi];

            // Nur tauschen, wenn beide denselben Punktestand haben — das
            // erhält die Rang-Gruppierung aus Schritt 2 unverändert.
            if (pointsById.get(playerA) !== pointsById.get(playerB)) continue;

            const before =
              countRematches(tableA, previousPairings) +
              countRematches(tableB, previousPairings);

            tableA[ai] = playerB;
            tableB[bi] = playerA;

            const after =
              countRematches(tableA, previousPairings) +
              countRematches(tableB, previousPairings);

            if (after < before) {
              improved = true; // Tausch behalten, nächste Passe starten.
            } else {
              // Tausch rückgängig machen.
              tableA[ai] = playerA;
              tableB[bi] = playerB;
            }
          }
        }
      }
    }

    if (!improved) break;
  }
}

export { pairKey, tablePairKeys, countRematches };
