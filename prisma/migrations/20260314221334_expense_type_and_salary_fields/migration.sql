-- CreateEnum
CREATE TYPE "ExpenseType" AS ENUM ('OIL', 'MAINTENANCE', 'SALARY', 'OTHER');

-- CreateEnum
CREATE TYPE "SalaryExpenseRole" AS ENUM ('COLLECTOR', 'EMPLOYEE');

-- CreateTable
CREATE TABLE "Expenses" (
    "id" SERIAL NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "type" "ExpenseType" NOT NULL DEFAULT 'OTHER',
    "salaryRole" "SalaryExpenseRole",
    "description" TEXT NOT NULL,
    "incurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Expenses_type_idx" ON "Expenses"("type");

-- CreateIndex
CREATE INDEX "Expenses_salaryRole_idx" ON "Expenses"("salaryRole");

-- CreateIndex
CREATE INDEX "Expenses_incurredAt_idx" ON "Expenses"("incurredAt");

-- AddForeignKey
ALTER TABLE "Expenses" ADD CONSTRAINT "Expenses_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
