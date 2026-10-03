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
  createDriver,
  DRIVER_VEHICLE_TYPES,
  driverQueryKeys,
  DriverVehicleType,
} from "../../../lib/drivers"
import {
  CreateDriverFormState,
  formatDriverName,
  toCreateDriverPayload,
  vehicleTypeLabel,
} from "../utils"

const initialState: CreateDriverFormState = {
  first_name: "",
  last_name: "",
  email: "",
  phone: "",
  vehicle_type: "",
  license_plate: "",
  is_active: false,
}

const TEXT_FIELDS = [
  { field: "first_name", label: "First name", type: "text" },
  { field: "last_name", label: "Last name", type: "text" },
  { field: "email", label: "Email", type: "email" },
  { field: "phone", label: "Phone", type: "tel" },
] as const

type CreateDriverModalProps = {
  // Called after the driver is created, e.g. to show the first page, where
  // the newest driver is listed.
  onCreated?: () => void
}

export const CreateDriverModal = ({ onCreated }: CreateDriverModalProps) => {
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<CreateDriverFormState>(initialState)
  const [error, setError] = useState<string | null>(null)
  const queryClient = useQueryClient()

  const { mutate, isPending } = useMutation({
    mutationFn: createDriver,
    onSuccess: ({ driver }) => {
      queryClient.invalidateQueries({ queryKey: driverQueryKeys.all })
      toast.success(
        `Driver "${formatDriverName(driver)}" created. Invitation sent to ${driver.email}`
      )
      handleOpenChange(false)
      onCreated?.()
    },
    onError: (err: Error) => {
      setError(err.message || "Failed to create driver")
    },
  })

  const handleOpenChange = (next: boolean) => {
    setOpen(next)

    if (!next) {
      setForm(initialState)
      setError(null)
    }
  }

  const setField = <K extends keyof CreateDriverFormState>(
    field: K,
    value: CreateDriverFormState[K]
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }))
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    mutate(toCreateDriverPayload(form))
  }

  return (
    <FocusModal open={open} onOpenChange={handleOpenChange}>
      <FocusModal.Trigger asChild>
        <Button size="small" variant="secondary">
          Create driver
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
                <Heading>Create driver</Heading>
                <Text
                  size="small"
                  leading="compact"
                  className="text-ui-fg-subtle"
                >
                  The driver gets an email with a link to set their password.
                  The link is valid for 7 days.
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
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {TEXT_FIELDS.map(({ field, label, type }) => (
                  <div key={field} className="flex flex-col gap-y-2">
                    <Label
                      htmlFor={`driver-${field}`}
                      size="small"
                      weight="plus"
                    >
                      {label}
                    </Label>
                    <Input
                      id={`driver-${field}`}
                      type={type}
                      value={form[field]}
                      onChange={(e) => setField(field, e.target.value)}
                      disabled={isPending}
                    />
                  </div>
                ))}
                <div className="flex flex-col gap-y-2">
                  <Label size="small" weight="plus" id="driver-vehicle-type">
                    Vehicle type
                  </Label>
                  <Select
                    value={form.vehicle_type}
                    onValueChange={(value) =>
                      setField("vehicle_type", value as DriverVehicleType)
                    }
                    disabled={isPending}
                  >
                    <Select.Trigger aria-labelledby="driver-vehicle-type">
                      <Select.Value placeholder="Select vehicle" />
                    </Select.Trigger>
                    <Select.Content>
                      {DRIVER_VEHICLE_TYPES.map((type) => (
                        <Select.Item key={type} value={type}>
                          {vehicleTypeLabel(type)}
                        </Select.Item>
                      ))}
                    </Select.Content>
                  </Select>
                </div>
                <div className="flex flex-col gap-y-2">
                  <Label
                    htmlFor="driver-license_plate"
                    size="small"
                    weight="plus"
                  >
                    License plate (optional)
                  </Label>
                  <Input
                    id="driver-license_plate"
                    value={form.license_plate}
                    onChange={(e) => setField("license_plate", e.target.value)}
                    disabled={isPending}
                  />
                </div>
              </div>
              <div className="flex items-start gap-x-2">
                <Switch
                  id="driver-is_active"
                  checked={form.is_active}
                  onCheckedChange={(checked) => setField("is_active", checked)}
                  disabled={isPending}
                />
                <div className="flex flex-col gap-y-1">
                  <Label htmlFor="driver-is_active" size="small" weight="plus">
                    Active
                  </Label>
                  <Text
                    size="small"
                    leading="compact"
                    className="text-ui-fg-subtle"
                  >
                    Only active drivers can be assigned orders, confirm
                    deliveries and collect payments.
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
