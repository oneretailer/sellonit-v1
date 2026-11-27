-- DropForeignKey
ALTER TABLE "SupplierReviewEvent" DROP CONSTRAINT "SupplierReviewEvent_actorUserId_fkey";

-- AddForeignKey
ALTER TABLE "SupplierReviewEvent" ADD CONSTRAINT "SupplierReviewEvent_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
