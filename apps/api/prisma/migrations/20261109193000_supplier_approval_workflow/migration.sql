CREATE TABLE "SupplierStatusTransition" (
  "id" TEXT NOT NULL,
  "fromStatus" "SupplierProfileStatus" NOT NULL,
  "toStatus" "SupplierProfileStatus" NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SupplierStatusTransition_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "SupplierStatusTransition_fromStatus_toStatus_key"
    UNIQUE ("fromStatus", "toStatus")
);

ALTER TABLE "SupplierProfile"
  ADD COLUMN "reviewedAt" TIMESTAMP(3),
  ADD COLUMN "reviewedByUserId" TEXT;

ALTER TABLE "SupplierProfile"
  ADD CONSTRAINT "SupplierProfile_reviewedByUserId_fkey"
  FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "SupplierStatusTransition" ("id", "fromStatus", "toStatus")
VALUES
  (gen_random_uuid()::text, 'DRAFT', 'PENDING_REVIEW'),
  (gen_random_uuid()::text, 'PENDING_REVIEW', 'APPROVED'),
  (gen_random_uuid()::text, 'PENDING_REVIEW', 'REJECTED'),
  (gen_random_uuid()::text, 'APPROVED', 'SUSPENDED'),
  (gen_random_uuid()::text, 'SUSPENDED', 'APPROVED');
