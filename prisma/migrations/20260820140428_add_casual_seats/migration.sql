-- CreateTable
CREATE TABLE "casual_seats" (
    "id" TEXT NOT NULL,
    "tableNumber" INTEGER NOT NULL,
    "playerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "casual_seats_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "casual_seats_tableNumber_idx" ON "casual_seats"("tableNumber");

-- CreateIndex
CREATE UNIQUE INDEX "casual_seats_playerId_key" ON "casual_seats"("playerId");

-- AddForeignKey
ALTER TABLE "casual_seats" ADD CONSTRAINT "casual_seats_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players"("id") ON DELETE CASCADE ON UPDATE CASCADE;
