-- CreateTable
CREATE TABLE "AmperePricing" (
    "id" SERIAL NOT NULL,
    "ampere" INTEGER NOT NULL,
    "price" DOUBLE PRECISION NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AmperePricing_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AmperePricing_ampere_key" ON "AmperePricing"("ampere");

-- CreateIndex
CREATE INDEX "AmperePricing_isActive_idx" ON "AmperePricing"("isActive");
