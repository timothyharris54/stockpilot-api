-- CreateEnum
CREATE TYPE "RecommendationStatus" AS ENUM ('open', 'reviewed', 'converted', 'dismissed');

-- CreateTable
CREATE TABLE "SalesDaily" (
    "accountId" BIGINT NOT NULL,
    "productId" BIGINT NOT NULL,
    "salesDate" TIMESTAMP(3) NOT NULL,
    "unitsSold" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "revenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SalesDaily_pkey" PRIMARY KEY ("accountId","productId","salesDate")
);

-- CreateTable
CREATE TABLE "ReplenishmentRule" (
    "accountId" BIGINT NOT NULL,
    "productId" BIGINT NOT NULL,
    "safetyStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "targetDaysOfCover" INTEGER NOT NULL DEFAULT 30,
    "overrideLeadTimeDays" INTEGER,
    "minReorderQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ReplenishmentRule_pkey" PRIMARY KEY ("accountId","productId")
);

-- CreateTable
CREATE TABLE "ReorderRecommendation" (
    "id" BIGSERIAL NOT NULL,
    "accountId" BIGINT NOT NULL,
    "productId" BIGINT NOT NULL,
    "vendorId" BIGINT,
    "locationCode" TEXT NOT NULL,
    "recommendedQty" DECIMAL(12,2) NOT NULL,
    "daysUntilStockout" DECIMAL(12,2),
    "reorderPoint" DECIMAL(12,2),
    "targetStock" DECIMAL(12,2),
    "avgDailySales30" DECIMAL(12,4),
    "qtyOnHandSnapshot" DECIMAL(12,2),
    "qtyIncomingSnapshot" DECIMAL(12,2),
    "qtyAvailableSnapshot" DECIMAL(12,2),
    "status" "RecommendationStatus" NOT NULL DEFAULT 'open',
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReorderRecommendation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ReplenishmentRule_productId_key" ON "ReplenishmentRule"("productId");

-- AddForeignKey
ALTER TABLE "SalesDaily" ADD CONSTRAINT "SalesDaily_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SalesDaily" ADD CONSTRAINT "SalesDaily_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentRule" ADD CONSTRAINT "ReplenishmentRule_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReplenishmentRule" ADD CONSTRAINT "ReplenishmentRule_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReorderRecommendation" ADD CONSTRAINT "ReorderRecommendation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReorderRecommendation" ADD CONSTRAINT "ReorderRecommendation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReorderRecommendation" ADD CONSTRAINT "ReorderRecommendation_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "Vendor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
