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

// Parses the multipart body into memory, capped by the media module's
// max_file_size and max_files so a request can't buffer more than that.
// `alt` is the only text field, sent at most once per file.
const parseMediaFiles = async (
  req: MedusaRequest,
  res: MedusaResponse,
  next: MedusaNextFunction
) => {
  const mediaModuleService: MediaModuleService =
    req.scope.resolve(MEDIA_MODULE)
  const { max_file_size, max_files } = await mediaModuleService.getOptions()

  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: max_file_size, files: max_files, fields: max_files },
  }).array("files")

  upload(req, res, (error?: unknown) => {
    if (error instanceof multer.MulterError) {
      const messages: Partial<Record<multer.ErrorCode, string>> = {
        LIMIT_FILE_SIZE: `A file exceeds the maximum size of ${max_file_size} bytes`,
        LIMIT_FILE_COUNT: `Too many files: the maximum is ${max_files} per request`,
        LIMIT_FIELD_COUNT: `Too many alt fields: the maximum is ${max_files} per request`,
      }
      const message =
        messages[error.code] ??
        `Invalid upload: ${error.message}${error.field ? ` (${error.field})` : ""}`

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
