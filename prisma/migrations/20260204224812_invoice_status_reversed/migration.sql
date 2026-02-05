-- Add reversed statuses to InvoiceStatus enum
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'REVERSED_PARTIAL';
ALTER TYPE "InvoiceStatus" ADD VALUE IF NOT EXISTS 'REVERSED_FULL';
