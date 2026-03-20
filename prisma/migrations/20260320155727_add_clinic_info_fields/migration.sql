-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "address" TEXT,
ADD COLUMN     "businessHours" TEXT,
ADD COLUMN     "promotions" TEXT,
ADD COLUMN     "showTestimonials" BOOLEAN NOT NULL DEFAULT true;
