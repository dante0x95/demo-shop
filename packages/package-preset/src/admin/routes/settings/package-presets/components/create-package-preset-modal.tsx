import {
  Button,
  FocusModal,
  Heading,
  Input,
  Label,
  Select,
  Switch,
  Text,
  toast,
} from "@medusajs/ui"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { FormEvent, useState } from "react"
import {
  AdminCreatePackagePresetPayload,
  createPackagePreset,
  DIMENSION_UNITS,
  DimensionUnit,
  packagePresetQueryKeys,
  WEIGHT_UNITS,
  WeightUnit,
} from "../../../../lib/package-presets"

type NumberField = "length" | "width" | "height" | "weight"

type FormState = Record<NumberField, string> & {
  name: string
  dimension_unit: DimensionUnit | ""
  weight_unit: WeightUnit | ""
  is_default: boolean
}

const initialState: FormState = {
  name: "",
  length: "",
  width: "",
  height: "",
  dimension_unit: "",
  weight: "",
  weight_unit: "",
  is_default: false,
}

const DIMENSION_FIELDS = [
  { field: "length", label: "Length" },
  { field: "width", label: "Width" },
  { field: "height", label: "Height" },
] as const

// Empty inputs are omitted so the API's 400 names the missing field.
const toPayload = (form: FormState): AdminCreatePackagePresetPayload => {
  const payload: AdminCreatePackagePresetPayload = {
    name: form.name,
    is_default: form.is_default,
  }

  for (const field of ["length", "width", "height", "weight"] as const) {
    const value = form[field].trim()

    if (value) {
      payload[field] = Number(value)
    }
  }

  if (form.dimension_unit) {
    payload.dimension_unit = form.dimension_unit
  }

  if (form.weight_unit) {
    payload.weight_unit = form.weight_unit
  }

  return payload
}

export const CreatePackagePresetModal = () => {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<FormState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: createPackagePreset,
    onSuccess: ({ package_preset }) => {
      queryClient.invalidateQueries({ queryKey: packagePresetQueryKeys.all })
      toast.success(`Package preset "${package_preset.name}" created`)
      handleOpenChange(false)
    },
    // A 409 means another preset became the default at the same time.
    onError: (err: Error) => {
      setError(err.message || "Failed to create package preset")
    },
  })

  const handleOpenChange = (next: boolean) => {
    setOpen(next)

    if (!next) {
      setForm(initialState)
      setError(null)
    }
  }

  const setField = <K extends keyof FormState>(field: K, value: FormState[K]) => {
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
          Create preset
        </Button>
      </FocusModal.Trigger>
      <FocusModal.Content>
        <form
          onSubmit={handleSubmit}
          // The API validates every field and its 400 is shown below.
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
                <Heading>Create package preset</Heading>
                <Text
                  size="small"
                  leading="compact"
                  className="text-ui-fg-subtle"
                >
                  A box or envelope you ship orders in: its outer size and the
                  weight of the empty package.
                </Text>
              </div>
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
                <Label htmlFor="package-preset-name" size="small" weight="plus">
                  Name
                </Label>
                <Input
                  id="package-preset-name"
                  value={form.name}
                  onChange={(e) => setField("name", e.target.value)}
                  disabled={isPending}
                />
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                {DIMENSION_FIELDS.map(({ field, label }) => (
                  <div key={field} className="flex flex-col gap-y-2">
                    <Label
                      htmlFor={`package-preset-${field}`}
                      size="small"
                      weight="plus"
                    >
                      {label}
                    </Label>
                    <Input
                      id={`package-preset-${field}`}
                      type="number"
                      inputMode="decimal"
                      step="any"
                      value={form[field]}
                      onChange={(e) => setField(field, e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                ))}
                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus" id="package-preset-dimension-unit">
                    Dimension unit
                  </Label>
                  <Select
                    value={form.dimension_unit}
                    onValueChange={(value) =>
                      setField("dimension_unit", value as DimensionUnit)
                    }
                    disabled={isPending}
                  >
                    <Select.Trigger aria-labelledby="package-preset-dimension-unit">
                      <Select.Value placeholder="Select unit" />
                    </Select.Trigger>
                    <Select.Content>
                      {DIMENSION_UNITS.map((unit) => (
                        <Select.Item key={unit} value={unit}>
                          {unit}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
                <div className="flex flex-col gap-y-2">
                  <Label
                    htmlFor="package-preset-weight"
                    size="small"
                    weight="plus"
                  >
                    Empty weight
                  </Label>
                  <Input
                    id="package-preset-weight"
                    type="number"
                    inputMode="decimal"
                    step="any"
                    value={form.weight}
                    onChange={(e) => setField("weight", e.target.value)}
                    disabled={isPending}
                  />
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus" id="package-preset-weight-unit">
                    Weight unit
                  </Label>
                  <Select
                    value={form.weight_unit}
                    onValueChange={(value) =>
                      setField("weight_unit", value as WeightUnit)
                    }
                    disabled={isPending}
                  >
                    <Select.Trigger aria-labelledby="package-preset-weight-unit">
                      <Select.Value placeholder="Select unit" />
                    </Select.Trigger>
                    <Select.Content>
                      {WEIGHT_UNITS.map((unit) => (
                        <Select.Item key={unit} value={unit}>
                          {unit}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
              </div>
              <div className="flex items-start gap-x-2">
                <Switch
                  id="package-preset-is-default"
                  checked={form.is_default}
                  onCheckedChange={(checked) => setField("is_default", checked)}
                  disabled={isPending}
                />
                <div className="flex flex-col gap-y-1">
                  <Label
                    htmlFor="package-preset-is-default"
                    size="small"
                    weight="plus"
                  >
                    Default package
                  </Label>
                  <Text
                    size="small"
                    leading="compact"
                    className="text-ui-fg-subtle"
                  >
                    Replaces the current default preset.
                  </Text>
                </div>
              </div>
            </div>
          </FocusModal.Body>
        </form>
      </FocusModal.Content>
    </FocusModal>
  )
}
