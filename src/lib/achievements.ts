import type {
  Achievement,
  AchievementCategory,
  AchievementScope,
  Prisma,
} from "@prisma/client";

// Achievement-Katalog der Liga (siehe SPEC.md Abschnitt 11). Massgeblich
// ist die Liste auf mtgbl.ch; pro Abend gelten alle aktiven fixen und
// Deckbau-Achievements plus die ausgewählten rotierenden.

export const CATEGORIES: AchievementCategory[] = [
  "FIXED",
  "DECKBUILDING",
  "ROTATING",
];

export const CATEGORY_LABELS: Record<AchievementCategory, string> = {
  FIXED: "Fixe Achievements",
  DECKBUILDING: "Deckbau-Achievements",
  ROTATING: "Rotierende Achievements",
};

export const SCOPES: AchievementScope[] = [
  "MATCH",
  "EVENING",
  "SEASON",
  "PER_PLAYER",
  "MULTIPLE",
];

/** Beschriftung wie in der Spalte «Art» des Punkteblatts. */
export const SCOPE_LABELS: Record<AchievementScope, string> = {
  MATCH: "1x pro Match",
  EVENING: "1x pro Abend",
  SEASON: "1x am Ende der Liga",
  PER_PLAYER: "pro Spieler",
  MULTIPLE: "mehrmals pro Abend",
};

/**
 * Zählt das Achievement mehrfach? Dann zeigt die Erfassung ein
 * Anzahl-Feld statt eines Häkchens.
 */
export function isRepeatable(scope: AchievementScope): boolean {
  return scope === "PER_PLAYER" || scope === "MULTIPLE";
}

/**
 * Vorbelegung der Art beim Anlegen: fixe und rotierende zählen pro Match,
 * Deckbau pro Abend. Ausnahmen (Evergreen) werden danach von Hand gesetzt.
 */
export const DEFAULT_SCOPE: Record<AchievementCategory, AchievementScope> = {
  FIXED: "MATCH",
  DECKBUILDING: "EVENING",
  ROTATING: "MATCH",
};

export function parseCategory(value: unknown): AchievementCategory | null {
  return CATEGORIES.includes(value as AchievementCategory)
    ? (value as AchievementCategory)
    : null;
}

export function parseScope(value: unknown): AchievementScope | null {
  return SCOPES.includes(value as AchievementScope)
    ? (value as AchievementScope)
    : null;
}

/** «+1», «+2», «−3» — mit Vorzeichen wie auf mtgbl.ch. */
export function formatPoints(points: number): string {
  return points >= 0 ? `+${points}` : `−${Math.abs(points)}`;
}

/**
 * Die eingefrorene Kopie eines Katalog-Eintrags für einen Abend — spätere
 * Katalogänderungen schreiben den Abend damit nicht um.
 */
export function eveningCopy(
  eveningId: string,
  a: Achievement,
): Prisma.EveningAchievementCreateManyInput {
  return {
    eveningId,
    achievementId: a.id,
    title: a.title,
    description: a.description,
    points: a.points,
    category: a.category,
    scope: a.scope,
    sortOrder: a.sortOrder,
  };
}

/**
 * Übernimmt beim Start eines Liga-Abends die geltenden Achievements: alle
 * aktiven fixen und Deckbau-Achievements plus die aktiven rotierenden aus
 * der Auswahl für den nächsten Liga-Abend. Die Auswahl wird danach
 * geleert (auch Häkchen an deaktivierten) — die nächste entsteht erst am
 * Ende dieses Abends, wenn mtgbl.ch neu zieht (siehe SPEC.md 11.2).
 */
export async function adoptAchievementsForEvening(
  tx: Prisma.TransactionClient,
  eveningId: string,
) {
  const achievements = await tx.achievement.findMany({
    where: {
      active: true,
      OR: [
        { category: { in: ["FIXED", "DECKBUILDING"] } },
        { category: "ROTATING", nextSelected: true },
      ],
    },
  });
  if (achievements.length > 0) {
    await tx.eveningAchievement.createMany({
      data: achievements.map((a) => eveningCopy(eveningId, a)),
    });
  }
  await tx.achievement.updateMany({
    where: { nextSelected: true },
    data: { nextSelected: false },
  });
}
