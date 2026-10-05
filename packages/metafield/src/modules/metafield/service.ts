import { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import { SqlEntityManager } from "@medusajs/framework/mikro-orm/postgresql"
import MetafieldDefinition, {
  MetafieldType,
} from "./models/metafield-definition"
import MetafieldValue from "./models/metafield-value"
import {
  MetafieldModuleOptions,
  ResolvedMetafieldModuleOptions,
  resolveMetafieldModuleOptions,
} from "./utils/options"

export type UnstructuredMetafieldKey = {
  key: string
  type: MetafieldType
  values_count: number
}

export type ListUnstructuredMetafieldKeysConfig = {
  skip?: number
  take?: number
}

class MetafieldModuleService extends MedusaService({
  MetafieldDefinition,
  MetafieldValue,
}) {
  protected readonly options_: ResolvedMetafieldModuleOptions

  constructor(
    container: Record<string, unknown>,
    options?: MetafieldModuleOptions
  ) {
    super(container, options)

    this.options_ = resolveMetafieldModuleOptions(options)
  }

  async getOptions(): Promise<ResolvedMetafieldModuleOptions> {
    return this.options_
  }

  // Keys of an owner type that have values but no definition ("unstructured"),
  // with how many values each one has, ordered by key. A key's values share
  // one type: a definition only reconnects values of its own type.
  @InjectManager()
  async listAndCountUnstructuredMetafieldKeys(
    ownerType: string,
    { skip = 0, take = 20 }: ListUnstructuredMetafieldKeysConfig = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<[UnstructuredMetafieldKey[], number]> {
    const knex = (sharedContext.manager as SqlEntityManager).getKnex()

    const unstructured = knex("metafield_value as v")
      .where("v.owner_type", ownerType)
      .whereNull("v.deleted_at")
      .whereNotExists(
        knex("metafield_definition as d")
          .select(knex.raw("1"))
          .whereRaw("d.owner_type = v.owner_type")
          .whereRaw("d.key = v.key")
          .whereNull("d.deleted_at")
      )

    const rows = (await unstructured
      .clone()
      .select("v.key", "v.type")
      .count("* as values_count")
      .groupBy("v.key", "v.type")
      .orderBy([
        { column: "v.key", order: "asc" },
        { column: "v.type", order: "asc" },
      ])
      .offset(skip)
      .limit(take)) as {
      key: string
      type: MetafieldType
      values_count: string
    }[]

    const [{ count }] = await knex
      .from(unstructured.clone().distinct("v.key", "v.type").as("keys"))
      .count("* as count")

    return [
      rows.map((row) => ({
        key: row.key,
        type: row.type,
        values_count: Number(row.values_count),
      })),
      Number(count),
    ]
  }
}

export default MetafieldModuleService
