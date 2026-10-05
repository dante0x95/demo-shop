import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { METAFIELD_MODULE } from "../../../../modules/metafield"
import MetafieldModuleService from "../../../../modules/metafield/service"

// The metafield module's options as this shop configured them, so the admin
// offers only the owner types the definitions API accepts.
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const metafieldModuleService: MetafieldModuleService =
    req.scope.resolve(METAFIELD_MODULE)
  const { owner_types } = await metafieldModuleService.getOptions()

  res.json({ config: { owner_types } })
}
