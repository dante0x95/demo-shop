import { MedusaError } from "@medusajs/framework/utils"
import BrandModuleService from "../../../modules/brand/service"

// Escape LIKE wildcards so $ilike matches the name literally, ignoring case only.
const escapeLike = (value: string) => value.replace(/[\\%_]/g, "\\$&")

// Returns which unique field an existing brand already uses, preferring "name":
// a same-name brand usually also has the same generated handle.
export const findBrandConflict = async (
  brandModuleService: BrandModuleService,
  { name, handle }: { name: string; handle: string }
): Promise<"name" | "handle" | null> => {
  const existing = await brandModuleService.listBrands(
    {
      $or: [{ name: { $ilike: escapeLike(name) } }, { handle }],
    },
    { select: ["id", "name", "handle"], take: 2 }
  )

  if (
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
