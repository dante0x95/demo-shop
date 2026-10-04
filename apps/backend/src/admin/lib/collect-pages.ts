// Free of the SDK so unit tests can load it.

export type Page<T> = {
  items: T[]
  count: number
}

// Every item of a paged list: asks for page after page, starting at offset 0,
// until it holds `count` items or a page comes back empty (the list shrank
// while it was being read). A failed page rejects the whole call.
export const collectPages = async <T>(
  fetchPage: (offset: number, limit: number) => Promise<Page<T>>,
  pageSize: number
): Promise<T[]> => {
  const items: T[] = []

  for (;;) {
    const page = await fetchPage(items.length, pageSize)

    items.push(...page.items)

    if (!page.items.length || items.length >= page.count) {
      return items
    }
  }
}
