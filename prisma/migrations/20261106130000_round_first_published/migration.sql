-- AlterTable
ALTER TABLE "rounds" ADD COLUMN     "firstPublishedAt" TIMESTAMP(3);

-- Bisher live geschaltete Runden waren beim ersten Mal live.
UPDATE "rounds" SET "firstPublishedAt" = "publishedAt" WHERE "publishedAt" IS NOT NULL;
