-- CreateEnum
CREATE TYPE "AdjustmentReasonCodes" AS ENUM ('cycle_count', 'damage', 'expired', 'shrinkage', 'opening_balance', 'manual_correction');

-- AlterTable
ALTER TABLE "Account" ALTER COLUMN "nextPurchaseOrderNumber" SET DEFAULT 1000;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "locationCode" TEXT NOT NULL DEFAULT 'MAIN';
