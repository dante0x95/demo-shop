import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { METAFIELD_MODULE } from "../../../modules/metafield"
import { MetafieldType } from "../../../modules/metafield/models/metafield-definition"
import MetafieldModuleService from "../../../modules/metafield/service"
import { PreparedMetafieldValue } from "../../../modules/metafield/utils/values"

export type UpsertMetafieldValuesStepInput = {
  owner_type: string
  owner_id: string
  values: PreparedMetafieldValue[]
}

type StoredValue = {
  id: string
  key: string
  type: MetafieldType
  value: string
}

type Compensation = {
  created_ids: string[]
  previous: { id: string; type: MetafieldType; value: string }[]
}

// Saves an owner's values: a key without a value gets one, a key with one is
// updated. Keys left out keep their values.
export const upsertMetafieldValuesStep = createStep(
  "upsert-metafield-values",
  async (input: UpsertMetafieldValuesStepInput, { container }) => {
    const metafieldModuleService: MetafieldModuleService =
      container.resolve(METAFIELD_MODULE)

    const findCurrent = async () =>
      (await metafieldModuleService.listMetafieldValues(
        {
          owner_type: input.owner_type,
          owner_id: input.owner_id,
          key: input.values.map((value) => value.key),
        },
        { select: ["id", "key", "type", "value"] }
      )) as StoredValue[]

    const split = (current: StoredValue[]) => {
      const currentByKey = new Map(current.map((value) => [value.key, value]))

      return {
        toCreate: input.values.filter((value) => !currentByKey.has(value.key)),
        toUpdate: input.values.flatMap((value) => {
          const stored = currentByKey.get(value.key)
          return stored ? [{ stored, next: value }] : []
        }),
      }
    }

    const createAll = (values: PreparedMetafieldValue[]) =>
      values.length
        ? metafieldModuleService.createMetafieldValues(
            values.map((value) => ({
              ...value,
              owner_type: input.owner_type,
              owner_id: input.owner_id,
            }))
          )
        : Promise.resolve([])

    let plan = split(await findCurrent())
    let created: { id: string }[]

    try {
      created = await createAll(plan.toCreate)
    } catch {
      // A concurrent first edit of the same owner and key created the value
      // after the lookup above; the unique index rejected this batch, so the
      // keys it took are updated instead.
      plan = split(await findCurrent())
      created = await createAll(plan.toCreate)
    }

    const createdIds = created.map((value) => value.id)

    try {
      if (plan.toUpdate.length) {
        await metafieldModuleService.updateMetafieldValues(
          plan.toUpdate.map(({ stored, next }) => ({
            id: stored.id,
            type: next.type,
            value: next.value,
          }))
        )
      }
    } catch (error) {
      // This step failed, so its compensation won't run: undo the creates.
      if (createdIds.length) {
        await metafieldModuleService.deleteMetafieldValues(createdIds)
      }

      throw error
    }

    return new StepResponse<undefined, Compensation>(undefined, {
      created_ids: createdIds,
      previous: plan.toUpdate.map(({ stored }) => ({
        id: stored.id,
        type: stored.type,
        value: stored.value,
      })),
    })
  },
  async (compensation, { container }) => {
    if (!compensation) {
      return
    }

    const metafieldModuleService: MetafieldModuleService =
      container.resolve(METAFIELD_MODULE)

    if (compensation.created_ids.length) {
      await metafieldModuleService.deleteMetafieldValues(
        compensation.created_ids
      )
    }

    if (compensation.previous.length) {
      await metafieldModuleService.updateMetafieldValues(compensation.previous)
    }
  }
)
