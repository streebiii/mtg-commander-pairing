-- Casual bekommt einen Warteraum wie die Liga: eine neue Zuteilung ist
-- erst nach «Live schalten» öffentlich (siehe SPEC.md Abschnitt 4.3).
ALTER TABLE "casual_seats" ADD COLUMN     "publishedAt" TIMESTAMP(3);

-- Eine bestehende Zuteilung war bisher sofort öffentlich — sie bleibt es.
UPDATE "casual_seats" SET "publishedAt" = "createdAt";

-- Abende sind nur noch Liga-Abende; Casual lebt allein in casual_seats.
-- Der Modus CASUAL wurde nie geschrieben. Falls doch ein solcher Abend
-- existiert, bricht die Migration ab, statt ihn stillschweigend zu einem
-- Liga-Abend zu machen.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "evenings" WHERE "mode" <> 'LEAGUE') THEN
    RAISE EXCEPTION 'Es gibt Abende mit Modus CASUAL — bitte zuerst prüfen.';
  END IF;
END $$;

ALTER TABLE "evenings" DROP COLUMN "mode";

DROP TYPE "EveningMode";
