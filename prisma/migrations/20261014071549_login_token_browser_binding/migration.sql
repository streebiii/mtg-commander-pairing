-- AlterTable
ALTER TABLE "login_tokens" ADD COLUMN     "browserHash" TEXT,
ADD COLUMN     "ipHash" TEXT;

-- CreateIndex
CREATE INDEX "login_tokens_browserHash_idx" ON "login_tokens"("browserHash");
