-- CreateTable
CREATE TABLE "players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "evenings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "mode" TEXT NOT NULL,
    "date" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "rounds" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "eveningId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "rounds_eveningId_fkey" FOREIGN KEY ("eveningId") REFERENCES "evenings" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "tables" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roundId" TEXT NOT NULL,
    "tableNumber" INTEGER NOT NULL,
    "size" INTEGER NOT NULL,
    CONSTRAINT "tables_roundId_fkey" FOREIGN KEY ("roundId") REFERENCES "rounds" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "table_assignments" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tableId" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "pointsAwarded" INTEGER,
    CONSTRAINT "table_assignments_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "tables" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "table_assignments_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "players" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "rounds_eveningId_number_key" ON "rounds"("eveningId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "tables_roundId_tableNumber_key" ON "tables"("roundId", "tableNumber");

-- CreateIndex
CREATE UNIQUE INDEX "table_assignments_tableId_playerId_key" ON "table_assignments"("tableId", "playerId");
