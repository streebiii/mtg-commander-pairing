import { shuffle } from "./shuffle";
import { PairingError } from "./errors";

/**
 * Weist Spieler zufällig den Tischen einer Modus-A-Runde (Casual) zu.
 * Keine Rangliste, keine Rematch-Vermeidung, keine Mehrrunden-Logik
 * (siehe SPEC.md Abschnitt 4).
 *
 * @param playerIds IDs der anwesenden Spieler.
 * @param tableSizes Tischgrößen gemäß computeTableSizes.
 * @returns Array von Tischen (jeweils ein Array von Spieler-IDs).
 */
export function assignCasualRound(
  playerIds: readonly string[],
  tableSizes: readonly number[],
): string[][] {
  const totalSeats = tableSizes.reduce((a, b) => a + b, 0);
  if (totalSeats !== playerIds.length) {
    throw new PairingError(
      `Tischgrößen (Summe ${totalSeats}) passen nicht zur Spieleranzahl (${playerIds.length})`,
    );
  }

  const shuffled = shuffle(playerIds);
  const orderedSizes = [...tableSizes].sort((a, b) => b - a);

  const tables: string[][] = [];
  let cursor = 0;
  for (const size of orderedSizes) {
    tables.push(shuffled.slice(cursor, cursor + size));
    cursor += size;
  }
  return tables;
}
