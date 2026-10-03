import { model } from "@medusajs/framework/utils"
import Driver from "./driver"

// One invitation per driver. Resending rotates the token in place, so the
// previous link stops matching any row.
const DriverInvite = model.define("driver_invite", {
  id: model.id({ prefix: "drvinv" }).primaryKey(),
  // SHA-256 of the emailed token; the token itself is never stored here.
  token_hash: model.text().unique(),
  expires_at: model.dateTime(),
  accepted_at: model.dateTime().nullable(),
  driver: model.belongsTo(() => Driver, { mappedBy: "invite" }),
})

export default DriverInvite
