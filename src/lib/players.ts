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
 * ausgewogene Zuteilung im Casual-Modus relevant (Abschnitt 4.1).
 * 0 = noch nicht eingestuft.
 *
 * Die Stufen werden bewusst ohne Beschriftung angeboten — nur die nackte
 * Zahl. Was eine 2 bedeutet, weiss der Organisator; ausgeschriebene
 * Bezeichnungen würden das verdeckte Rating unnötig erklären.
 *
 * Nach aussen (Admin-UI) heisst das Ganze schlicht "Stufe" — bewusst ein
 * nichtssagender Begriff, damit ein Blick über die Schulter niemanden
 * blossstellt. Der Wert wird nur dort angezeigt, wo er gepflegt wird: im
 * Spieler-Tab und in den beiden Anlege-Formularen. In den Spielerlisten und
 * den fertigen Tischzuteilungen taucht er bewusst nicht auf, damit Spieler
 * ihre eigene Einstufung nicht mitbekommen. Die zugehörige Zuteilungsart
 * heisst im UI "Ausgewogen".
 */
export const SKILL_LEVEL_MIN = 0;
export const SKILL_LEVEL_MAX = 3;

/** Auswählbare Stufen für die Dropdowns: 0, 1, 2, 3. */
export const SKILL_LEVELS = [0, 1, 2, 3] as const;

/** Prüft und normalisiert einen eingegebenen Skill-Wert (0-3). */
export function parseSkillLevel(value: unknown): number | null {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value ?? ""), 10);
  if (!Number.isFinite(parsed)) return null;
  if (parsed < SKILL_LEVEL_MIN || parsed > SKILL_LEVEL_MAX) return null;
  return parsed;
}

interface NamedRosterPlayer {
  id: string;
  firstName: string;
  lastName?: string | null;
}

/**
 * Namen für die öffentlichen Seiten (Rangliste, Pairings, Tischkarten,
 * Erfassung): Vorname und Initial wie auf mtgbl.ch — «David L.» statt des
 * vollen Nachnamens, der nur im Organisator-Bereich steht.
 *
 * Teilen sich zwei Spieler Vorname und Initial, bekommen beide so viele
 * Buchstaben, bis sie sich unterscheiden («Marc St.», «Marc So.»).
 * Verglichen wird gegen den ganzen übergebenen Bestand, damit derselbe
 * Spieler auf jeder Seite gleich heisst.
 */
export function publicNames(roster: readonly NamedRosterPlayer[]): Map<string, string> {
  const key = (s: string) => s.trim().toLowerCase();
  const byFirst = new Map<string, NamedRosterPlayer[]>();
  for (const p of roster) {
    const group = byFirst.get(key(p.firstName)) ?? [];
    group.push(p);
    byFirst.set(key(p.firstName), group);
  }

  const names = new Map<string, string>();
  for (const p of roster) {
    const last = (p.lastName ?? "").trim();
    if (!last) {
      names.set(p.id, p.firstName);
      continue;
    }
    const others = byFirst
      .get(key(p.firstName))!
      .filter((q) => q.id !== p.id && (q.lastName ?? "").trim());
    let length = 1;
    while (
      length < last.length &&
      others.some((q) => key(q.lastName!).startsWith(key(last.slice(0, length))))
    ) {
      length++;
    }
    names.set(p.id, `${p.firstName} ${last.slice(0, length).replace(/\.$/, "")}.`);
  }
  return names;
}

/** Einzelner öffentlicher Name ohne Bestand — nur Vorname und Initial. */
export function shortPlayerName(player: { firstName: string; lastName?: string | null }): string {
  const last = (player.lastName ?? "").trim();
  return last ? `${player.firstName} ${last[0]}.` : player.firstName;
}
