import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261002141427 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "driver" drop constraint if exists "driver_email_unique";`);
    this.addSql(`create table if not exists "driver" ("id" text not null, "first_name" text not null, "last_name" text not null, "email" text not null, "phone" text not null, "vehicle_type" text check ("vehicle_type" in ('motorcycle', 'car', 'bicycle')) not null, "license_plate" text null, "is_active" boolean not null default false, "metadata" jsonb null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "driver_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_driver_email_unique" ON "driver" ("email") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_driver_deleted_at" ON "driver" ("deleted_at") WHERE deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "driver" cascade;`);
  }

}
