-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "adminPhone" TEXT;

-- AlterTable
ALTER TABLE "SalesDemoRequest" ADD COLUMN     "meetLink" TEXT,
ADD COLUMN     "meetLinkSentAt" TIMESTAMP(3),
ADD COLUMN     "notificationsActive" BOOLEAN NOT NULL DEFAULT true;
