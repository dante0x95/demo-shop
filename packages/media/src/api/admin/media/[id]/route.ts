import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { deleteMediaWorkflow } from "../../../../workflows/media/delete-media"

export const DELETE = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  try {
    await deleteMediaWorkflow(req.scope).run({
      input: { id: req.params.id },
    })
  } catch (error) {
    // Medusa's error handler replaces every CONFLICT message with a generic
    // idempotency hint, which would hide which products use the asset.
    if ((error as MedusaError)?.type === MedusaError.Types.CONFLICT) {
      res.status(409).json({
        type: MedusaError.Types.CONFLICT,
        message: (error as MedusaError).message,
      })
      return
    }

    throw error
  }

  res.json({ id: req.params.id, object: "media_asset", deleted: true })
}
