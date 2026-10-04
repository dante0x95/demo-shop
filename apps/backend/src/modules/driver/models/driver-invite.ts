import { model } from "@medusajs/framework/utils"
import { DRIVER_INVITE_STATUSES } from "../utils/invite-statuses"
import Driver from "./driver"

// Every invitation sent to a driver is its own row. Resending revokes the
// pending one and adds a new one, so an old link never becomes valid again.
const DriverInvite = model
  .define("driver_invite", {
    id: model.id({ prefix: "drvinv" }).primaryKey(),
    // SHA-256 of the emailed token; the token itself is never stored here.
    token_hash: model.text().unique(),
    status: model.enum([...DRIVER_INVITE_STATUSES]).default("pending"),
    expires_at: model.dateTime(),
    accepted_at: model.dateTime().nullable(),
    driver: model.belongsTo(() => Driver, { mappedBy: "invites" }),
  })
  .indexes([
    {
      // At most one pending invitation per driver, also under concurrent
      // requests. Named apart from T14.1's one-invite-per-driver index, which
      // this replaces.
      name: "IDX_driver_invite_driver_id_pending_unique",
      on: ["driver_id"],
      unique: true,
      where: { status: "pending" },
    },
  ])

export default DriverInvite
