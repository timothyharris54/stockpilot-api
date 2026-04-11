-- AlterTable
ALTER TABLE "ReorderRecommendation" ADD COLUMN     "convertedAt" TIMESTAMP(3),
ADD COLUMN     "dismissedAt" TIMESTAMP(3),
ADD COLUMN     "finalQty" DECIMAL(12,2),
ADD COLUMN     "purchaseOrderId" BIGINT,
ADD COLUMN     "purchaseOrderLineId" BIGINT,
ADD COLUMN     "reviewedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "vendorProductId" BIGINT;

-- AlterTable
ALTER TABLE "Vendor" ADD COLUMN     "isPreferred" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "ReorderRecommendation_accountId_status_idx" ON "ReorderRecommendation"("accountId", "status");

-- CreateIndex
CREATE INDEX "ReorderRecommendation_accountId_productId_status_idx" ON "ReorderRecommendation"("accountId", "productId", "status");

-- CreateIndex
CREATE INDEX "ReorderRecommendation_accountId_vendorId_status_idx" ON "ReorderRecommendation"("accountId", "vendorId", "status");

-- CreateIndex
CREATE INDEX "ReorderRecommendation_purchaseOrderId_idx" ON "ReorderRecommendation"("purchaseOrderId");

-- AddForeignKey
ALTER TABLE "ReorderRecommendation" ADD CONSTRAINT "ReorderRecommendation_vendorProductId_fkey" FOREIGN KEY ("vendorProductId") REFERENCES "VendorProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReorderRecommendation" ADD CONSTRAINT "ReorderRecommendation_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReorderRecommendation" ADD CONSTRAINT "ReorderRecommendation_purchaseOrderLineId_fkey" FOREIGN KEY ("purchaseOrderLineId") REFERENCES "PurchaseOrderLine"("id") ON DELETE SET NULL ON UPDATE CASCADE;
