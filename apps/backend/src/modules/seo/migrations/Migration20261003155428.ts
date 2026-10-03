import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261003155428 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "product_seo_override" drop constraint if exists "product_seo_override_product_id_unique";`);
    this.addSql(`create table if not exists "product_seo_override" ("id" text not null, "product_id" text not null, "title" text null, "description" text null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "product_seo_override_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_product_seo_override_deleted_at" ON "product_seo_override" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_product_seo_override_product_id_unique" ON "product_seo_override" ("product_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "product_seo_override" cascade;`);
  }

}
