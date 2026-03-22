-- CreateTable
CREATE TABLE "PlanningSettings" (
    "id" SERIAL NOT NULL,
    "accountId" BIGINT NOT NULL,
    "demandOrderStatuses" TEXT[],
    "demandDateBasis" TEXT NOT NULL DEFAULT 'postedAt',
    "includeNegativeAdjustments" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlanningSettings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlanningSettings_accountId_key" ON "PlanningSettings"("accountId");

-- AddForeignKey
ALTER TABLE "PlanningSettings" ADD CONSTRAINT "PlanningSettings_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
