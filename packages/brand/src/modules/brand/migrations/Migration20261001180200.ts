import { Migration } from "@medusajs/framework/mikro-orm/migrations"

// Hand-written: the data model DSL can't express an expression index, so this
// index is not in .snapshot-brand.json. Brand names are unique ignoring case
// among non-deleted brands; the workflow check alone can't enforce it under concurrency.
export class Migration20261001180200 extends Migration {
  override async up(): Promise<void> {
    this.addSql(
      `CREATE UNIQUE INDEX IF NOT EXISTS "IDX_brand_name_lower_unique" ON "brand" (lower("name")) WHERE deleted_at IS NULL;`
    )
  }

  override async down(): Promise<void> {
    this.addSql(`DROP INDEX IF EXISTS "IDX_brand_name_lower_unique";`)
  }
}
