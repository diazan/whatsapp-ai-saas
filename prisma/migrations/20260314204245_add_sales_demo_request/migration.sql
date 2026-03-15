/*
  Warnings:

  - A unique constraint covering the columns `[email]` on the table `Clinic` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Clinic" ADD COLUMN     "email" TEXT,
ADD COLUMN     "passwordHash" TEXT;

-- CreateTable
CREATE TABLE "SalesDemoRequest" (
    "id" TEXT NOT NULL,
    "clinicId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "preferredAt" TIMESTAMP(3) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SalesDemoRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SalesDemoRequest_clinicId_idx" ON "SalesDemoRequest"("clinicId");

-- CreateIndex
CREATE INDEX "SalesDemoRequest_status_idx" ON "SalesDemoRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Clinic_email_key" ON "Clinic"("email");

-- AddForeignKey
ALTER TABLE "SalesDemoRequest" ADD CONSTRAINT "SalesDemoRequest_clinicId_fkey" FOREIGN KEY ("clinicId") REFERENCES "Clinic"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
