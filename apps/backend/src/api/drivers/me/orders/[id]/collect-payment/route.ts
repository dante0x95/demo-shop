import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import {
  ContainerRegistrationKeys,
  MedusaError,
} from "@medusajs/framework/utils"
import { collectPaymentWorkflow } from "../../../../../../workflows/driver/collect-payment"
import {
  CollectDriverOrderPaymentType,
  GetDriverOrderParamsType,
} from "../../../../validators"

export const POST = async (
  req: AuthenticatedMedusaRequest<
    CollectDriverOrderPaymentType,
    GetDriverOrderParamsType
  >,
  res: MedusaResponse
) => {
  let paymentId: string

  try {
    // The driver id comes from the token, never from the request, so a driver
    // can only collect payment for orders assigned to them.
    const { result } = await collectPaymentWorkflow(req.scope).run({
      input: {
        order_id: req.params.id,
        driver_id: req.auth_context.actor_id,
      },
    })
    paymentId = result.payment_id
  } catch (error) {
    // Medusa's error handler replaces every CONFLICT message with a generic
    // idempotency hint, which would hide that the payment was already
    // collected.
    if ((error as MedusaError)?.type === MedusaError.Types.CONFLICT) {
      res.status(409).json({
        type: MedusaError.Types.CONFLICT,
        message: (error as MedusaError).message,
      })
      return
    }

    throw error
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const [
    {
      data: [order],
    },
    {
      data: [payment],
    },
  ] = await Promise.all([
    query.graph({
      entity: "order",
      fields: req.queryConfig.fields,
      filters: { id: req.params.id },
    }),
    query.graph({
      entity: "payment",
      fields: ["id", "amount", "currency_code", "captured_at"],
      filters: { id: paymentId },
    }),
  ])

  res.json({ order, payment })
}
