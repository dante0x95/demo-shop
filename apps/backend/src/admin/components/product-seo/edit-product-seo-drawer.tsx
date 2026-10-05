import {
  Button,
  clx,
  Drawer,
  Input,
  Label,
  Text,
  Textarea,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useEffect, useState } from "react"
import {
  AdminProductSeo,
  AdminUpdateProductSeoPayload,
  productSeoQueryKeys,
  updateProductSeo,
} from "../../lib/product-seo"
import {
  buildProductSeoChanges,
  ProductSeoForm,
  SEO_DESCRIPTION_LIMIT,
  SEO_TITLE_LIMIT,
  seoCounter,
  toProductSeoForm,
} from "./utils"

type EditProductSeoDrawerProps = {
  seo: AdminProductSeo
  // What the storefront uses while a field is empty.
  fallbacks: ProductSeoForm
  open: boolean
  onOpenChange: (open: boolean) => void
}

// Shopify-style: a guide, not a limit. Going over it is allowed.
const Counter = ({
  id,
  value,
  limit,
}: {
  id: string
  value: string
  limit: number
}) => {
  const counter = seoCounter(value, limit)

  return (
    <Text
      id={id}
      size="xsmall"
      leading="compact"
      className={clx(
        counter.over ? "text-ui-fg-error" : "text-ui-fg-subtle"
      )}
    >
      {counter.text}
    </Text>
  )
}

export const EditProductSeoDrawer = ({
  seo,
  fallbacks,
  open,
  onOpenChange,
}: EditProductSeoDrawerProps) => {
  // The values the form started from: edits are diffed against them, so a
  // field the admin didn't touch is never sent.
  const [baseline, setBaseline] = useState(seo)
  const [form, setForm] = useState<ProductSeoForm>(() => toProductSeoForm(seo))
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: (body: AdminUpdateProductSeoPayload) =>
      updateProductSeo(seo.product_id, body),
    onSuccess: ({ product_seo }) => {
      queryClient.setQueryData(productSeoQueryKeys.detail(seo.product_id), {
        product_seo,
      })
      queryClient.invalidateQueries({
        queryKey: productSeoQueryKeys.detail(seo.product_id),
      })
      toast.success("SEO updated")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to update the SEO")
    },
  })

  // Start from the saved values every time the drawer opens. Only on opening:
  // a background refetch while it is open must not wipe what was typed.
  useEffect(() => {
    if (open) {
      setBaseline(seo)
      setForm(toProductSeoForm(seo))
      setError(null)
    }
  }, [open])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const changes = buildProductSeoChanges(baseline, form)

    if (!changes) {
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
          className="flex flex-1 flex-col overflow-hidden"
        >
          <Drawer.Header>
            <Drawer.Title>Edit SEO</Drawer.Title>
            <Drawer.Description className="sr-only">
              Page title and meta description search engines show
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-y-auto">
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              Leave a field empty to use the product's title and description.
            </Text>
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
            <div className="flex flex-col gap-y-2">
              <Label htmlFor="product-seo-title" size="small" weight="plus">
                Page title
              </Label>
              <Input
                id="product-seo-title"
                value={form.title}
                placeholder={fallbacks.title}
                aria-describedby="product-seo-title-counter"
                disabled={isPending}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, title: e.target.value }))
                }
              />
              <Counter
                id="product-seo-title-counter"
                value={form.title}
                limit={SEO_TITLE_LIMIT}
              />
            </div>
            <div className="flex flex-col gap-y-2">
              <Label
                htmlFor="product-seo-description"
                size="small"
                weight="plus"
              >
                Meta description
              </Label>
              <Textarea
                id="product-seo-description"
                rows={4}
                value={form.description}
                placeholder={fallbacks.description}
                aria-describedby="product-seo-description-counter"
                disabled={isPending}
                onChange={(e) =>
                  setForm((prev) => ({ ...prev, description: e.target.value }))
                }
              />
              <Counter
                id="product-seo-description-counter"
                value={form.description}
                limit={SEO_DESCRIPTION_LIMIT}
              />
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
