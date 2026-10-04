// How long a workflow waits for a busy key, and how long a lock lives if a
// crashed run never releases it, in seconds.
export const METAFIELD_LOCK_TIMEOUT = 10
export const METAFIELD_LOCK_TTL = 30

export const metafieldLockKey = (ownerType: string, key: string) =>
  `metafield:${ownerType}:${key}`

// Definition changes and value edits of the same owner type and key run one
// at a time, so a value is always checked against the definition (or the
// absence of one) it is saved under. Keys are sorted so two runs that lock
// several keys take them in the same order. The owner id lets a run that
// got only some keys retry without blocking itself.
export const metafieldLockInput = (
  ownerType: string,
  keys: string[],
  ownerId: string
) => ({
  key: [...new Set(keys)].sort().map((key) => metafieldLockKey(ownerType, key)),
  ownerId,
  timeout: METAFIELD_LOCK_TIMEOUT,
  ttl: METAFIELD_LOCK_TTL,
  // Keep the lock when the workflow runs inside another one.
  executeOnSubWorkflow: true,
})
