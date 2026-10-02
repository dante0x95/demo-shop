import { MedusaError } from "@medusajs/framework/utils"
import BrandModuleService from "../../../modules/brand/service"

// Escape LIKE wildcards so $ilike matches the name literally, ignoring case only.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&")

export type BrandConflictInput = {
  name?: string
  handle?: string
  // The brand being updated; it never conflicts with itself.
  exclude_id?: string
}

// Returns which unique field an existing brand already uses, preferring "name":
// a same-name brand usually also has the same generated handle.
export const findBrandConflict = async (
  brandModuleService: BrandModuleService,
  { name, handle, exclude_id }: BrandConflictInput
): Promise<"name" | "handle" | null> => {
  const candidates: Record<string, unknown>[] = []

  if (name !== undefined) {
    candidates.push({ name: { $ilike: escapeLike(name) } })
  }

  if (handle !== undefined) {
    candidates.push({ handle })
  }

  if (!candidates.length) {
    return null
  }

  const existing = await brandModuleService.listBrands(
    {
      $or: candidates,
      ...(exclude_id ? { id: { $ne: exclude_id } } : {}),
    },
    { select: ["id", "name", "handle"], take: 2 }
  )

  if (
    name !== undefined &&
    existing.some((brand) => brand.name.toLowerCase() === name.toLowerCase())
  ) {
    return "name"
  }

  return existing.length ? "handle" : null
}

export const brandConflictError = (field: "name" | "handle") =>
  new MedusaError(
    MedusaError.Types.INVALID_DATA,
    `A brand with this ${field} already exists`
  )
