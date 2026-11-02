-- Sprint NCC-1: supplier directory (Supplier + SupplierPhone).
-- Hand-written in the same quoted-PascalCase style as the init migration:
-- Prisma tables are the quoted PascalCase model names with camelCase
-- quoted columns, no @@map. This migration only ADDS tables; it touches
-- no existing table, column or data. PurchaseOrder / SupplierPayment
-- tables arrive with Sprint NCC-2 / NCC-3.

-- CreateEnum
CREATE TYPE "SupplierStatus" AS ENUM ('active', 'inactive');

-- CreateEnum
CREATE TYPE "SupplierPhoneStatus" AS ENUM ('active', 'inactive');

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "taxCode" TEXT,
    "email" TEXT,
    "address" TEXT,
    "note" TEXT,
    "status" "SupplierStatus" NOT NULL DEFAULT 'active',
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPhone" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "phoneNormalized" TEXT NOT NULL,
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "label" TEXT,
    "status" "SupplierPhoneStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierPhone_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_taxCode_key" ON "Supplier"("taxCode");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierPhone_supplierId_phoneNormalized_key" ON "SupplierPhone"("supplierId", "phoneNormalized");

-- CreateIndex
CREATE INDEX "SupplierPhone_phoneNormalized_idx" ON "SupplierPhone"("phoneNormalized");

-- AddForeignKey
ALTER TABLE "Supplier" ADD CONSTRAINT "Supplier_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPhone" ADD CONSTRAINT "SupplierPhone_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
