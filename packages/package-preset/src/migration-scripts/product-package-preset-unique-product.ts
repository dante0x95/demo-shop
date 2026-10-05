import { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { PACKAGE_PRESET_MODULE } from "../modules/package-preset"

export const PRODUCT_PACKAGE_PRESET_UNIQUE_PRODUCT_INDEX =
  "IDX_product_package_preset_unique_product_id"

// A product has at most one package preset. The link definition (isList on
// product) only checks this before inserting, and the generated link table has
// a composite (product_id, package_preset_id) key, so concurrent link.create
// calls can both succeed. This unique index on the active rows enforces the
// rule in the database.
//
// Link tables are created by the link sync, which runs after module migrations
// but before migration scripts, so the index is added here rather than in the
// package-preset module's migrations.
export default async function productPackagePresetUniqueProduct({
  container,
}: {
  container: MedusaContainer
}) {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const { rows: tables } = await pg.raw(
    `SELECT table_name FROM link_module_migrations
     WHERE link_descriptor->>'fromModule' = 'product'
       AND link_descriptor->>'fromModel' = 'product'
       AND link_descriptor->>'toModule' = ?
       AND link_descriptor->>'toModel' = 'package_preset'`,
    [PACKAGE_PRESET_MODULE]
  )

  if (tables.length !== 1) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "The product-package preset link table was not found; run the link sync first"
    )
  }

  const tableName: string = tables[0].table_name

  const { rows: duplicates } = await pg.raw(
    `SELECT product_id FROM ?? WHERE deleted_at IS NULL
     GROUP BY product_id HAVING count(*) > 1 LIMIT 5`,
    [tableName]
  )

  if (duplicates.length) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Products linked to more than one package preset: ${duplicates
        .map((row) => row.product_id)
        .join(", ")}. Remove the extra links, then run the migrations again.`
    )
  }

  await pg.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS ?? ON ?? (product_id) WHERE deleted_at IS NULL`,
    [PRODUCT_PACKAGE_PRESET_UNIQUE_PRODUCT_INDEX, tableName]
  )
}
