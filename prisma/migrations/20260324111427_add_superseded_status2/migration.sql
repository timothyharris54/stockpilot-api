/*
  Warnings:

  - The values [superceded] on the enum `RecommendationStatus` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "RecommendationStatus_new" AS ENUM ('open', 'reviewed', 'converted', 'dismissed', 'superseded');
ALTER TABLE "public"."ReorderRecommendation" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "ReorderRecommendation" ALTER COLUMN "status" TYPE "RecommendationStatus_new" USING ("status"::text::"RecommendationStatus_new");
ALTER TYPE "RecommendationStatus" RENAME TO "RecommendationStatus_old";
ALTER TYPE "RecommendationStatus_new" RENAME TO "RecommendationStatus";
DROP TYPE "public"."RecommendationStatus_old";
ALTER TABLE "ReorderRecommendation" ALTER COLUMN "status" SET DEFAULT 'open';
COMMIT;
