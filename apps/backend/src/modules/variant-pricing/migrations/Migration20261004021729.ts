import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261004021729 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "variant_price_detail" drop constraint if exists "variant_price_detail_variant_id_unique";`);
    this.addSql(`create table if not exists "variant_price_detail" ("id" text not null, "variant_id" text not null, "compare_at_amount" numeric null, "cost_amount" numeric null, "raw_compare_at_amount" jsonb null, "raw_cost_amount" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "variant_price_detail_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_variant_price_detail_deleted_at" ON "variant_price_detail" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_variant_price_detail_variant_id_unique" ON "variant_price_detail" ("variant_id") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "variant_price_detail" cascade;`);
  }

}
