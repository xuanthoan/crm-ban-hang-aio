-- Social links (Zalo / Facebook / Telegram / WhatsApp) for customers and
-- suppliers. Fixed set of 4 platforms, unlimited links per platform.
-- Hand-written in the same quoted-PascalCase style as the other
-- migrations: Prisma tables are the quoted PascalCase model names with
-- camelCase quoted columns, no @@map. This migration only ADDS one enum
-- and two tables; it touches no existing table, column or data.

-- CreateEnum
CREATE TYPE "SocialPlatform" AS ENUM ('zalo', 'facebook', 'telegram', 'whatsapp');

-- CreateTable
CREATE TABLE "CustomerSocialLink" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerSocialLink_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierSocialLink" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "platform" "SocialPlatform" NOT NULL,
    "url" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierSocialLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CustomerSocialLink_customerId_idx" ON "CustomerSocialLink"("customerId");
CREATE INDEX "SupplierSocialLink_supplierId_idx" ON "SupplierSocialLink"("supplierId");

-- AddForeignKey
ALTER TABLE "CustomerSocialLink" ADD CONSTRAINT "CustomerSocialLink_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SupplierSocialLink" ADD CONSTRAINT "SupplierSocialLink_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
