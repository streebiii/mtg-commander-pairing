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
 * Skill-Einstufung eines Spielers (siehe SPEC.md Abschnitt 6), nur für den
 * skill-balancierten Modus A relevant (Abschnitt 4.1). 0 = unbekannt.
 *
 * Nach außen (Admin-UI) heißt das Ganze bewusst "Elo" statt "Skill" — eine
 * Art verdecktes Rating. Der Wert ist ausschließlich im Organisator-Bereich
 * sichtbar (siehe SPEC.md Abschnitt 4.1) und soll das auch bleiben: Spieler
 * sollen ihre eigene Einstufung nicht ohne Weiteres mitbekommen.
 */
export const SKILL_LEVEL_MIN = 0;
export const SKILL_LEVEL_MAX = 3;

export const SKILL_LEVEL_LABELS: Record<number, string> = {
  0: "0 – weiss ich nicht",
  1: "1 – Anfänger",
  2: "2 – Medium",
  3: "3 – erfahrener Spieler (mehrjährig)",
};

export const SKILL_LEVEL_OPTIONS = [0, 1, 2, 3].map((value) => ({
  value,
  label: SKILL_LEVEL_LABELS[value],
}));

/** Kurzes Label für die Anzeige neben einem Spielernamen (z.B. "Elo 2"). */
export function skillLevelShortLabel(skillLevel: number): string {
  return skillLevel > 0 ? `Elo ${skillLevel}` : "Elo ?";
}

/** Prüft und normalisiert einen eingegebenen Skill-Wert (0-3). */
export function parseSkillLevel(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < SKILL_LEVEL_MIN || parsed > SKILL_LEVEL_MAX) return null;
  return parsed;
}
