import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261003021039 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "package_preset" drop constraint if exists "package_preset_is_default_unique";`);
    this.addSql(`create table if not exists "package_preset" ("id" text not null, "name" text not null, "length" real not null, "width" real not null, "height" real not null, "dimension_unit" text check ("dimension_unit" in ('mm', 'cm', 'in')) not null, "weight" real not null, "weight_unit" text check ("weight_unit" in ('g', 'kg', 'oz', 'lb')) not null, "is_default" boolean not null default false, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "package_preset_pkey" primary key ("id"));`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_package_preset_deleted_at" ON "package_preset" ("deleted_at") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_package_preset_is_default_unique" ON "package_preset" ("is_default") WHERE is_default IS TRUE AND deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "package_preset" cascade;`);
  }

}
