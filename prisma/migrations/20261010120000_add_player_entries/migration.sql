-- AlterTable
ALTER TABLE "achievements" ADD COLUMN     "systemKey" TEXT;

-- AlterTable
ALTER TABLE "evening_achievements" ADD COLUMN     "systemKey" TEXT;

-- AlterTable
ALTER TABLE "evenings" ADD COLUMN     "entryClosedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "player_entries" (
    "id" TEXT NOT NULL,
    "eveningId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "deviceTokenHash" TEXT,
    "claimedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "player_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "achievement_marks" (
    "id" TEXT NOT NULL,
    "entryId" TEXT NOT NULL,
    "eveningAchievementId" TEXT NOT NULL,
    "game" INTEGER NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "achievement_marks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "player_entries_eveningId_playerId_key" ON "player_entries"("eveningId", "playerId");

-- CreateIndex
CREATE UNIQUE INDEX "achievement_marks_entryId_eveningAchievementId_game_key" ON "achievement_marks"("entryId", "eveningAchievementId", "game");

-- CreateIndex
CREATE UNIQUE INDEX "achievements_systemKey_key" ON "achievements"("systemKey");

-- AddForeignKey
ALTER TABLE "player_entries" ADD CONSTRAINT "player_entries_eveningId_fkey" FOREIGN KEY ("eveningId") REFERENCES "evenings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "player_entries" ADD CONSTRAINT "player_entries_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_marks" ADD CONSTRAINT "achievement_marks_entryId_fkey" FOREIGN KEY ("entryId") REFERENCES "player_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "achievement_marks" ADD CONSTRAINT "achievement_marks_eveningAchievementId_fkey" FOREIGN KEY ("eveningAchievementId") REFERENCES "evening_achievements"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Participation ist das einzige Achievement, das die App selbst setzt
-- (für jedes gespielte Spiel, siehe SPEC.md Abschnitt 12).
UPDATE "achievements" SET "systemKey" = 'participation'
WHERE "category" = 'FIXED' AND "title" = 'Participation';
UPDATE "evening_achievements" SET "systemKey" = 'participation'
WHERE "category" = 'FIXED' AND "title" = 'Participation';
