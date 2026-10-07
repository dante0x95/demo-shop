import { Badge, Button, Drawer, Label, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useEffect, useState } from "react"
import {
  buildProductMetafieldChanges,
  METAFIELD_TYPE_LABELS,
  ProductMetafieldField,
  toMetafieldInputValue,
} from "../../lib/metafield-form"
import {
  deleteProductMetafield,
  metafieldQueryKeys,
  setProductMetafields,
} from "../../lib/metafields"
import { MetafieldInput } from "./metafield-input"

const toInputs = (fields: ProductMetafieldField[]) =>
  Object.fromEntries(
    fields.map((field) => [field.key, toMetafieldInputValue(field.value)])
  )

type EditProductMetafieldsDrawerProps = {
  productId: string
  fields: ProductMetafieldField[]
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const EditProductMetafieldsDrawer = ({
  productId,
  fields,
  open,
  onOpenChange,
}: EditProductMetafieldsDrawerProps) => {
  const [inputs, setInputs] = useState<Record<string, string>>(() =>
    toInputs(fields)
  )
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Start from the saved values every time the drawer opens. Only on open:
  // a refetch while editing must not wipe the inputs.
  useEffect(() => {
    if (open) {
      setInputs(toInputs(fields))
      setError(null)
    }
  }, [open])

  const { mutate, isPending } = useMutation({
    mutationFn: async ({
      set,
      remove,
    }: {
      set: { key: string; value: string | number | boolean }[]
      remove: string[]
    }) => {
      // Values are saved together; removals one by one after them.
      if (set.length) {
        await setProductMetafields(productId, set)
      }

      for (const key of remove) {
        await deleteProductMetafield(productId, key)
      }
    },
    onSuccess: () => {
      toast.success("Metafields updated")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to update metafields")
    },
    // A failed removal may follow saved values: show what was stored.
    onSettled: () => {
      queryClient.invalidateQueries({
        queryKey: metafieldQueryKeys.product(productId),
      })
    },
  })

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const changes = buildProductMetafieldChanges(fields, inputs)

    if (changes.errors.length) {
      setError(changes.errors.join(". "))
      return
    }

    if (!changes.set.length && !changes.remove.length) {
      onOpenChange(false)
      return
    }

    mutate(changes)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex flex-1 flex-col overflow-hidden"
        >
          <Drawer.Header>
            <Drawer.Title>Edit metafields</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-y-auto">
            {error && (
              <div
                role="alert"
                className="bg-ui-bg-subtle shadow-borders-base rounded-md px-4 py-3"
              >
                <Text
                  size="small"
                  leading="compact"
                  className="text-ui-fg-error"
                >
                  {error}
                </Text>
              </div>
            )}
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              Empty a field to remove its value.
            </Text>
            {fields.map((field) => {
              const id = `product-metafield-${field.key}`

              return (
                <div key={field.key} className="flex flex-col gap-y-2">
                  <div className="flex items-center gap-x-2">
                    <Label htmlFor={id} size="small" weight="plus">
                      {field.label}
                    </Label>
                    {field.unstructured && (
                      <Badge size="2xsmall" color="orange">
                        Unstructured
                      </Badge>
                    )}
                  </div>
                  <MetafieldInput
                    field={field}
                    id={id}
                    value={inputs[field.key] ?? ""}
                    onChange={(value) =>
                      setInputs((prev) => ({ ...prev, [field.key]: value }))
                    }
                    disabled={isPending}
                  />
                  <Text
                    size="small"
                    leading="compact"
                    className="text-ui-fg-subtle"
                  >
                    {field.unstructured
                      ? `${field.key} · ${METAFIELD_TYPE_LABELS[field.type]} · no definition`
                      : `${field.key} · ${METAFIELD_TYPE_LABELS[field.type]}`}
                  </Text>
                </div>
              )
            })}
          </Drawer.Body>
          <Drawer.Footer>
            <Drawer.Close asChild>
              <Button
                size="small"
                variant="secondary"
                type="button"
                disabled={isPending}
              >
                Cancel
              </Button>
            </Drawer.Close>
            <Button size="small" type="submit" isLoading={isPending}>
              Save
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
