-- AlterTable
ALTER TABLE "table_assignments" ADD COLUMN     "isWinner" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "tables" ADD COLUMN     "resultEnteredAt" TIMESTAMP(3);
