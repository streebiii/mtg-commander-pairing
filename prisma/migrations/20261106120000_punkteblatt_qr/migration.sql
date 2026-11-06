-- AlterTable
ALTER TABLE "player_entries" ADD COLUMN     "checkedInAt" TIMESTAMP(3),
ADD COLUMN     "confirmedGames" INTEGER[] DEFAULT ARRAY[]::INTEGER[],
ADD COLUMN     "sheetCode" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "player_entries_sheetCode_key" ON "player_entries"("sheetCode");
