import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261004021750 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "metafield_value" drop constraint if exists "metafield_value_owner_type_owner_id_key_unique";`);
    this.addSql(`create table if not exists "metafield_value" ("id" text not null, "owner_type" text not null, "owner_id" text not null, "key" text not null, "type" text check ("type" in ('text', 'number', 'boolean', 'select')) not null, "value" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "metafield_value_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_metafield_value_deleted_at" ON "metafield_value" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_metafield_value_owner_type_owner_id_key_unique" ON "metafield_value" ("owner_type", "owner_id", "key") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_metafield_value_owner_type_key" ON "metafield_value" ("owner_type", "key") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "metafield_definition" add column if not exists "storefront_access" boolean not null default false;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "metafield_value" cascade;`);

    this.addSql(`alter table if exists "metafield_definition" drop column if exists "storefront_access";`);
  }

}
