import {
  Button,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useEffect, useState } from "react"
import {
  CreateMetafieldDefinitionFormState,
  METAFIELD_TYPE_LABELS,
  METAFIELD_TYPES,
  ownerTypeLabel,
  suggestMetafieldKey,
  toCreateMetafieldDefinitionPayload,
} from "../../../../lib/metafield-form"
import {
  createMetafieldDefinition,
  metafieldQueryKeys,
  MetafieldType,
} from "../../../../lib/metafields"

// Prefills the form, e.g. to give an unstructured key its definition back.
export type CreateMetafieldDefinitionInitial = {
  key: string
  type: MetafieldType
}

type CreateMetafieldDefinitionModalProps = {
  ownerType: string
  open: boolean
  onOpenChange: (open: boolean) => void
  initial?: CreateMetafieldDefinitionInitial | null
}

const toInitialState = (
  initial?: CreateMetafieldDefinitionInitial | null
): CreateMetafieldDefinitionFormState => ({
  label: "",
  key: initial?.key ?? "",
  type: initial?.type ?? "",
  options: "",
})

export const CreateMetafieldDefinitionModal = ({
  ownerType,
  open,
  onOpenChange,
  initial,
}: CreateMetafieldDefinitionModalProps) => {
  const [form, setForm] = useState(() => toInitialState(initial))
  // The key follows the label until the admin types one (or one is given).
  const [keyEdited, setKeyEdited] = useState(Boolean(initial))
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    if (open) {
      setForm(toInitialState(initial))
      setKeyEdited(Boolean(initial))
      setError(null)
    }
  }, [open, initial])

  const { mutate, isPending } = useMutation({
    mutationFn: createMetafieldDefinition,
    onSuccess: ({ metafield_definition }) => {
      queryClient.invalidateQueries({ queryKey: metafieldQueryKeys.all })
      toast.success(`Metafield "${metafield_definition.label}" created`)
      onOpenChange(false)
    },
    // A 409 says which existing values of this key don't fit the definition.
    onError: (err: Error) => {
      setError(err.message || "Failed to create metafield definition")
    },
  })

  const setLabel = (label: string) => {
    setForm((prev) => ({
      ...prev,
      label,
      key: keyEdited ? prev.key : suggestMetafieldKey(label),
    }))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    mutate(toCreateMetafieldDefinitionPayload(form, ownerType))
  }

  return (
    <FocusModal open={open} onOpenChange={onOpenChange}>
      <FocusModal.Content>
        <form
          onSubmit={handleSubmit}
          // The API validates every field and its error is shown below.
          noValidate
          className="flex h-full flex-col overflow-hidden"
        >
          <FocusModal.Header>
            <div className="flex items-center justify-end gap-x-2">
              <FocusModal.Close asChild>
                <Button
                  size="small"
                  variant="secondary"
                  type="button"
                  disabled={isPending}
                >
                  Cancel
                </Button>
              </FocusModal.Close>
              <Button size="small" type="submit" isLoading={isPending}>
                Save
              </Button>
            </div>
          </FocusModal.Header>
          <FocusModal.Body className="flex flex-1 flex-col items-center overflow-y-auto py-16">
            <div className="flex w-full max-w-[720px] flex-col gap-y-8">
              <div className="flex flex-col gap-y-1">
                <Heading>Create metafield definition</Heading>
                <Text
                  size="small"
                  leading="compact"
                  className="text-ui-fg-subtle"
                >
                  {ownerTypeLabel(ownerType)} metafield: a custom field every{" "}
                  {ownerTypeLabel(ownerType).toLowerCase()} can have a value
                  for. Values already stored under the same key are connected
                  to it.
                </Text>
              </div>
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="metafield-label" size="small" weight="plus">
                    Name
                  </Label>
                  <Input
                    id="metafield-label"
                    value={form.label}
                    onChange={(e) => setLabel(e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="metafield-key" size="small" weight="plus">
                    Key
                  </Label>
                  <Input
                    id="metafield-key"
                    value={form.key}
                    onChange={(e) => {
                      setKeyEdited(true)
                      setForm((prev) => ({ ...prev, key: e.target.value }))
                    }}
                    disabled={isPending}
                    aria-describedby="metafield-key-hint"
                  />
                  <Text
                    id="metafield-key-hint"
                    size="small"
                    leading="compact"
                    className="text-ui-fg-subtle"
                  >
                    Lowercase letters, digits and underscores. It can't be
                    changed later.
                  </Text>
                </div>
              </div>
              <div className="flex flex-col gap-y-2">
                <Label size="small" weight="plus" id="metafield-type">
                  Type
                </Label>
                <Select
                  value={form.type}
                  onValueChange={(value) =>
                    setForm((prev) => ({
                      ...prev,
                      type: value as MetafieldType,
                    }))
                  }
                  disabled={isPending}
                >
                  <Select.Trigger aria-labelledby="metafield-type">
                    <Select.Value placeholder="Select type" />
                  </Select.Trigger>
                  <Select.Content>
                    {METAFIELD_TYPES.map((type) => (
                      <Select.Item key={type} value={type}>
                        {METAFIELD_TYPE_LABELS[type]}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              </div>
              {form.type === "select" && (
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="metafield-options" size="small" weight="plus">
                    Options
                  </Label>
                  <Textarea
                    id="metafield-options"
                    value={form.options}
                    onChange={(e) =>
                      setForm((prev) => ({ ...prev, options: e.target.value }))
                    }
                    disabled={isPending}
                    rows={5}
                    aria-describedby="metafield-options-hint"
                  />
                  <Text
                    id="metafield-options-hint"
                    size="small"
                    leading="compact"
                    className="text-ui-fg-subtle"
                  >
                    One option per line.
                  </Text>
                </div>
              )}
            </div>
          </FocusModal.Body>
        </form>
      </FocusModal.Content>
    </FocusModal>
  )
}
