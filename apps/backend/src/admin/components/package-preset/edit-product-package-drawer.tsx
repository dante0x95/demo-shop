import { Spinner } from "@medusajs/icons"
import { Button, Drawer, Label, Select, Text, toast } from "@medusajs/ui"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useEffect, useState } from "react"
import {
  AdminProductPackagePreset,
  listAllPackagePresets,
  packagePresetQueryKeys,
  productPackagePresetQueryKeys,
  setProductPackagePreset,
} from "../../lib/package-presets"
import {
  fromPackagePresetOption,
  packagePresetOptionLabel,
  STORE_DEFAULT_OPTION,
  storeDefaultOptionLabel,
  toPackagePresetOption,
} from "./utils"

type EditProductPackageDrawerProps = {
  view: AdminProductPackagePreset
  open: boolean
  onOpenChange: (open: boolean) => void
}

export const EditProductPackageDrawer = ({
  view,
  open,
  onOpenChange,
}: EditProductPackageDrawerProps) => {
  const [option, setOption] = useState(() =>
    toPackagePresetOption(view.package_preset?.id)
  )
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  // Only the picker needs every preset, so they load when the drawer opens.
  const presets = useQuery({
    queryKey: packagePresetQueryKeys.options(),
    queryFn: listAllPackagePresets,
    enabled: open,
  })

  const { mutate, isPending } = useMutation({
    mutationFn: (presetId: string | null) =>
      setProductPackagePreset(view.product_id, presetId),
    onSuccess: ({ product_package_preset }) => {
      queryClient.setQueryData(
        productPackagePresetQueryKeys.detail(view.product_id),
        { product_package_preset }
      )
      queryClient.invalidateQueries({
        queryKey: productPackagePresetQueryKeys.detail(view.product_id),
      })
      toast.success("Package updated")
      onOpenChange(false)
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to update the package")
    },
  })

  // Start from the saved preset every time the drawer opens.
  useEffect(() => {
    if (open) {
      setOption(toPackagePresetOption(view.package_preset?.id))
      setError(null)
    }
  }, [open])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    const presetId = fromPackagePresetOption(option)

    if (presetId === (view.package_preset?.id ?? null)) {
      onOpenChange(false)
      return
    }

    mutate(presetId)
  }

  const presetList = presets.data ?? []

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <Drawer.Content>
        <form
          onSubmit={handleSubmit}
          className="flex flex-1 flex-col overflow-hidden"
        >
          <Drawer.Header>
            <Drawer.Title>Edit package</Drawer.Title>
            <Drawer.Description className="sr-only">
              The package this product ships in when shipped alone
            </Drawer.Description>
          </Drawer.Header>
          <Drawer.Body className="flex flex-1 flex-col gap-y-4 overflow-y-auto">
            <Text size="small" leading="compact" className="text-ui-fg-subtle">
              The package used when this product is shipped alone. Without one
              of its own, the product uses the store's default package.
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
              <Label id="product-package-preset" size="small" weight="plus">
                Package
              </Label>
              {presets.isLoading ? (
                <div className="flex justify-center py-2">
                  <Spinner
                    aria-label="Loading package presets"
                    className="text-ui-fg-subtle animate-spin"
                  />
                </div>
              ) : presets.isError ? (
                <div role="alert" className="flex flex-col gap-y-2">
                  <Text
                    size="small"
                    leading="compact"
                    className="text-ui-fg-error"
                  >
                    The package presets could not be loaded:{" "}
                    {presets.error?.message || "Unexpected error"}
                  </Text>
                  <div>
                    <Button
                      size="small"
                      variant="secondary"
                      type="button"
                      onClick={() => presets.refetch()}
                      isLoading={presets.isFetching}
                    >
                      Retry
                    </Button>
                  </div>
                </div>
              ) : (
                <Select
                  value={option}
                  onValueChange={setOption}
                  disabled={isPending}
                >
                  <Select.Trigger aria-labelledby="product-package-preset">
                    <Select.Value />
                  </Select.Trigger>
                  <Select.Content>
                    <Select.Item value={STORE_DEFAULT_OPTION}>
                      {storeDefaultOptionLabel(presetList)}
                    </Select.Item>
                    {presetList.map((preset) => (
                      <Select.Item key={preset.id} value={preset.id}>
                        {packagePresetOptionLabel(preset)}
                      </Select.Item>
                    ))}
                  </Select.Content>
                </Select>
              )}
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
            <Button
              size="small"
              type="submit"
              isLoading={isPending}
              disabled={!presets.isSuccess}
            >
              Save
            </Button>
          </Drawer.Footer>
        </form>
      </Drawer.Content>
    </Drawer>
  )
}
