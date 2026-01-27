/*
  Warnings:

  - A unique constraint covering the columns `[regionId,neighborhoodId,month,year]` on the table `Tariff` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Tariff_month_year_key";

-- AlterTable
ALTER TABLE "Tariff" ADD COLUMN     "neighborhoodId" INTEGER,
ADD COLUMN     "regionId" INTEGER;

-- CreateIndex
CREATE INDEX "Tariff_month_year_idx" ON "Tariff"("month", "year");

-- CreateIndex
CREATE UNIQUE INDEX "Tariff_regionId_neighborhoodId_month_year_key" ON "Tariff"("regionId", "neighborhoodId", "month", "year");

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Tariff" ADD CONSTRAINT "Tariff_neighborhoodId_fkey" FOREIGN KEY ("neighborhoodId") REFERENCES "Neighborhood"("id") ON DELETE SET NULL ON UPDATE CASCADE;
