-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "advisorTitle" TEXT,
ADD COLUMN     "hideBooking" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "infoRequestTitle" TEXT,
ADD COLUMN     "locationContent" TEXT,
ADD COLUMN     "locationTitle" TEXT,
ADD COLUMN     "promotionsTitle" TEXT,
ADD COLUMN     "showAdvisor" BOOLEAN NOT NULL DEFAULT true;
