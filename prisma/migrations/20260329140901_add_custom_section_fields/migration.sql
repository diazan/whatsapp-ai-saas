/*
  Warnings:

  - You are about to drop the column `showTestimonials` on the `Clinic` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Clinic" DROP COLUMN "showTestimonials",
ADD COLUMN     "customSectionContent" TEXT,
ADD COLUMN     "customSectionTitle" TEXT,
ADD COLUMN     "showCustomSection" BOOLEAN NOT NULL DEFAULT true;
