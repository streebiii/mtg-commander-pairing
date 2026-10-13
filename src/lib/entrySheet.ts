import type { AchievementCategory, AchievementScope } from "@prisma/client";
import { CATEGORIES, isRepeatable } from "@/lib/achievements";

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
 * Wie oft ein Achievement in welchem Spiel zählt (Spiel 0 = ganzer Abend).
 * Participation zählt automatisch einmal je gespieltem Spiel; Markierungen
 * für Spiele, die der Spieler nicht gespielt hat, werden ignoriert.
 */
function countsByGame(
  a: SheetAchievement,
  marks: Map<string, number>,
  gamesPlayed: number[],
): { game: number; count: number }[] {
  if (isParticipation(a)) return gamesPlayed.map((game) => ({ game, count: 1 }));
  if (isPerGame(a.scope)) {
    return gamesPlayed.map((game) => ({ game, count: marks.get(markKey(a.id, game)) ?? 0 }));
  }
  return [{ game: 0, count: marks.get(markKey(a.id, 0)) ?? 0 }];
}

/**
 * Summen wie auf dem Punkteblatt: Core (fix), Deckbau, Rotate.
 * Ausgeblendete Achievements (Evergreen ausser am letzten Abend) zählen nicht.
 */
export function computeTotals(
  achievements: SheetAchievement[],
  marks: Map<string, number>,
  gamesPlayed: number[],
  lastEvening: boolean,
): SheetTotals {
  const totals: SheetTotals = { core: 0, deckbau: 0, rotate: 0, total: 0 };
  for (const a of visibleAchievements(achievements, lastEvening)) {
    const count = countsByGame(a, marks, gamesPlayed).reduce((s, c) => s + c.count, 0);
    const points = a.points * count;
    if (a.category === "FIXED") totals.core += points;
    else if (a.category === "DECKBUILDING") totals.deckbau += points;
    else totals.rotate += points;
  }
  totals.total = totals.core + totals.deckbau + totals.rotate;
  return totals;
}

export interface BreakdownItem {
  title: string;
  /** Punkte pro Erfüllung. */
  points: number;
  count: number;
}

export interface BreakdownSection {
  /** «Match 1», «Match 2» oder «Ganze Runde». */
  label: string;
  total: number;
  items: BreakdownItem[];
}

export interface Breakdown {
  sections: BreakdownSection[];
  total: number;
}

/**
 * Was ein Spieler an einem Abend erreicht hat, gegliedert wie das
 * Punkteblatt: je gespieltes Spiel, dann alles, was für den ganzen Abend
 * zählt (Deckbau, «mehrmals pro Abend», Evergreen). Für die Details in
 * der Rangliste (SPEC.md Abschnitt 13); die Summe entspricht immer
 * `computeTotals`.
 */
export function computeBreakdown(
  achievements: SheetAchievement[],
  marks: Map<string, number>,
  gamesPlayed: number[],
  lastEvening: boolean,
): Breakdown {
  const order = (a: SheetAchievement) =>
    CATEGORIES.indexOf(a.category) * 100_000 + a.sortOrder;
  const sorted = [...visibleAchievements(achievements, lastEvening)].sort(
    (x, y) => order(x) - order(y),
  );

  const games = [...gamesPlayed].sort((x, y) => x - y);
  const sections: BreakdownSection[] = [...games, 0].map((game) => ({
    label: game === 0 ? "Ganze Runde" : `Match ${game}`,
    total: 0,
    items: [],
  }));
  const sectionOf = (game: number) =>
    sections[game === 0 ? games.length : games.indexOf(game)];

  for (const a of sorted) {
    for (const { game, count } of countsByGame(a, marks, games)) {
      if (count === 0) continue;
      const section = sectionOf(game);
      section.items.push({ title: a.title, points: a.points, count });
      section.total += a.points * count;
    }
  }

  const filled = sections.filter((s) => s.items.length > 0);
  return { sections: filled, total: filled.reduce((sum, s) => sum + s.total, 0) };
}

export function marksToMap(marks: SheetMark[]): Map<string, number> {
  return new Map(
    marks.map((m) => [markKey(m.eveningAchievementId, m.game), m.count]),
  );
}
