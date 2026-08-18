import { PairingError } from "./errors";

/**
 * Berechnet die Tischgrößen-Verteilung für N anwesende Spieler.
 *
 * Regeln (siehe SPEC.md Abschnitt 3):
 * - Gültige Tischgrößen sind 3, 4, 5.
 * - 5er-Tische sind der absolute Ausnahmefall: sie werden nur verwendet,
 *   wenn eine Aufteilung ausschließlich mit 3er-/4er-Tischen unmöglich ist.
 *   Da 3 und 4 teilerfremd sind (Frobenius-Zahl = 3*4-3-4 = 5), ist das
 *   rechnerisch nur bei genau N = 5 der Fall.
 * - Innerhalb der reinen 3er/4er-Lösungen wird die Anzahl der 4er-Tische
 *   maximiert (das minimiert automatisch auch die Gesamtzahl der Tische).
 *
 * @param n Anzahl anwesender Spieler (muss >= 3 sein).
 * @returns Array der Tischgrößen, z.B. [4, 4, 3] für N=11.
 * @throws {PairingError} wenn n keine gültige Spielerzahl ist (< 3) oder
 *   (im theoretisch unerreichbaren Fall) keine gültige Verteilung existiert.
 */
export function computeTableSizes(n: number): number[] {
  if (!Number.isInteger(n) || n < 3) {
    throw new PairingError(
      `Mindestens 3 Spieler nötig für ein Pairing, erhalten: ${n}`,
    );
  }

  // Suche die reine 3er/4er-Kombination mit maximaler Anzahl 4er-Tische.
  for (let fours = Math.floor(n / 4); fours >= 0; fours--) {
    const remainder = n - fours * 4;
    if (remainder % 3 === 0) {
      const threes = remainder / 3;
      return [
        ...Array<number>(fours).fill(4),
        ...Array<number>(threes).fill(3),
      ];
    }
  }

  // Keine reine 3/4-Lösung gefunden: das ist rechnerisch nur bei N=5 möglich.
  if (n === 5) {
    return [5];
  }

  // Für n >= 6 ist dieser Fall durch die Frobenius-Zahl von (3,4) = 5
  // ausgeschlossen. Defensive Absicherung, damit die Funktion nicht crasht,
  // sondern einen klaren, abfangbaren Fehler wirft.
  throw new PairingError(
    `Keine gültige Tischverteilung für ${n} Spieler gefunden`,
  );
}
