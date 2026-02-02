/*
  Warnings:

  - A unique constraint covering the columns `[subscriberId]` on the table `Meter` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "Meter_subscriberId_key" ON "Meter"("subscriberId");
