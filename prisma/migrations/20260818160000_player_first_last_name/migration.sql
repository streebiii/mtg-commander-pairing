-- Ersetzt das einzelne "name"-Feld durch firstName/lastName.
-- Bestehende Werte werden am ersten Leerzeichen aufgeteilt, damit keine
-- Daten verloren gehen (z.B. "Alice" -> firstName="Alice", lastName=NULL;
-- "Marc Strebel" -> firstName="Marc", lastName="Strebel").

PRAGMA foreign_keys=OFF;

CREATE TABLE "new_players" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "points" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO "new_players" ("id", "firstName", "lastName", "points", "createdAt")
SELECT
    "id",
    CASE WHEN instr("name", ' ') > 0
        THEN substr("name", 1, instr("name", ' ') - 1)
        ELSE "name"
    END,
    CASE WHEN instr("name", ' ') > 0
        THEN substr("name", instr("name", ' ') + 1)
        ELSE NULL
    END,
    "points",
    "createdAt"
FROM "players";

DROP TABLE "players";
ALTER TABLE "new_players" RENAME TO "players";

PRAGMA foreign_keys=ON;
