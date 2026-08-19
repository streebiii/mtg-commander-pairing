import { groupByValueWithJitter } from "./rankGrouping";

export interface RankedPlayer {
  id: string;
  points: number;
}

/**
 * Zufalls-Rauschen (in Punkten) für die Rang-Sortierung vor dem Pairing.
 *
 * Ohne dieses Rauschen würden bei stabilen Punkteständen über mehrere
 * Abende hinweg praktisch immer dieselben Spieler an denselben Tischen
 * landen (strikt Rang 1-4, 5-8, ...). Das Rauschen lässt benachbarte
 * Ränge gelegentlich die Plätze tauschen, sodass sich die Zusammen-
 * setzung von Abend zu Abend variiert — Spieler mit großem Punkte-
 * abstand (mehr als dieser Wert) werden dabei nie gemischt.
 */
export const RANK_JITTER_POINTS = 3;

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
 * 1. Spieler nach Punkten absteigend sortieren, mit etwas Zufalls-Rauschen
 *    (RANK_JITTER_POINTS), damit nicht immer exakt dieselben Spieler in
 *    denselben Rang-Blöcken landen; bei Punktegleichstand zufällige
 *    Reihenfolge.
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
 * @param rankJitterPoints Override für RANK_JITTER_POINTS (v.a. für Tests
 *   nützlich, um das Rauschen gezielt an- oder auszuschalten).
 * @returns Array von Tischen (jeweils ein Array von Spieler-IDs), in der
 *   gleichen Reihenfolge wie tableSizes.
 */
export function assignLeagueRound(
  players: readonly RankedPlayer[],
  tableSizes: readonly number[],
  previousPairings: ReadonlySet<string> = new Set(),
  rankJitterPoints: number = RANK_JITTER_POINTS,
): string[][] {
  // Schritt 1+2: nach Punkten (+ Zufalls-Rauschen) absteigend sortieren und
  // in Blöcke gemäß Tischgrößen einteilen (gemeinsamer Kern, siehe
  // rankGrouping.ts — derselbe Mechanismus wie beim skill-balancierten
  // Modus A, nur mit Punkten statt Skill als Sortier-Wert).
  const tables = groupByValueWithJitter(
    players.map((p) => ({ id: p.id, value: p.points })),
    tableSizes,
    rankJitterPoints,
  );

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
