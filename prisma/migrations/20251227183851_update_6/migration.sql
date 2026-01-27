-- AlterTable
ALTER TABLE "Invoice" ADD COLUMN     "fixesAmount" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "fixesNote" TEXT;
