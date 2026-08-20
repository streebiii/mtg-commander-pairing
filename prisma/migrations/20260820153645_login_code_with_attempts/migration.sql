-- DropIndex
DROP INDEX "login_tokens_tokenHash_key";

-- AlterTable
ALTER TABLE "login_tokens" ADD COLUMN     "attempts" INTEGER NOT NULL DEFAULT 0;

-- CreateIndex
CREATE INDEX "login_tokens_tokenHash_idx" ON "login_tokens"("tokenHash");
