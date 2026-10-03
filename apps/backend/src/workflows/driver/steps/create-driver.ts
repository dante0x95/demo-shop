import { createStep, StepResponse } from "@medusajs/framework/workflows-sdk"
import { DRIVER_MODULE } from "../../../modules/driver"
import { DRIVER_VEHICLE_TYPES } from "../../../modules/driver/models/driver"
import DriverModuleService from "../../../modules/driver/service"
import { driverEmailExistsError } from "../utils/driver-email-conflict"

export type CreateDriverStepInput = {
  first_name: string
  last_name: string
  email: string
  phone: string
  vehicle_type: (typeof DRIVER_VEHICLE_TYPES)[number]
  license_plate?: string | null
  is_active?: boolean
  metadata?: Record<string, unknown> | null
}

export const createDriverStep = createStep(
  "create-driver",
  async (input: CreateDriverStepInput, { container }) => {
    const driverModuleService: DriverModuleService =
      container.resolve(DRIVER_MODULE)

    try {
      const driver = await driverModuleService.createDrivers(input)

      return new StepResponse(driver, driver.id)
    } catch (error) {
      // A concurrent request may have inserted the same email after the
      // workflow's early email check ran; the unique index rejects this insert.
      const [existing] = await driverModuleService.listDrivers(
        { email: input.email },
        { select: ["id"], take: 1 }
      )

      throw existing ? driverEmailExistsError() : error
    }
  },
  async (id, { container }) => {
    if (!id) {
      return
    }

    const driverModuleService: DriverModuleService =
      container.resolve(DRIVER_MODULE)

    await driverModuleService.deleteDrivers(id)
  }
)
