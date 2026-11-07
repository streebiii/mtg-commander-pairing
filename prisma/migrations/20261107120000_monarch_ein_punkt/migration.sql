-- Monarch («It’s Good to Be the King/Queen») zählt pro Spieler mit dem
-- Zähler. Mit 2 Punkten pro Mal ergab «1» schon 2 Punkte und «2» 4.
-- Mit 1 Punkt pro Mal trägt der Spieler direkt seine Punkte ein: 2 als
-- erster Monarch, sonst 1 (Entscheid des Organisators vom 07.11.2026).
--
-- Nur der Katalog: die Kopien der bisherigen Abende (evening_achievements)
-- bleiben, damit sich an der Rangliste nichts ändert. Die neuen Punkte
-- gelten ab dem nächsten vorbereiteten Abend.
UPDATE "achievements"
SET "points" = 1
WHERE "title" = 'It’s Good to Be the King/Queen' AND "points" = 2;
