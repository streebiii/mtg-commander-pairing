import { shuffle } from "./shuffle";
import { PairingError } from "./errors";

export interface ValuedEntity {
  id: string;
  value: number;
}

/**
 * Sortiert Einheiten absteigend nach `value` (mit etwas Zufalls-Rauschen)
 * und teilt sie in Blöcke gemäß der übergebenen Tischgrößen ein.
 *
 * Gemeinsamer Kern für zwei Gruppierungs-Varianten:
 * - Modus B: Rang nach Liga-Punktestand (siehe leagueAssignment.ts)
 * - Modus A "nach Skill balanciert": Rang nach Skill-Level (siehe
 *   skillAssignment.ts)
 *
 * @param entities Einheiten mit ihrem Sortier-Wert (Punkte, Skill, ...).
 * @param tableSizes Tischgrößen gemäß computeTableSizes, Summe muss der
 *   Anzahl Einheiten entsprechen.
 * @param jitterAmount Zufalls-Rauschen (± dieser Betrag) auf den Wert vor
 *   dem Sortieren, damit nicht immer exakt dieselbe Blockbildung entsteht.
 *   0 deaktiviert das Rauschen (rein deterministische Rang-Gruppierung).
 * @returns Array von Tischen (jeweils ein Array von IDs), in der gleichen
 *   Reihenfolge wie tableSizes (größte Tische zuerst).
 */
export function groupByValueWithJitter(
  entities: readonly ValuedEntity[],
  tableSizes: readonly number[],
  jitterAmount: number,
): string[][] {
  const totalSeats = tableSizes.reduce((a, b) => a + b, 0);
  if (totalSeats !== entities.length) {
    throw new PairingError(
      `Tischgrößen (Summe ${totalSeats}) passen nicht zur Anzahl (${entities.length})`,
    );
  }

  // shuffle() zuerst, damit exakte Gleichstände (identischer Jitter-Wert
  // kommt praktisch nie vor) trotzdem in zufälliger Reihenfolge bleiben.
  const jitterOf = new Map(
    entities.map((e) => [e.id, (Math.random() * 2 - 1) * jitterAmount]),
  );
  const sorted = shuffle(entities).sort(
    (a, b) => b.value + jitterOf.get(b.id)! - (a.value + jitterOf.get(a.id)!),
  );

  // Größte Tische zuerst, für eine deterministische/lesbare Reihenfolge.
  const orderedSizes = [...tableSizes].sort((a, b) => b - a);
  const tables: string[][] = [];
  let cursor = 0;
  for (const size of orderedSizes) {
    tables.push(sorted.slice(cursor, cursor + size).map((e) => e.id));
    cursor += size;
  }
  return tables;
}
