import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261002141955 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "metafield_definition" drop constraint if exists "metafield_definition_owner_type_key_unique";`);
    this.addSql(`create table if not exists "metafield_definition" ("id" text not null, "key" text not null, "label" text not null, "type" text check ("type" in ('text', 'number', 'boolean', 'select')) not null, "options" jsonb null, "owner_type" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "metafield_definition_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_metafield_definition_deleted_at" ON "metafield_definition" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_metafield_definition_owner_type_key_unique" ON "metafield_definition" ("owner_type", "key") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "metafield_definition" cascade;`);
  }

}
