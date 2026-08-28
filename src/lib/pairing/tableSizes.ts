import { PairingError } from "./errors";

export interface TableSizeOptions {
  /**
   * Erlaubt **einen** 5er-Tisch, wo er die Verteilung verbessert (siehe
   * SPEC.md Abschnitt 3.1). Nur der Casual-Modus setzt das Flag; die Liga
   * ruft bewusst ohne auf, weil dort an der Tischgrösse die Punktechance
   * hängt.
   */
  allowFiveTable?: boolean;
}

/**
 * Zerlegt `rest` in möglichst viele 4er- und den Rest in 3er-Tische.
 * Liefert null, wenn `rest` sich nicht rein aus 3ern und 4ern darstellen
 * lässt (nur bei 1, 2 und 5 der Fall).
 */
function splitIntoThreesAndFours(
  rest: number,
): { fours: number; threes: number } | null {
  for (let fours = Math.floor(rest / 4); fours >= 0; fours--) {
    const remainder = rest - fours * 4;
    if (remainder % 3 === 0) return { fours, threes: remainder / 3 };
  }
  return null;
}

/**
 * Berechnet die Tischgrößen-Verteilung für N anwesende Spieler.
 *
 * Regeln (siehe SPEC.md Abschnitt 3):
 * - Gültige Tischgrößen sind 3, 4, 5.
 * - Standardmäßig sind 5er-Tische der absolute Ausnahmefall: sie werden nur
 *   verwendet, wenn eine Aufteilung ausschließlich mit 3er-/4er-Tischen
 *   unmöglich ist. Da 3 und 4 teilerfremd sind (Frobenius-Zahl = 3*4-3-4 =
 *   5), ist das rechnerisch nur bei genau N = 5 der Fall.
 * - Innerhalb der reinen 3er/4er-Lösungen wird die Anzahl der 4er-Tische
 *   maximiert (das minimiert automatisch auch die Gesamtzahl der Tische).
 *
 * Mit `allowFiveTable` (nur Casual, siehe SPEC.md Abschnitt 3.1) darf
 * zusätzlich **ein einzelner** 5er-Tisch entstehen, wenn dadurch mehr
 * 4er-Tische möglich werden. Betroffen sind genau die Spielerzahlen
 * N ≡ 1 (mod 4) — 9, 13, 17, 21, ... —, bei denen sonst drei 3er-Tische
 * entstünden; aus 3+3+3 wird 5+4. Alle übrigen Spielerzahlen bleiben
 * unverändert.
 *
 * Entscheidend ist dabei das Ziel, nicht die Möglichkeit: "nimm einen 5er,
 * wann immer es aufgeht" wäre falsch — bei N = 14 ergäbe das 5+3+3+3 statt
 * 4+4+3+3, also mehr 3er-Tische statt weniger.
 *
 * @param n Anzahl anwesender Spieler (muss >= 3 sein).
 * @returns Array der Tischgrößen, absteigend, z.B. [4, 4, 3] für N=11.
 * @throws {PairingError} wenn n keine gültige Spielerzahl ist (< 3) oder
 *   (im theoretisch unerreichbaren Fall) keine gültige Verteilung existiert.
 */
export function computeTableSizes(
  n: number,
  { allowFiveTable = false }: TableSizeOptions = {},
): number[] {
  if (!Number.isInteger(n) || n < 3) {
    throw new PairingError(
      `Mindestens 3 Spieler nötig für ein Pairing, erhalten: ${n}`,
    );
  }

  const build = (fives: number, fours: number, threes: number): number[] => [
    ...Array<number>(fives).fill(5),
    ...Array<number>(fours).fill(4),
    ...Array<number>(threes).fill(3),
  ];

  const pure = splitIntoThreesAndFours(n);

  if (allowFiveTable) {
    const withFive = n >= 5 ? splitIntoThreesAndFours(n - 5) : null;
    // Mehr 4er-Tische gewinnt; bei Gleichstand die Lösung ohne 5er, damit
    // sich gegenüber heute nur ändert, was sich auch wirklich verbessert.
    // (Bis N = 200 nachgerechnet: die Alternative "wenigste Tische" liefert
    // überall dasselbe Ergebnis, ein Tie-Break wird nie gebraucht.)
    if (withFive && (!pure || withFive.fours > pure.fours)) {
      return build(1, withFive.fours, withFive.threes);
    }
  }

  if (pure) return build(0, pure.fours, pure.threes);

  // Keine reine 3/4-Lösung gefunden: das ist rechnerisch nur bei N=5 möglich.
  if (n === 5) return build(1, 0, 0);

  // Für n >= 6 ist dieser Fall durch die Frobenius-Zahl von (3,4) = 5
  // ausgeschlossen. Defensive Absicherung, damit die Funktion nicht crasht,
  // sondern einen klaren, abfangbaren Fehler wirft.
  throw new PairingError(
    `Keine gültige Tischverteilung für ${n} Spieler gefunden`,
  );
}
