-- AlterTable
ALTER TABLE "evenings" ADD COLUMN     "rankingPublishedAt" TIMESTAMP(3);

-- Was schon geschlossen ist, ist bereits öffentlich und bleibt es.
UPDATE "evenings" SET "rankingPublishedAt" = "entryClosedAt"
WHERE "pairByPoints" AND "entryClosedAt" IS NOT NULL;
