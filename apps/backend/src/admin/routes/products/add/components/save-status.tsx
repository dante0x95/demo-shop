import {
  CheckCircleSolid,
  ExclamationCircleSolid,
  Spinner,
} from "@medusajs/icons"
import { Button, Container, Heading, Text } from "@medusajs/ui"
import { Link } from "react-router-dom"
import { FOLLOW_UP_LABELS, FollowUpPart } from "../utils"

export type PartStatus =
  { state: "saving" } | { state: "saved" } | { state: "failed"; error: string }

type SaveStatusProps = {
  product: { id: string; title: string }
  parts: Partial<Record<FollowUpPart, PartStatus>>
  onRetry: (part: FollowUpPart) => void
}

// Shown once the product exists but a part saved after it failed: the
// product stays created, and each failed part can be retried on its own.
export const SaveStatus = ({ product, parts, onRetry }: SaveStatusProps) => {
  const entries = Object.entries(parts) as [FollowUpPart, PartStatus][]
  const failed = entries.filter(([, status]) => status.state === "failed")

  return (
    <Container
      role="alert"
      aria-label="Save status"
      className="divide-y p-0"
      data-testid="add-product-save-status"
    >
      <div className="flex flex-col gap-y-1 px-6 py-4">
        <Heading level="h2">
          {failed.length
            ? `"${product.title}" was created, but some parts weren't saved`
            : `"${product.title}" was created`}
        </Heading>
        <Text size="small" leading="compact" className="text-ui-fg-subtle">
          {failed.length
            ? "Retry the failed parts here, or edit them later on the product page. Saving the form again would create a second product, so it is locked."
            : "Saving the remaining parts."}
        </Text>
      </div>
      <ul className="flex flex-col divide-y">
        {entries.map(([part, status]) => (
          <li
            key={part}
            aria-label={FOLLOW_UP_LABELS[part]}
            className="flex items-center justify-between gap-x-4 px-6 py-3"
          >
            <div className="flex min-w-0 items-center gap-x-2">
              {status.state === "saving" && (
                <Spinner className="animate-spin" />
              )}
              {status.state === "saved" && (
                <CheckCircleSolid className="text-ui-tag-green-icon" />
              )}
              {status.state === "failed" && (
                <ExclamationCircleSolid className="text-ui-tag-red-icon" />
              )}
              <div className="flex min-w-0 flex-col">
                <Text size="small" leading="compact" weight="plus">
                  {FOLLOW_UP_LABELS[part]}
                </Text>
                <Text
                  size="small"
                  leading="compact"
                  className={
                    status.state === "failed"
                      ? "text-ui-fg-error"
                      : "text-ui-fg-subtle"
                  }
                >
                  {status.state === "saving" && "Saving"}
                  {status.state === "saved" && "Saved"}
                  {status.state === "failed" && status.error}
                </Text>
              </div>
            </div>
            {status.state === "failed" && (
              <Button
                size="small"
                variant="secondary"
                type="button"
                onClick={() => onRetry(part)}
                aria-label={`Retry ${FOLLOW_UP_LABELS[part]}`}
              >
                Retry
              </Button>
            )}
          </li>
        ))}
      </ul>
      <div className="flex justify-end px-6 py-4">
        <Button size="small" variant="secondary" asChild>
          <Link to={`/products/${product.id}`}>Go to product</Link>
        </Button>
      </div>
    </Container>
  )
}
