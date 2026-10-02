import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import {
  listMetafieldDefinitionsTransformQueryConfig,
  retrieveMetafieldDefinitionTransformQueryConfig,
} from "./query-config"
import {
  AdminCreateMetafieldDefinition,
  AdminGetMetafieldDefinitionParams,
  AdminGetMetafieldDefinitionsParams,
} from "./validators"

export const adminMetafieldDefinitionRoutesMiddlewares: MiddlewareRoute[] = [
  {
    method: ["GET"],
    matcher: "/admin/metafield-definitions",
    middlewares: [
      validateAndTransformQuery(
        AdminGetMetafieldDefinitionsParams,
        listMetafieldDefinitionsTransformQueryConfig
      ),
    ],
  },
  {
    method: ["POST"],
    matcher: "/admin/metafield-definitions",
    middlewares: [
      validateAndTransformBody(AdminCreateMetafieldDefinition),
      validateAndTransformQuery(
        AdminGetMetafieldDefinitionParams,
        retrieveMetafieldDefinitionTransformQueryConfig
      ),
    ],
  },
  {
    method: ["GET"],
    matcher: "/admin/metafield-definitions/:id",
    middlewares: [
      validateAndTransformQuery(
        AdminGetMetafieldDefinitionParams,
        retrieveMetafieldDefinitionTransformQueryConfig
      ),
    ],
  },
]
