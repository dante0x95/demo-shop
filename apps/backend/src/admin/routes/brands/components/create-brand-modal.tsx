import {
  Button,
  FocusModal,
  Heading,
  Input,
  Label,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useState } from "react"
import {
  AdminCreateBrandPayload,
  brandQueryKeys,
  createBrand,
} from "../../../lib/brands"

type FormState = {
  name: string
  handle: string
  description: string
  logo_url: string
  banner_url: string
  is_active: boolean
}

const initialState: FormState = {
  name: "",
  handle: "",
  description: "",
  logo_url: "",
  banner_url: "",
  is_active: true,
}

type TextField = Exclude<keyof FormState, "is_active">

// Empty optional inputs are omitted so the API applies its own defaults
// (e.g. a handle generated from the name).
const toPayload = (form: FormState): AdminCreateBrandPayload => {
  const payload: AdminCreateBrandPayload = {
    name: form.name,
    is_active: form.is_active,
  }

  for (const field of [
    "handle",
    "description",
    "logo_url",
    "banner_url",
  ] as const) {
    const value = form[field].trim()

    if (value) {
      payload[field] = value
    }
  }

  return payload
}

export const CreateBrandModal = () => {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: createBrand,
    onSuccess: ({ brand }) => {
      queryClient.invalidateQueries({ queryKey: brandQueryKeys.all })
      toast.success(`Brand "${brand.name}" created`)
      handleOpenChange(false)
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to create brand")
    },
  })

  const handleOpenChange = (next: boolean) => {
    setOpen(next)

    if (!next) {
      setForm(initialState)
      setError(null)
    }
  }

  const setField = (field: TextField, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    mutate(toPayload(form))
  }

  return (
    <FocusModal open={open} onOpenChange={handleOpenChange}>
      <FocusModal.Trigger asChild>
        <Button size="small" variant="secondary">
          Create brand
        </Button>
      </FocusModal.Trigger>
      <FocusModal.Content>
        <form
          onSubmit={handleSubmit}
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
              <Heading>Create brand</Heading>
              {error && (
                <div className="bg-ui-bg-subtle shadow-borders-base rounded-md px-4 py-3">
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
                  <Label htmlFor="brand-name" size="small" weight="plus">
                    Name
                  </Label>
                  <Input
                    id="brand-name"
                    value={form.name}
                    onChange={(e) => setField("name", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="brand-handle" size="small" weight="plus">
                    Handle (optional)
                  </Label>
                  <Input
                    id="brand-handle"
                    value={form.handle}
                    onChange={(e) => setField("handle", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="brand-logo-url" size="small" weight="plus">
                    Logo URL (optional)
                  </Label>
                  <Input
                    id="brand-logo-url"
                    value={form.logo_url}
                    onChange={(e) => setField("logo_url", e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label htmlFor="brand-banner-url" size="small" weight="plus">
                    Banner URL (optional)
                  </Label>
                  <Input
                    id="brand-banner-url"
                    value={form.banner_url}
                    onChange={(e) => setField("banner_url", e.target.value)}
                  />
                </div>
              </div>
              <div className="flex flex-col gap-y-2">
                <Label htmlFor="brand-description" size="small" weight="plus">
                  Description (optional)
                </Label>
                <Textarea
                  id="brand-description"
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                />
              </div>
              <div className="flex items-center gap-x-2">
                <Switch
                  id="brand-is-active"
                  checked={form.is_active}
                  onCheckedChange={(checked) =>
                    setForm((prev) => ({ ...prev, is_active: checked }))
                  }
                />
                <Label htmlFor="brand-is-active" size="small" weight="plus">
                  Active
                </Label>
              </div>
            </div>
          </FocusModal.Body>
        </form>
      </FocusModal.Content>
    </FocusModal>
  )
}
