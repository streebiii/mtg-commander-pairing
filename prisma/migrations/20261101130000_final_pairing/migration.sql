-- AlterTable
ALTER TABLE "evenings" ADD COLUMN     "pairByPoints" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "player_entries" ADD COLUMN     "game1DoneAt" TIMESTAMP(3);
