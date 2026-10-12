-- AlterTable
ALTER TABLE "player_entries" ADD COLUMN     "games" INTEGER[] DEFAULT ARRAY[]::INTEGER[];
