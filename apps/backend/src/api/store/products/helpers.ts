import {
  MedusaNextFunction,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { resolveProductSeo } from "../../../modules/seo/utils/product-seo"

type ProductBody = { id?: string; [key: string]: unknown }

type ProductsResponseBody = {
  product?: ProductBody
  products?: ProductBody[]
}

// Sets `seo: { title, description }` on each product, fallbacks applied. The
// values are read in a query of their own, so they don't depend on the
// `fields` the storefront asked for. Titles and descriptions use the
// request's locale, like the product fields core returns.
export const addSeoToProducts = async (
  req: MedusaRequest,
  products: ProductBody[]
) => {
  const ids = products
    .map((product) => product.id)
    .filter((id): id is string => typeof id === "string")

  if (!ids.length) {
    return
  }

  const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)

  const { data } = await query.graph(
    {
      entity: "product",
      fields: [
        "id",
        "title",
        "description",
        "product_seo_override.title",
        "product_seo_override.description",
      ],
      filters: { id: ids },
    },
    { locale: req.locale }
  )

  const seoById = new Map(
    data.map((product) => [
      product.id,
      resolveProductSeo(
        product,
        product.product_seo_override as
          | { title: string | null; description: string | null }
          | null
          | undefined
      ),
    ])
  )

  for (const product of products) {
    const seo = product.id ? seoById.get(product.id) : undefined

    if (seo) {
      product.seo = seo
    }
  }
}

// Core store product routes can't be extended with computed fields, so this
// middleware wraps `res.json`: once the route sends its products, their SEO
// values are added before the body goes out. Error responses pass through.
export const withProductSeo = () => {
  return (
    req: MedusaRequest,
    res: MedusaResponse,
    next: MedusaNextFunction
  ) => {
    const json = res.json.bind(res)

    res.json = ((body: ProductsResponseBody) => {
      res.json = json

      const products = body?.products ?? (body?.product ? [body.product] : [])

      if (res.statusCode >= 400 || !products.length) {
        return json(body)
      }

      addSeoToProducts(req, products)
        .then(() => json(body))
        .catch(next)

      return res
    }) as MedusaResponse["json"]

    next()
  }
}
