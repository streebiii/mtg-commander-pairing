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

export const SCOPES: AchievementScope[] = ["MATCH", "EVENING", "SEASON"];

/** Beschriftung wie in der Spalte «Art» des Punkteblatts. */
export const SCOPE_LABELS: Record<AchievementScope, string> = {
  MATCH: "1x pro Match",
  EVENING: "1x pro Abend",
  SEASON: "1x am Ende der Liga",
};

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

/** «+1», «+2»; mehrfach zählende mit Zusatz, z.B. «+1 (mehrfach)». */
export function formatPoints(points: number, repeatable: boolean): string {
  const sign = points >= 0 ? "+" : "";
  return `${sign}${points}${repeatable ? " (mehrfach)" : ""}`;
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
    repeatable: a.repeatable,
    sortOrder: a.sortOrder,
  };
}

/**
 * Übernimmt beim Start eines Liga-Abends die geltenden Achievements: alle
 * aktiven fixen und Deckbau-Achievements plus die vorgemerkte Auswahl der
 * rotierenden. Die Vormerkung wird danach geleert — die nächste Auswahl
 * entsteht erst am Ende dieses Abends (siehe BACKLOG.md).
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
