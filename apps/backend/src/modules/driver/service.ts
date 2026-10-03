import { MedusaService } from "@medusajs/framework/utils"
import Driver from "./models/driver"
import DriverInvite from "./models/driver-invite"

class DriverModuleService extends MedusaService({
  Driver,
  DriverInvite,
}) {}

export default DriverModuleService
