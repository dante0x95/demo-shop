import { Migration } from "@medusajs/framework/mikro-orm/migrations";

export class Migration20261004021821 extends Migration {

  override async up(): Promise<void> {
    this.addSql(`alter table if exists "driver_invite" drop constraint if exists "driver_invite_driver_id_pending_unique";`);
    this.addSql(`drop index if exists "IDX_driver_invite_driver_id_unique";`);

    this.addSql(`alter table if exists "driver_invite" add column if not exists "status" text check ("status" in ('pending', 'accepted', 'revoked', 'expired')) not null default 'pending';`);
    // T14.1 invitations: used ones are accepted; the rest stay pending (an
    // unused one past expires_at already reads as expired).
    this.addSql(`update "driver_invite" set "status" = 'accepted' where "accepted_at" is not null;`);
    this.addSql(`CREATE INDEX IF NOT EXISTS "IDX_driver_invite_driver_id" ON "driver_invite" ("driver_id") WHERE deleted_at IS NULL;`);
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_driver_invite_driver_id_pending_unique" ON "driver_invite" ("driver_id") WHERE status = 'pending' AND deleted_at IS NULL;`);
  }

  override async down(): Promise<void> {
    this.addSql(`drop index if exists "IDX_driver_invite_driver_id";`);
    this.addSql(`drop index if exists "IDX_driver_invite_driver_id_pending_unique";`);
    this.addSql(`alter table if exists "driver_invite" drop column if exists "status";`);

    // Fails if a driver has several invitations: T14.1 allowed only one.
    this.addSql(`CREATE UNIQUE INDEX IF NOT EXISTS "IDX_driver_invite_driver_id_unique" ON "driver_invite" ("driver_id") WHERE deleted_at IS NULL;`);
  }

}
