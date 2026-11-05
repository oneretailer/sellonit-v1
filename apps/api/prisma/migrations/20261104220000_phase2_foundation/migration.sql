ALTER TYPE "BusinessRole" ADD VALUE IF NOT EXISTS 'STAFF';
ALTER TYPE "BusinessRole" ADD VALUE IF NOT EXISTS 'SUPPLIER';
ALTER TYPE "BusinessRole" ADD VALUE IF NOT EXISTS 'RETAILER';

ALTER TABLE "Business" ADD COLUMN "phone" TEXT;
ALTER TABLE "Business" ADD COLUMN "email" TEXT;

CREATE TYPE "SupplierProfileStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'REJECTED');
CREATE TYPE "RetailerAccess" AS ENUM ('OPEN', 'APPROVAL_REQUIRED', 'PRIVATE');

CREATE TABLE "SupplierProfile" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "legalName" TEXT,
  "description" TEXT,
  "contactPhone" TEXT,
  "originLocation" JSONB,
  "retailerAccess" "RetailerAccess" NOT NULL DEFAULT 'OPEN',
  "status" "SupplierProfileStatus" NOT NULL DEFAULT 'DRAFT',
  "submittedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "SupplierProfile_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "SupplierProfile_businessId_key" ON "SupplierProfile"("businessId");
ALTER TABLE "SupplierProfile"
  ADD CONSTRAINT "SupplierProfile_businessId_fkey"
  FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "Role" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Role_key_key" ON "Role"("key");

CREATE TABLE "Permission" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Permission_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Permission_key_key" ON "Permission"("key");

CREATE TABLE "RolePermission" (
  "roleId" TEXT NOT NULL,
  "permissionId" TEXT NOT NULL,
  CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("roleId", "permissionId"),
  CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "UserRoleAssignment" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "roleId" TEXT NOT NULL,
  "businessId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "UserRoleAssignment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "UserRoleAssignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserRoleAssignment_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "UserRoleAssignment_businessId_fkey" FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "UserRoleAssignment_userId_roleId_businessId_key" ON "UserRoleAssignment"("userId", "roleId", "businessId");
CREATE INDEX "UserRoleAssignment_businessId_idx" ON "UserRoleAssignment"("businessId");

CREATE TABLE "Plan" (
  "id" TEXT NOT NULL,
  "key" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "description" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "Plan_key_key" ON "Plan"("key");

CREATE TABLE "PlanTransition" (
  "id" TEXT NOT NULL,
  "fromPlanId" TEXT NOT NULL,
  "toPlanId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "PlanTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "PlanTransition_fromPlanId_fkey" FOREIGN KEY ("fromPlanId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "PlanTransition_toPlanId_fkey" FOREIGN KEY ("toPlanId") REFERENCES "Plan"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX "PlanTransition_fromPlanId_toPlanId_key" ON "PlanTransition"("fromPlanId", "toPlanId");
