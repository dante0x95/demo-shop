// The preset a product ships in when shipped alone: its own preset, else the
// store's default preset, else none (the shop has no default yet). Plain data
// with no Node APIs, so the admin UI can import it too.
export const resolvePackagePreset = <T>(
  productPreset: T | null | undefined,
  defaultPreset: T | null | undefined
): T | null => productPreset ?? defaultPreset ?? null
