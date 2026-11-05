-- Add "website" to the SocialPlatform enum. ALTER TYPE ... ADD VALUE
-- cannot run inside a transaction block, and prisma migrate deploy
-- wraps each migration in one, so the enum is rebuilt instead (the
-- standard workaround): rename the old type, create the new one with
-- the extra value, retype both link columns, drop the old type.
-- No data changes: every existing value maps 1:1 to the new type.

ALTER TYPE "SocialPlatform" RENAME TO "SocialPlatform_old";
CREATE TYPE "SocialPlatform" AS ENUM ('zalo', 'facebook', 'telegram', 'whatsapp', 'viber', 'website');
ALTER TABLE "CustomerSocialLink" ALTER COLUMN "platform" TYPE "SocialPlatform" USING "platform"::text::"SocialPlatform";
ALTER TABLE "SupplierSocialLink" ALTER COLUMN "platform" TYPE "SocialPlatform" USING "platform"::text::"SocialPlatform";
DROP TYPE "SocialPlatform_old";
