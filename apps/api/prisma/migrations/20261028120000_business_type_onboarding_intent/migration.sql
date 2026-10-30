-- Persist the onboarding choice and use it to classify each business.
CREATE TYPE "BusinessType" AS ENUM ('RETAILER', 'ENTREPRENEUR', 'ENTERPRISE');

ALTER TABLE "User"
ADD COLUMN "onboardingIntent" "BusinessType";

ALTER TABLE "Business"
ADD COLUMN "type" "BusinessType" NOT NULL DEFAULT 'RETAILER';
