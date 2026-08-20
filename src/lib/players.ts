/** Baut den Anzeigenamen eines Spielers aus Vor- und (optionalem) Nachnamen. */
export function formatPlayerName(player: {
  firstName: string;
  lastName?: string | null;
}): string {
  return player.lastName
    ? `${player.firstName} ${player.lastName}`
    : player.firstName;
}

/**
 * Skill-Einstufung eines Spielers (siehe SPEC.md Abschnitt 6), nur für die
 * elo-balancierte Zuteilung im Casual-Modus relevant (Abschnitt 4.1).
 * 0 = noch nicht eingestuft.
 *
 * Die Stufen werden bewusst ohne Beschriftung angeboten — nur die nackte
 * Zahl. Was eine 2 bedeutet, weiss der Organisator; ausgeschriebene
 * Bezeichnungen würden das verdeckte Rating unnötig erklären.
 *
 * Nach aussen (Admin-UI) heisst das Ganze bewusst "Elo" statt "Skill". Der
 * Wert wird nur dort angezeigt, wo er gepflegt wird: im Spieler-Tab und in
 * den beiden Anlege-Formularen. In den Spielerlisten und den fertigen
 * Tischzuteilungen taucht er bewusst nicht auf, damit Spieler ihre eigene
 * Einstufung nicht mitbekommen.
 */
export const SKILL_LEVEL_MIN = 0;
export const SKILL_LEVEL_MAX = 3;

/** Auswählbare Stufen für die Elo-Dropdowns: 0, 1, 2, 3. */
export const SKILL_LEVELS = [0, 1, 2, 3] as const;

/** Prüft und normalisiert einen eingegebenen Skill-Wert (0-3). */
export function parseSkillLevel(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < SKILL_LEVEL_MIN || parsed > SKILL_LEVEL_MAX) return null;
  return parsed;
}
