-- CreateTable
CREATE TABLE "Location" (
    "id" BIGSERIAL NOT NULL,
    "accountId" BIGINT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Location_accountId_isActive_idx" ON "Location"("accountId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "Location_accountId_code_key" ON "Location"("accountId", "code");

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
