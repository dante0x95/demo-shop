import {
  MiddlewareRoute,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import {
  deleteMetafieldDefinitionTransformQueryConfig,
  listMetafieldDefinitionsTransformQueryConfig,
  retrieveMetafieldDefinitionTransformQueryConfig,
} from "./query-config"
import {
  AdminCreateMetafieldDefinition,
  AdminDeleteMetafieldDefinitionParams,
  AdminGetMetafieldDefinitionParams,
  AdminGetMetafieldDefinitionsParams,
  AdminUpdateMetafieldDefinition,
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
  {
    method: ["POST"],
    matcher: "/admin/metafield-definitions/:id",
    middlewares: [
      validateAndTransformBody(AdminUpdateMetafieldDefinition),
      validateAndTransformQuery(
        AdminGetMetafieldDefinitionParams,
        retrieveMetafieldDefinitionTransformQueryConfig
      ),
    ],
  },
  {
    method: ["DELETE"],
    matcher: "/admin/metafield-definitions/:id",
    middlewares: [
      validateAndTransformQuery(
        AdminDeleteMetafieldDefinitionParams,
        deleteMetafieldDefinitionTransformQueryConfig
      ),
    ],
  },
]
