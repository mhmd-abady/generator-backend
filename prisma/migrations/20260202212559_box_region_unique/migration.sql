-- Add regionId to boxes with backfill for existing rows
ALTER TABLE "Box" ADD COLUMN "regionId" INTEGER;

UPDATE "Box" b
SET "regionId" = n."regionId"
FROM "Neighborhood" n
WHERE b."neighborhoodId" = n."id" AND b."regionId" IS NULL;

ALTER TABLE "Box" ALTER COLUMN "regionId" SET NOT NULL;

ALTER TABLE "Box" ADD CONSTRAINT "Box_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE UNIQUE INDEX "Box_regionId_code_key" ON "Box"("regionId", "code");
