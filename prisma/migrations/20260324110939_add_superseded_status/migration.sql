-- AlterEnum
ALTER TYPE "RecommendationStatus" ADD VALUE 'superceded';

-- CreateIndex
CREATE INDEX "SalesDaily_accountId_salesDate_idx" ON "SalesDaily"("accountId", "salesDate");

-- CreateIndex
CREATE INDEX "SalesDaily_accountId_productId_salesDate_idx" ON "SalesDaily"("accountId", "productId", "salesDate");
