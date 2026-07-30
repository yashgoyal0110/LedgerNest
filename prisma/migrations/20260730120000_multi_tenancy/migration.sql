-- Multi-tenancy: every workspace becomes a tenant, every data row is scoped to it.

-- 1. Tenants
CREATE TABLE "tenants" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "is_demo" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "plan" TEXT NOT NULL DEFAULT 'free',
    "membership_expires_at" TIMESTAMP(3),
    "stripe_customer_id" TEXT,
    "ai_balance" INTEGER NOT NULL DEFAULT 5,
    "ai_credits_limit" INTEGER NOT NULL DEFAULT 5,
    "ai_refill_minutes" INTEGER,
    "ai_refilled_at" TIMESTAMP(3),
    "storage_used" INTEGER NOT NULL DEFAULT 0,
    "storage_limit" INTEGER NOT NULL DEFAULT -1,
    "storage_prefix" TEXT NOT NULL,
    "business_name" TEXT,
    "business_address" TEXT,
    "business_bank_details" TEXT,
    "business_logo" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "tenants_slug_key" ON "tenants"("slug");
CREATE UNIQUE INDEX "tenants_storage_prefix_key" ON "tenants"("storage_prefix");
CREATE INDEX "tenants_is_demo_idx" ON "tenants"("is_demo");

-- 2. Users belong to a tenant
ALTER TABLE "users" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "users" ADD COLUMN "role" TEXT NOT NULL DEFAULT 'owner';

-- One tenant per existing user, carrying over their plan, quota and business profile.
-- The tenant reuses the user's uuid as its primary key, so the backfill below is an exact join.
INSERT INTO "tenants" (
    "id", "slug", "name", "plan", "membership_expires_at", "stripe_customer_id",
    "ai_balance", "ai_credits_limit", "storage_used", "storage_limit", "storage_prefix",
    "business_name", "business_address", "business_bank_details", "business_logo",
    "created_at", "updated_at"
)
SELECT
    u."id",
    -- slug from the local part of the email, de-duplicated with a short id suffix
    regexp_replace(lower(split_part(u."email", '@', 1)), '[^a-z0-9]+', '-', 'g')
        || '-' || substr(replace(u."id"::text, '-', ''), 1, 6),
    COALESCE(NULLIF(u."business_name", ''), NULLIF(u."name", ''), u."email"),
    COALESCE(u."membership_plan", 'free'),
    u."membership_expires_at",
    u."stripe_customer_id",
    GREATEST(u."ai_balance", 0),
    GREATEST(u."ai_balance", 5),
    u."storage_used",
    u."storage_limit",
    -- Uploads already live under a directory named after the user's email; keep it.
    u."email",
    u."business_name",
    u."business_address",
    u."business_bank_details",
    u."business_logo",
    u."created_at",
    CURRENT_TIMESTAMP
FROM "users" u;

UPDATE "users" u SET "tenant_id" = t."id" FROM "tenants" t WHERE t."id" = u."id";

ALTER TABLE "users" ALTER COLUMN "tenant_id" SET NOT NULL;
CREATE INDEX "users_tenant_id_idx" ON "users"("tenant_id");
ALTER TABLE "users" ADD CONSTRAINT "users_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- 3. Scope every data table to a tenant, backfilling from the owning user.
ALTER TABLE "settings" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "categories" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "projects" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "fields" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "files" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "transactions" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "currencies" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "app_data" ADD COLUMN "tenant_id" UUID;
ALTER TABLE "progress" ADD COLUMN "tenant_id" UUID;

UPDATE "settings" s SET "tenant_id" = u."tenant_id" FROM "users" u WHERE u."id" = s."user_id";
UPDATE "categories" c SET "tenant_id" = u."tenant_id" FROM "users" u WHERE u."id" = c."user_id";
UPDATE "projects" p SET "tenant_id" = u."tenant_id" FROM "users" u WHERE u."id" = p."user_id";
UPDATE "fields" f SET "tenant_id" = u."tenant_id" FROM "users" u WHERE u."id" = f."user_id";
UPDATE "files" f SET "tenant_id" = u."tenant_id" FROM "users" u WHERE u."id" = f."user_id";
UPDATE "transactions" t SET "tenant_id" = u."tenant_id" FROM "users" u WHERE u."id" = t."user_id";
UPDATE "currencies" c SET "tenant_id" = u."tenant_id" FROM "users" u WHERE u."id" = c."user_id";
UPDATE "app_data" a SET "tenant_id" = u."tenant_id" FROM "users" u WHERE u."id" = a."user_id";
UPDATE "progress" p SET "tenant_id" = u."tenant_id" FROM "users" u WHERE u."id" = p."user_id";

ALTER TABLE "settings" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "categories" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "projects" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "fields" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "files" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "transactions" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "app_data" ALTER COLUMN "tenant_id" SET NOT NULL;
ALTER TABLE "progress" ALTER COLUMN "tenant_id" SET NOT NULL;
-- currencies.tenant_id stays nullable, mirroring the previously nullable user_id.

