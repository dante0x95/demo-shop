import { MedusaContainer } from "@medusajs/framework/types"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"

export const ORDER_DRIVER_UNIQUE_ORDER_INDEX = "IDX_order_driver_unique_order_id"

// An order has at most one driver. The link definition (isList on order) only
// checks this before inserting, and the generated link table has a composite
// (order_id, driver_id) key, so concurrent assignments can both succeed.
// This unique index on the active rows enforces the rule in the database.
//
// Link tables are created by the link sync, which runs after module migrations
// but before migration scripts, so the index is added here rather than in the
// driver module's migrations.
export default async function orderDriverUniqueOrder({
  container,
}: {
  container: MedusaContainer
}) {
  const pg = container.resolve(ContainerRegistrationKeys.PG_CONNECTION)

  const { rows: tables } = await pg.raw(
    `SELECT table_name FROM link_module_migrations
     WHERE link_descriptor->>'fromModule' = 'order'
       AND link_descriptor->>'fromModel' = 'order'
       AND link_descriptor->>'toModule' = 'driver'
       AND link_descriptor->>'toModel' = 'driver'`
  )

  if (tables.length !== 1) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      "The order-driver link table was not found; run the link sync first"
    )
  }

  const tableName: string = tables[0].table_name

  const { rows: duplicates } = await pg.raw(
    `SELECT order_id FROM ?? WHERE deleted_at IS NULL
     GROUP BY order_id HAVING count(*) > 1 LIMIT 5`,
    [tableName]
  )

  if (duplicates.length) {
    throw new MedusaError(
      MedusaError.Types.UNEXPECTED_STATE,
      `Orders linked to more than one driver: ${duplicates
        .map((row) => row.order_id)
        .join(", ")}. Remove the extra links, then run the migrations again.`
    )
  }

  await pg.raw(
    `CREATE UNIQUE INDEX IF NOT EXISTS ?? ON ?? (order_id) WHERE deleted_at IS NULL`,
    [ORDER_DRIVER_UNIQUE_ORDER_INDEX, tableName]
  )
}
