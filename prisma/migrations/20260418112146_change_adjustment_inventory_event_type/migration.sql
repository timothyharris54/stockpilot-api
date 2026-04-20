/*
  Warnings:

  - The values [adjustment_gain,adjustment_loss] on the enum `InventoryEventType` will be removed. 
  If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "InventoryEventType_new" AS ENUM ('opening_balance', 'sale', 'sale_reversal', 'receipt', 'adjustment', 'return_resellable', 'sync_correction');
ALTER TABLE "InventoryLedger" ALTER COLUMN "eventType" TYPE "InventoryEventType_new" USING ("eventType"::text::"InventoryEventType_new");
ALTER TYPE "InventoryEventType" RENAME TO "InventoryEventType_old";
ALTER TYPE "InventoryEventType_new" RENAME TO "InventoryEventType";
DROP TYPE "public"."InventoryEventType_old";
COMMIT;
