-- Tag cho nhà cung cấp (giống tag khách hàng: bảng tag + bảng gán,
-- tên tag duy nhất, xóa mềm; một NCC gán được nhiều tag, một tag gán
-- được cho nhiều NCC). Hand-written in the same quoted-PascalCase
-- style as the other migrations: Prisma tables are the quoted
-- PascalCase model names with camelCase quoted columns, no @@map.
-- This migration only ADDS two tables; it touches no existing table,
-- column or data.

-- CreateTable
CREATE TABLE "SupplierTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "SupplierTag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierTag_name_key" ON "SupplierTag"("name");

-- CreateTable
CREATE TABLE "SupplierTagAssignment" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierTagAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierTagAssignment_supplierId_tagId_key" ON "SupplierTagAssignment"("supplierId","tagId");

-- AddForeignKey
ALTER TABLE "SupplierTagAssignment" ADD CONSTRAINT "SupplierTagAssignment_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierTagAssignment" ADD CONSTRAINT "SupplierTagAssignment_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "SupplierTag"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
