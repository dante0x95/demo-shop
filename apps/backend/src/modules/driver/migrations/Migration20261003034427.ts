import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261003034427 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "driver_invite" drop constraint if exists "driver_invite_driver_id_unique";`);
    this.addSql(`alter table if exists "driver_invite" drop constraint if exists "driver_invite_token_hash_unique";`);
    this.addSql(`create table if not exists "driver_invite" ("id" text not null, "token_hash" text not null, "expires_at" timestamptz not null, "accepted_at" timestamptz null, "driver_id" text not null, "created_at" timestamptz not null default now(), "updated_at" timestamptz not null default now(), "deleted_at" timestamptz null, constraint "driver_invite_pkey" primary key ("id"));`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_driver_invite_token_hash_unique" ON "driver_invite" ("token_hash") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_driver_invite_driver_id_unique" ON "driver_invite" ("driver_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_driver_invite_deleted_at" ON "driver_invite" ("deleted_at") WHERE deleted_at IS NULL;`);

    this.addSql(`alter table if exists "driver_invite" add constraint "driver_invite_driver_id_foreign" foreign key ("driver_id") references "driver" ("id") on update cascade;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop table if exists "driver_invite" cascade;`);
  }

}
