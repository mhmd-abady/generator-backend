-- CreateEnum
CREATE TYPE "MeterStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'BROKEN', 'REPLACED', 'DISCONNECTED');

-- DropIndex
DROP INDEX "Meter_subscriberId_key";

-- AlterTable
ALTER TABLE "Meter" ADD COLUMN     "status" "MeterStatus" NOT NULL DEFAULT 'ACTIVE';
