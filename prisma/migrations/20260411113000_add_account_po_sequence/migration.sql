ALTER TABLE "Account"
ADD COLUMN "nextPurchaseOrderNumber" INTEGER NOT NULL DEFAULT 1;

UPDATE "Account" AS a
SET "nextPurchaseOrderNumber" = COALESCE(po_counts.purchase_order_count, 0) + 1
FROM (
  SELECT "accountId", COUNT(*)::INTEGER AS purchase_order_count
  FROM "PurchaseOrder"
  GROUP BY "accountId"
) AS po_counts
WHERE a."id" = po_counts."accountId";
