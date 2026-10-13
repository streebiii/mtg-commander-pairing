-- AlterTable
ALTER TABLE "table_assignments" ADD COLUMN     "droppedAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "late_arrivals" (
    "id" TEXT NOT NULL,
    "eveningId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "late_arrivals_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "late_arrivals_eveningId_playerId_key" ON "late_arrivals"("eveningId", "playerId");

-- AddForeignKey
ALTER TABLE "late_arrivals" ADD CONSTRAINT "late_arrivals_eveningId_fkey" FOREIGN KEY ("eveningId") REFERENCES "evenings"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "late_arrivals" ADD CONSTRAINT "late_arrivals_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
