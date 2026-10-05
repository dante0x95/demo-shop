import {
  Button,
  Drawer,
  Input,
  Label,
  Switch,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useEffect, useState } from "react"
import {
  AdminBrand,
  AdminUpdateBrandPayload,
  brandQueryKeys,
  updateBrand,
} from "../../../../lib/brands"

type FormState = {
  name: string
  handle: string
  description: string
  logo_url: string
  banner_url: string
  is_active: boolean
}

type TextField = Exclude<keyof FormState, "is_active">

const toFormState = (brand: AdminBrand): FormState => ({
  name: brand.name,
  handle: brand.handle,
  description: brand.description ?? "",
  logo_url: brand.logo_url ?? "",
  banner_url: brand.banner_url ?? "",
  is_active: brand.is_active,
})

// Every field is sent; an emptied optional input becomes null so it is cleared.
const toPayload = (form: FormState): AdminUpdateBrandPayload => ({
  name: form.name,
  handle: form.handle,
  description: form.description.trim() || null,
  logo_url: form.logo_url.trim() || null,
  banner_url: form.banner_url.trim() || null,
  is_active: form.is_active,
})

type EditBrandDrawerProps = {
  brand: AdminBrand
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const EditBrandDrawer = ({
  brand,
  open,
  onOpenChange,
}: EditBrandDrawerProps) => {
  const [form, setForm] = useState<FormState>(() => toFormState(brand))
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: (payload: AdminUpdateBrandPayload) =>
      updateBrand(brand.id, payload),
    onSuccess: ({ brand: updated }) => {
      queryClient.invalidateQueries({ queryKey: brandQueryKeys.all })
      toast.success(`Brand "${updated.name}" updated`)
      onOpenChange(false)
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to update brand")
    },
  })

  // Start from the saved brand every time the drawer opens.
  useEffect(() => {
    if (open) {
      setForm(toFormState(brand))
      setError(null)
    }
  }, [open, brand])

  const setField = (field: TextField, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    mutate(toPayload(form))
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <Drawer.Header>
            <Drawer.Title>Edit brand</Drawer.Title>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-y-auto">
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
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="edit-brand-name" size="small" weight="plus">
                Name
              </Label>
              <Input
                id="edit-brand-name"
                value={form.name}
                onChange={(e) => setField("name", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="edit-brand-handle" size="small" weight="plus">
                Handle
              </Label>
              <Input
                id="edit-brand-handle"
                value={form.handle}
                onChange={(e) => setField("handle", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="edit-brand-description" size="small" weight="plus">
                Description (optional)
              </Label>
              <Textarea
                id="edit-brand-description"
                value={form.description}
                onChange={(e) => setField("description", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="edit-brand-logo-url" size="small" weight="plus">
                Logo URL (optional)
              </Label>
              <Input
                id="edit-brand-logo-url"
                value={form.logo_url}
                onChange={(e) => setField("logo_url", e.target.value)}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="edit-brand-banner-url" size="small" weight="plus">
                Banner URL (optional)
              </Label>
              <Input
                id="edit-brand-banner-url"
                value={form.banner_url}
                onChange={(e) => setField("banner_url", e.target.value)}
              />
            </div>
            <div className="flex items-center gap-x-2">
              <Switch
                id="edit-brand-is-active"
                checked={form.is_active}
                onCheckedChange={(checked) =>
                  setForm((prev) => ({ ...prev, is_active: checked }))
                }
              />
              <Label htmlFor="edit-brand-is-active" size="small" weight="plus">
                Active
              </Label>
            </div>
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
