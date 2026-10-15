-- «Winner winner» ist an das Tisch-Ergebnis gekoppelt: setzt der
-- Organisator die Krone, bekommt der Sieger es automatisch; hakt es ein
-- Spieler zuerst ab, wird er Sieger seines Tisches (SPEC.md Abschnitt 12.2).
-- Reine Datenänderung, keine neue Spalte.
UPDATE "achievements" SET "systemKey" = 'winner'
WHERE "category" = 'FIXED' AND "title" LIKE 'Winner winner%';
UPDATE "evening_achievements" SET "systemKey" = 'winner'
WHERE "category" = 'FIXED' AND "title" LIKE 'Winner winner%';
