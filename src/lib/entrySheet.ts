import type { AchievementCategory, AchievementScope } from "@prisma/client";
import { isRepeatable } from "@/lib/achievements";

// Reine Logik des Erfassungsblatts (siehe SPEC.md Abschnitt 12) — ohne
// Datenbankzugriff, damit dieselben Regeln im Browser (laufende Summe)
// und auf dem Server (Prüfung jeder Änderung) gelten.

export const PARTICIPATION_KEY = "participation";

/** Höchste Anzahl bei mehrfach zählenden Achievements — Schutz vor Tippfehlern. */
export const MAX_REPEAT_COUNT = 20;

export interface SheetAchievement {
  id: string;
  title: string;
  description: string;
  points: number;
  category: AchievementCategory;
  scope: AchievementScope;
  systemKey: string | null;
  sortOrder: number;
}

export interface SheetMark {
  eveningAchievementId: string;
  game: number;
  count: number;
}

export interface SheetTotals {
  core: number;
  deckbau: number;
  rotate: number;
  total: number;
}

/**
 * Zählt pro Spiel (Match): «1x pro Match» und «pro Spieler». Alles andere
 * («1x pro Abend», «mehrmals pro Abend», «1x am Ende der Liga») zählt für
 * den ganzen Abend und wird unter Spiel 0 gespeichert.
 */
export function isPerGame(scope: AchievementScope): boolean {
  return scope === "MATCH" || scope === "PER_PLAYER";
}

export function maxCount(scope: AchievementScope): number {
  return isRepeatable(scope) ? MAX_REPEAT_COUNT : 1;
}

export function markKey(eveningAchievementId: string, game: number): string {
  return `${eveningAchievementId}:${game}`;
}

export function isParticipation(a: Pick<SheetAchievement, "systemKey">): boolean {
  return a.systemKey === PARTICIPATION_KEY;
}

/**
 * Was auf dem Blatt erscheint: «1x am Ende der Liga» (Evergreen) nur am
 * letzten Abend der Saison.
 */
export function visibleAchievements<T extends Pick<SheetAchievement, "scope">>(
  achievements: T[],
  lastEvening: boolean,
): T[] {
  return achievements.filter((a) => a.scope !== "SEASON" || lastEvening);
}

/** Ist `game` für dieses Achievement eine gültige Spiel-Nummer? */
export function validGame(
  scope: AchievementScope,
  game: number,
  gamesPlayed: number[],
): boolean {
  return isPerGame(scope) ? gamesPlayed.includes(game) : game === 0;
}

/**
 * Summen wie auf dem Punkteblatt: Core (fix), Deckbau, Rotate. Participation
 * zählt automatisch einmal je gespieltem Spiel. Markierungen für Spiele,
 * die der Spieler nicht gespielt hat, oder für ausgeblendete Achievements
 * werden ignoriert.
 */
export function computeTotals(
  achievements: SheetAchievement[],
  marks: Map<string, number>,
  gamesPlayed: number[],
  lastEvening: boolean,
): SheetTotals {
  const totals: SheetTotals = { core: 0, deckbau: 0, rotate: 0, total: 0 };
  for (const a of visibleAchievements(achievements, lastEvening)) {
    let count = 0;
    if (isParticipation(a)) {
      count = gamesPlayed.length;
    } else if (isPerGame(a.scope)) {
      for (const g of gamesPlayed) count += marks.get(markKey(a.id, g)) ?? 0;
    } else {
      count = marks.get(markKey(a.id, 0)) ?? 0;
    }
    const points = a.points * count;
    if (a.category === "FIXED") totals.core += points;
    else if (a.category === "DECKBUILDING") totals.deckbau += points;
    else totals.rotate += points;
  }
  totals.total = totals.core + totals.deckbau + totals.rotate;
  return totals;
}

export function marksToMap(marks: SheetMark[]): Map<string, number> {
  return new Map(
    marks.map((m) => [markKey(m.eveningAchievementId, m.game), m.count]),
  );
}
