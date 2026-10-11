-- AlterTable
ALTER TABLE "evenings" ADD COLUMN     "seasonRound" INTEGER;

-- AlterTable
ALTER TABLE "players" ADD COLUMN     "colorIdentity" TEXT;

-- CreateTable
CREATE TABLE "imported_evening_scores" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "round" INTEGER NOT NULL,
    "points" INTEGER NOT NULL,

    CONSTRAINT "imported_evening_scores_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "imported_evening_scores_playerId_round_key" ON "imported_evening_scores"("playerId", "round");

-- AddForeignKey
ALTER TABLE "imported_evening_scores" ADD CONSTRAINT "imported_evening_scores_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
