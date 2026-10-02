import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import multer from "multer"
import { MEDIA_MODULE } from "../../../modules/media"
import MediaModuleService from "../../../modules/media/service"
import { retrieveMediaAssetTransformQueryConfig } from "./query-config"
import { AdminGetMediaAssetParams, AdminUploadMedia } from "./validators"

// Parses the multipart body into memory, capped at the media module's
// max_file_size so oversized files are rejected before being buffered whole.
const parseMediaFiles = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const mediaModuleService: MediaModuleService =
    req.scope.resolve(MEDIA_MODULE)
  const { max_file_size } = await mediaModuleService.getOptions()

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: max_file_size },
  }).array("files")

  upload(req, res, (error?: unknown) => {
    if (error instanceof multer.MulterError) {
      const message =
        error.code === "LIMIT_FILE_SIZE"
          ? `A file exceeds the maximum size of ${max_file_size} bytes`
          : `Invalid upload: ${error.message}${error.field ? ` (${error.field})` : ""}`

      return next(new MedusaError(MedusaError.Types.INVALID_DATA, message))
    }

    next(error)
  })
}

export const adminMediaRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["POST"],
    matcher: "/admin/media",
    middlewares: [
      parseMediaFiles,
      validateAndTransformBody(AdminUploadMedia),
      validateAndTransformQuery(
        AdminGetMediaAssetParams,
        retrieveMediaAssetTransformQueryConfig
      ),
    ],
  },
]