-- 4. Uniqueness moves from (user, code) to (tenant, code): data is shared inside a workspace.
--    The transactions -> categories/projects foreign keys have to be dropped first.
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_category_code_user_id_fkey";
ALTER TABLE "transactions" DROP CONSTRAINT IF EXISTS "transactions_project_code_user_id_fkey";

DROP INDEX IF EXISTS "settings_user_id_code_key";
DROP INDEX IF EXISTS "categories_user_id_code_key";
DROP INDEX IF EXISTS "projects_user_id_code_key";
DROP INDEX IF EXISTS "fields_user_id_code_key";
DROP INDEX IF EXISTS "currencies_user_id_code_key";
DROP INDEX IF EXISTS "app_data_user_id_app_key";

-- Members of the same tenant may have created rows with the same code; keep the oldest.
DELETE FROM "settings" a USING "settings" b
    WHERE a."tenant_id" = b."tenant_id" AND a."code" = b."code" AND a.ctid > b.ctid;
DELETE FROM "categories" a USING "categories" b
    WHERE a."tenant_id" = b."tenant_id" AND a."code" = b."code" AND a.ctid > b.ctid;
DELETE FROM "projects" a USING "projects" b
    WHERE a."tenant_id" = b."tenant_id" AND a."code" = b."code" AND a.ctid > b.ctid;
DELETE FROM "fields" a USING "fields" b
    WHERE a."tenant_id" = b."tenant_id" AND a."code" = b."code" AND a.ctid > b.ctid;
DELETE FROM "currencies" a USING "currencies" b
    WHERE a."tenant_id" IS NOT DISTINCT FROM b."tenant_id" AND a."code" = b."code" AND a.ctid > b.ctid;
DELETE FROM "app_data" a USING "app_data" b
    WHERE a."tenant_id" = b."tenant_id" AND a."app" = b."app" AND a.ctid > b.ctid;

CREATE UNIQUE INDEX "settings_tenant_id_code_key" ON "settings"("tenant_id", "code");
CREATE UNIQUE INDEX "categories_tenant_id_code_key" ON "categories"("tenant_id", "code");
CREATE UNIQUE INDEX "projects_tenant_id_code_key" ON "projects"("tenant_id", "code");
CREATE UNIQUE INDEX "fields_tenant_id_code_key" ON "fields"("tenant_id", "code");
CREATE UNIQUE INDEX "currencies_tenant_id_code_key" ON "currencies"("tenant_id", "code");
CREATE UNIQUE INDEX "app_data_tenant_id_app_key" ON "app_data"("tenant_id", "app");

CREATE INDEX "settings_user_id_idx" ON "settings"("user_id");
CREATE INDEX "categories_user_id_idx" ON "categories"("user_id");
CREATE INDEX "projects_user_id_idx" ON "projects"("user_id");
CREATE INDEX "fields_user_id_idx" ON "fields"("user_id");
CREATE INDEX "currencies_user_id_idx" ON "currencies"("user_id");
CREATE INDEX "app_data_user_id_idx" ON "app_data"("user_id");
CREATE INDEX "files_tenant_id_idx" ON "files"("tenant_id");
CREATE INDEX "transactions_tenant_id_idx" ON "transactions"("tenant_id");
CREATE INDEX "progress_tenant_id_idx" ON "progress"("tenant_id");

-- 5. Foreign keys
ALTER TABLE "settings" ADD CONSTRAINT "settings_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "categories" ADD CONSTRAINT "categories_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "projects" ADD CONSTRAINT "projects_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "fields" ADD CONSTRAINT "fields_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "files" ADD CONSTRAINT "files_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "currencies" ADD CONSTRAINT "currencies_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "app_data" ADD CONSTRAINT "app_data_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "progress" ADD CONSTRAINT "progress_tenant_id_fkey"
    FOREIGN KEY ("tenant_id") REFERENCES "tenants"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "transactions" ADD CONSTRAINT "transactions_category_code_tenant_id_fkey"
    FOREIGN KEY ("category_code", "tenant_id") REFERENCES "categories"("code", "tenant_id")
    ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "transactions" ADD CONSTRAINT "transactions_project_code_tenant_id_fkey"
    FOREIGN KEY ("project_code", "tenant_id") REFERENCES "projects"("code", "tenant_id")
    ON DELETE SET NULL ON UPDATE CASCADE;

-- 6. Plan, quota and business identity are tenant-level now; drop the per-user copies.
ALTER TABLE "users" DROP COLUMN "stripe_customer_id";
ALTER TABLE "users" DROP COLUMN "membership_plan";
ALTER TABLE "users" DROP COLUMN "membership_expires_at";
ALTER TABLE "users" DROP COLUMN "storage_used";
ALTER TABLE "users" DROP COLUMN "storage_limit";
ALTER TABLE "users" DROP COLUMN "ai_balance";
ALTER TABLE "users" DROP COLUMN "business_name";
ALTER TABLE "users" DROP COLUMN "business_address";
ALTER TABLE "users" DROP COLUMN "business_bank_details";
ALTER TABLE "users" DROP COLUMN "business_logo";
