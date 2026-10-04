import {
  AuthenticatedMedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { MEDIA_MODULE } from "../../../../modules/media"
import MediaModuleService from "../../../../modules/media/service"

// The media module's upload limits as this shop configured them, so the
// admin offers only what the upload API accepts.
export const GET = async (
  req: AuthenticatedMedusaRequest,
  res: MedusaResponse
) => {
  const mediaModuleService: MediaModuleService =
    req.scope.resolve(MEDIA_MODULE)
  const { allowed_mime_types, max_file_size, max_files } =
    await mediaModuleService.getOptions()

  res.json({ config: { allowed_mime_types, max_file_size, max_files } })
}
