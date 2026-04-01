/*
  Warnings:

  - A unique constraint covering the columns `[event,phone]` on the table `BotEvent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `phone` to the `BotEvent` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "BotEvent" ADD COLUMN     "phone" TEXT NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "BotEvent_event_phone_key" ON "BotEvent"("event", "phone");
