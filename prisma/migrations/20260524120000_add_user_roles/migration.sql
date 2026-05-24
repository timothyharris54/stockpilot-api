CREATE TYPE "UserRoleCode" AS ENUM ('executive', 'purchasing_manager', 'buyer', 'planner', 'system_admin');

CREATE TABLE "Role" (
    "id" BIGSERIAL NOT NULL,
    "code" "UserRoleCode" NOT NULL,
    "displayName" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "UserRole" (
    "id" BIGSERIAL NOT NULL,
    "accountId" BIGINT NOT NULL,
    "userId" BIGINT NOT NULL,
    "roleId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");
CREATE UNIQUE INDEX "UserRole_accountId_userId_roleId_key" ON "UserRole"("accountId", "userId", "roleId");
CREATE INDEX "UserRole_accountId_roleId_idx" ON "UserRole"("accountId", "roleId");

ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "Role" ("code", "displayName", "description", "updatedAt") VALUES
  ('executive', 'Executive', 'Executive dashboard and organizational visibility.', CURRENT_TIMESTAMP),
  ('purchasing_manager', 'Purchasing Manager', 'Purchasing oversight, approvals, and team workload.', CURRENT_TIMESTAMP),
  ('buyer', 'Buyer', 'Buyer queue, purchase orders, and supplier follow-up.', CURRENT_TIMESTAMP),
  ('planner', 'Planner', 'Inventory planning, demand, and replenishment activity.', CURRENT_TIMESTAMP),
  ('system_admin', 'System Admin', 'User maintenance, configuration, and integration health.', CURRENT_TIMESTAMP);

INSERT INTO "UserRole" ("accountId", "userId", "roleId")
SELECT u."accountId", u."id", r."id"
FROM "User" u
CROSS JOIN "Role" r
WHERE r."code" = 'system_admin'
ON CONFLICT DO NOTHING;
