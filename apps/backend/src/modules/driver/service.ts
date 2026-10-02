import { MedusaService } from "@medusajs/framework/utils"
import Driver from "./models/driver"

class DriverModuleService extends MedusaService({
  Driver,
}) {}

export default DriverModuleService
