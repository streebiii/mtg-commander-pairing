-- Abende von vor der Achievement-Erfassung (ohne eigene Achievements)
-- gelten als abgeschlossen. Ohne diesen Schritt hielte die App den neuesten
-- alten Abend für eine offene Erfassung (siehe SPEC.md Abschnitt 12).
UPDATE "evenings"
SET "entryClosedAt" = COALESCE("finishedAt", CURRENT_TIMESTAMP)
WHERE "entryClosedAt" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "evening_achievements" ea WHERE ea."eveningId" = "evenings"."id"
  );
