ALTER TYPE "SupplierProfileStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';
CREATE TYPE "SupplierReviewAction" AS ENUM ('SUBMITTED', 'APPROVED', 'REJECTED', 'SUSPENDED', 'REINSTATED');

CREATE TABLE "SupplierReviewEvent" (
  "id" TEXT NOT NULL,
  "businessId" TEXT NOT NULL,
  "actorUserId" TEXT NOT NULL,
  "action" "SupplierReviewAction" NOT NULL,
  "fromStatus" "SupplierProfileStatus",
  "toStatus" "SupplierProfileStatus" NOT NULL,
  "reason" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierReviewEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierReviewEvent_businessId_fkey"
    FOREIGN KEY ("businessId") REFERENCES "Business"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "SupplierReviewEvent_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON UPDATE CASCADE
);
CREATE INDEX "SupplierReviewEvent_businessId_createdAt_idx"
  ON "SupplierReviewEvent"("businessId", "createdAt");
