/*
  Warnings:

  - You are about to drop the column `collectorId` on the `Payment` table. All the data in the column will be lost.
  - Added the required column `receiverId` to the `Payment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `receiverType` to the `Payment` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "PaymentReceiverType" AS ENUM ('COLLECTOR', 'EMPLOYEE', 'OWNER');

-- DropForeignKey
ALTER TABLE "Payment" DROP CONSTRAINT "Payment_collectorId_fkey";

-- AlterTable
ALTER TABLE "Payment" DROP COLUMN "collectorId",
ADD COLUMN     "receiverId" INTEGER NOT NULL,
ADD COLUMN     "receiverType" "PaymentReceiverType" NOT NULL;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_receiverId_fkey" FOREIGN KEY ("receiverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
