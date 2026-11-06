-- DropForeignKey
ALTER TABLE "BusinessSubscription" DROP CONSTRAINT "BusinessSubscription_planId_fkey";

-- AddForeignKey
ALTER TABLE "BusinessSubscription" ADD CONSTRAINT "BusinessSubscription_planId_fkey" FOREIGN KEY ("planId") REFERENCES "Plan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
