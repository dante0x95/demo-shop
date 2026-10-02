import { defineLink } from "@medusajs/framework/utils"
import OrderModule from "@medusajs/medusa/order"
import DriverModule from "../modules/driver"

// A driver delivers many orders; an order has at most one driver.
export default defineLink(
  {
    linkable: OrderModule.linkable.order,
    isList: true,
  },
  DriverModule.linkable.driver
)
