-- Product images: gallery per product + one thumbnail per SKU.
-- Hand-written in the same quoted-PascalCase style as the other
-- migrations: Prisma tables are the quoted PascalCase model names with
-- camelCase quoted columns, no @@map. This migration only ADDS one
-- table; it touches no existing table, column or data.

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "fileName" TEXT NOT NULL,
    "originalName" TEXT,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProductImage_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ProductImage_productId_idx" ON "ProductImage"("productId");
CREATE INDEX "ProductImage_variantId_idx" ON "ProductImage"("variantId");

-- AddForeignKey
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ProductImage" ADD CONSTRAINT "ProductImage_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
