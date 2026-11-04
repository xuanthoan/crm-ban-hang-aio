-- Supplier self rating: integer 0-10 (null = not rated yet) + optional
-- rating note. Hand-written in the same quoted-PascalCase style as the
-- other migrations. This migration only ADDS two nullable columns to
-- Supplier; it touches no existing column or data. The 0-10 range is
-- enforced by backend validation (no DB CHECK, mirroring other
-- validated-but-unconstrained fields like phone formats).

ALTER TABLE "Supplier" ADD COLUMN "rating" INTEGER;
ALTER TABLE "Supplier" ADD COLUMN "ratingNote" TEXT;
