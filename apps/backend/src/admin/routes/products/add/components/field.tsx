import { Container, Heading, Label, Text } from "@medusajs/ui"
import { ReactNode } from "react"

// A labeled input with its hint and error. `children` renders the input with
// the given id, so the label and the error message point at it.
export const Field = ({
  id,
  label,
  hint,
  error,
  optional,
  children,
}: {
  id: string
  label: string
  hint?: string
  error?: string
  optional?: boolean
  children: ReactNode
}) => (
  <div className="flex flex-col gap-y-2">
    <Label htmlFor={id} size="small" weight="plus">
      {label}
      {optional && (
        <span className="text-ui-fg-muted font-normal"> (optional)</span>
      )}
    </Label>
    {children}
    {hint && !error && (
      <Text size="small" leading="compact" className="text-ui-fg-subtle">
        {hint}
      </Text>
    )}
    {error && (
      <Text
        id={`${id}-error`}
        size="small"
        leading="compact"
        className="text-ui-fg-error"
      >
        {error}
      </Text>
    )}
  </div>
)

// Props that mark an input invalid and link it to its error message.
export const errorProps = (id: string, error?: string) =>
  error
    ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` }
    : {}

// A card of the page, titled, with its fields below.
export const Section = ({
  title,
  description,
  actions,
  children,
  testId,
}: {
  title: string
  description?: string
  actions?: ReactNode
  children: ReactNode
  testId?: string
}) => (
  <section aria-label={title} data-testid={testId}>
    <Container className="divide-y p-0">
      <div className="flex items-center justify-between gap-x-4 px-6 py-4">
        <div className="flex flex-col gap-y-1">
          <Heading level="h2">{title}</Heading>
          {description && (
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              {description}
            </Text>
          )}
        </div>
        {actions}
      </div>
      <div className="flex flex-col gap-y-4 px-6 py-4">{children}</div>
    </Container>
  </section>
)
