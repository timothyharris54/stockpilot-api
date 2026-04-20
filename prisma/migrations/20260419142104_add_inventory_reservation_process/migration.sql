-- CreateEnum
CREATE TYPE "ReservationStatus" AS ENUM ('active', 'released', 'consumed', 'cancelled');

-- CreateEnum
CREATE TYPE "ReservationSourceType" AS ENUM ('sales_order', 'manual');

-- CreateTable
CREATE TABLE "InventoryReservation" (
    "id" BIGSERIAL NOT NULL,
    "accountId" BIGINT NOT NULL,
    "productId" BIGINT NOT NULL,
    "locationCode" TEXT NOT NULL,
    "sourceType" "ReservationSourceType" NOT NULL,
    "sourceId" BIGINT NOT NULL,
    "reservedQty" DECIMAL(12,2) NOT NULL,
    "status" "ReservationStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "releasedAt" TIMESTAMP(3),
    "consumedAt" TIMESTAMP(3),
    "notes" TEXT,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "InventoryReservation_accountId_productId_locationCode_statu_idx" ON "InventoryReservation"("accountId", "productId", "locationCode", "status");

-- CreateIndex
CREATE INDEX "InventoryReservation_accountId_sourceType_sourceId_idx" ON "InventoryReservation"("accountId", "sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "InventoryReservation_accountId_status_idx" ON "InventoryReservation"("accountId", "status");

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReservation" ADD CONSTRAINT "InventoryReservation_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
