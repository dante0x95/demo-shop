import { Button, Drawer, Input, Label, Text, toast } from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useEffect, useState } from "react"
import {
  AdminUpdateVariantPricingItem,
  AdminVariantPricing,
  updateVariantPricing,
  variantPricingQueryKeys,
} from "../../lib/variant-pricing"
import {
  buildVariantPricingChanges,
  compareAtHiddenReason,
  formatAmount,
  parseAmountInput,
  toVariantPricingFormRows,
  VariantPricingField,
  VariantPricingFormErrors,
  VariantPricingFormRow,
} from "./utils"

type EditVariantPricingDrawerProps = {
  pricing: AdminVariantPricing
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FieldError = ({ id, message }: { id: string; message?: string }) =>
  message ? (
    <Text id={id} size="xsmall" leading="compact" className="text-ui-fg-error">
      {message}
    </Text>
  ) : null

export const EditVariantPricingDrawer = ({
  pricing,
  open,
  onOpenChange,
}: EditVariantPricingDrawerProps) => {
  // The values the form started from: edits are diffed against them, so a
  // field the admin didn't touch is never sent.
  const [baseline, setBaseline] = useState(pricing.variants)
  const [rows, setRows] = useState<VariantPricingFormRow[]>(() =>
    toVariantPricingFormRows(pricing.variants)
  )
  const [fieldErrors, setFieldErrors] = useState<VariantPricingFormErrors>({})
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()
  const currency = pricing.currency_code?.toUpperCase() ?? null

  const { mutate, isPending } = useMutation({
    mutationFn: (variants: AdminUpdateVariantPricingItem[]) =>
      updateVariantPricing(pricing.product_id, variants),
    onSuccess: ({ variant_pricing }) => {
      queryClient.setQueryData(
        variantPricingQueryKeys.detail(pricing.product_id),
        { variant_pricing }
      )
      queryClient.invalidateQueries({
        queryKey: variantPricingQueryKeys.detail(pricing.product_id),
      })
      toast.success("Compare-at prices and costs updated")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to update the prices")
    },
  })

  // Start from the saved values every time the drawer opens. Only on opening:
  // a background refetch while it is open must not wipe what was typed.
  useEffect(() => {
    if (open) {
      setBaseline(pricing.variants)
      setRows(toVariantPricingFormRows(pricing.variants))
      setFieldErrors({})
      setError(null)
    }
  }, [open])

  const setField = (
    variantId: string,
    field: VariantPricingField,
    value: string
  ) => {
    setRows((prev) =>
      prev.map((row) =>
        row.variant_id === variantId ? { ...row, [field]: value } : row
      )
    )
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const { changes, errors } = buildVariantPricingChanges(baseline, rows)
    setFieldErrors(errors)

    if (Object.keys(errors).length) {
      return
    }

    if (!changes.length) {
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
            <Drawer.Title>Edit compare-at prices and costs</Drawer.Title>
            <Drawer.Description className="sr-only">
              Compare-at price and cost per item for each variant
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-y-6 overflow-y-auto">
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              {currency
                ? `Amounts in ${currency}, the store's default currency.`
                : "Amounts in the store's default currency."}{" "}
              Leave a field empty to clear it. Customers never see the cost per
              item.
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
            {baseline.map((variant) => {
              const row = rows.find(
                (item) => item.variant_id === variant.variant_id
              )

              if (!row) {
                return null
              }

              const errors = fieldErrors[variant.variant_id] ?? {}
              const compareAtId = `variant-pricing-${variant.variant_id}-compare-at`
              const costId = `variant-pricing-${variant.variant_id}-cost`
              const typedCompareAt = parseAmountInput(row.compare_at_amount)
              const hiddenReason =
                typedCompareAt === undefined
                  ? null
                  : compareAtHiddenReason(typedCompareAt, variant.price)

              return (
                <div
                  key={variant.variant_id}
                  role="group"
                  aria-label={variant.title}
                  className="flex flex-col gap-y-3"
                >
                  <div className="flex flex-col">
                    <Text size="small" leading="compact" weight="plus">
                      {variant.title}
                    </Text>
                    <Text
                      size="small"
                      leading="compact"
                      className="text-ui-fg-subtle"
                    >
                      {variant.sku ? `SKU ${variant.sku} · ` : ""}Price{" "}
                      {formatAmount(variant.price, pricing.currency_code)}
                    </Text>
                  </div>
                  <div className="grid grid-cols-2 gap-x-4">
                    <div className="flex flex-col gap-y-2">
                      <Label htmlFor={compareAtId} size="small" weight="plus">
                        Compare-at price
                      </Label>
                      <Input
                        id={compareAtId}
                        inputMode="decimal"
                        placeholder="0.00"
                        value={row.compare_at_amount}
                        aria-invalid={!!errors.compare_at_amount}
                        aria-describedby={`${compareAtId}-hint`}
                        disabled={isPending}
                        onChange={(e) =>
                          setField(
                            variant.variant_id,
                            "compare_at_amount",
                            e.target.value
                          )
                        }
                      />
                      <div id={`${compareAtId}-hint`}>
                        <FieldError
                          id={`${compareAtId}-error`}
                          message={errors.compare_at_amount}
                        />
                        {hiddenReason && (
                          <Text
                            size="xsmall"
                            leading="compact"
                            className="text-ui-fg-subtle"
                          >
                            {hiddenReason}
                          </Text>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-col gap-y-2">
                      <Label htmlFor={costId} size="small" weight="plus">
                        Cost per item
                      </Label>
                      <Input
                        id={costId}
                        inputMode="decimal"
                        placeholder="0.00"
                        value={row.cost_amount}
                        aria-invalid={!!errors.cost_amount}
                        aria-describedby={`${costId}-error`}
                        disabled={isPending}
                        onChange={(e) =>
                          setField(
                            variant.variant_id,
                            "cost_amount",
                            e.target.value
                          )
                        }
                      />
                      <FieldError
                        id={`${costId}-error`}
                        message={errors.cost_amount}
                      />
                    </div>
                  </div>
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
