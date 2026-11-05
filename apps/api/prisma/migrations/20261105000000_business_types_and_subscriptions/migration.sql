CREATE TYPE "BusinessType_new" AS ENUM ('RETAILER', 'SUPPLIER');

ALTER TABLE "Business" ALTER COLUMN "type" DROP DEFAULT;

ALTER TABLE "User"
  ALTER COLUMN "onboardingIntent" TYPE "BusinessType_new"
  USING (
    CASE
      WHEN "onboardingIntent"::text IN ('ENTERPRISE', 'SUPPLIER') THEN 'SUPPLIER'
      WHEN "onboardingIntent"::text = 'RETAILER' THEN 'RETAILER'
      ELSE NULL
    END
  )::"BusinessType_new";

ALTER TABLE "Business"
  ALTER COLUMN "type" TYPE "BusinessType_new"
  USING (
    CASE
      WHEN "type"::text IN ('ENTERPRISE', 'SUPPLIER') THEN 'SUPPLIER'
      ELSE 'RETAILER'
    END
  )::"BusinessType_new";

DROP TYPE "BusinessType";
ALTER TYPE "BusinessType_new" RENAME TO "BusinessType";
ALTER TABLE "Business" ALTER COLUMN "type" SET DEFAULT 'RETAILER';

CREATE TYPE "BusinessRole_new" AS ENUM ('OWNER', 'MANAGER', 'STAFF');

ALTER TABLE "Membership" ALTER COLUMN "role" DROP DEFAULT;

ALTER TABLE "Membership"
  ALTER COLUMN "role" TYPE "BusinessRole_new"
  USING (
    CASE
      WHEN "role"::text = 'OWNER' THEN 'OWNER'
      WHEN "role"::text = 'ADMIN' THEN 'MANAGER'
      ELSE 'STAFF'
    END
  )::"BusinessRole_new";

DROP TYPE "BusinessRole";
ALTER TYPE "BusinessRole_new" RENAME TO "BusinessRole";
ALTER TABLE "Membership" ALTER COLUMN "role" SET DEFAULT 'STAFF';

CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'CANCELLED', 'EXPIRED');

CREATE TABLE "BusinessSubscription" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "startsAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "endsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "BusinessSubscription_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "BusinessSubscription_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "BusinessSubscription_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "BusinessSubscription_businessId_key"
  ON "BusinessSubscription"("businessId");
CREATE INDEX "BusinessSubscription_planId_idx"
  ON "BusinessSubscription"("planId");
