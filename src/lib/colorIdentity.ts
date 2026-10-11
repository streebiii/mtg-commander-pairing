/**
 * Farbidentität eines Spielers (siehe SPEC.md Abschnitt 13), wie in der
 * Spalte F auf mtgbl.ch: Buchstaben der Magic-Farben, z.B. «WR».
 */
export const COLORS = ["W", "U", "B", "R", "G"] as const;
export type Color = (typeof COLORS)[number];

export const COLOR_NAMES: Record<Color, string> = {
  W: "Weiss",
  U: "Blau",
  B: "Schwarz",
  R: "Rot",
  G: "Grün",
};

/**
 * Liest eine Farbidentität aus beliebigem Text («wr», «R W», «WR») und
 * gibt sie in der festen Reihenfolge WUBRG zurück — oder null, wenn keine
 * Farbe erkennbar ist. Andere Zeichen werden ignoriert.
 */
export function normalizeColorIdentity(raw: string | null | undefined): string | null {
  const letters = new Set((raw ?? "").toUpperCase());
  const colors = COLORS.filter((c) => letters.has(c));
  return colors.length > 0 ? colors.join("") : null;
}

/** Die einzelnen Farben einer gespeicherten Farbidentität. */
export function colorsOf(identity: string | null | undefined): Color[] {
  return COLORS.filter((c) => (identity ?? "").includes(c));
}
