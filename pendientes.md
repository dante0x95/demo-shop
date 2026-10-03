# Pendientes: Medusa (tienda de ropa + delivery)

## Trabajo en paralelo (2-3 sesiones)
Cada sesión, en su propio worktree, ejecuta `/next-task`: toma cualquier tarea **libre** que
ninguna otra sesión haya reclamado. Detalle: `docs/PLAN.md` → "Parallel work".
Lo que está en curso va en `trabajo.md` (checkout principal, local, no versionado). Los PRs de
tareas no tocan este archivo: los checks y etiquetas se concilian a mano después de mergear.

Etiquetas: **libre** = todas sus dependencias ya están en `main` ·
**tras Txx** = espera a que esas tareas estén mergeadas.

## Módulos
- [x] brand
- [x] media: biblioteca de medios (media_asset)
- [x] metafield: definiciones de campos personalizados
- [x] package-preset: cajas/paquetes predefinidos · T10
- [x] driver: repartidores (actor type propio)

## Links
- [x] product ↔ brand
- [x] order ↔ driver · T15

## Workflows
- [x] create-product-full: producto + variantes + inventario por ubicación + marca · T08
- [x] assign-driver: asignar repartidor a un pedido · T15
- [ ] confirm-delivery: marcar entregado + capturar pago contra entrega · T17 + T18 · T17 hecho, T18 libre

## Endpoints Admin
- [x] GET/POST /admin/brands
- [x] GET/POST/DELETE /admin/brands/:id
- [x] POST /admin/products/full → workflow create-product-full · T08
- [x] POST /admin/media (subir + registrar)
- [x] GET /admin/media (biblioteca, con paginación)
- [x] DELETE /admin/media/:id · T07
- [x] GET/POST/DELETE /admin/metafield-definitions · T09
- [x] GET/POST/DELETE /admin/package-presets · T10
- [x] GET/POST /admin/drivers · T14
- [x] POST /admin/orders/:id/assign-driver · T15

## Admin UI (panel de Medusa, temporal)
- [x] Marcas: listado + crear
- [x] Marcas: detalle + editar + eliminar (con productos vinculados) + e2e

## Endpoints Driver (protegidos con authenticate("driver"))
- [x] POST /drivers (registro, junto con /auth/driver/emailpass/register)
- [x] GET /drivers/me · T13
- [x] GET /drivers/me/orders · T16
- [x] POST /drivers/me/orders/:id/delivered · T17
- [ ] POST /drivers/me/orders/:id/collect-payment · T18 · libre

## Endpoints Store (storefront + agente de WhatsApp)
- [x] GET /store/brands
- [x] GET /store/brands/:id/products

## Middlewares
- [x] additional_data.brand_id en creación de producto · T08
- [x] authenticate("driver", ["session", "bearer"]) en /drivers/me/* · T13

## Pagos
- [x] Contra entrega: proveedor manual (system) habilitado en la región · T11
- [ ] (Opcional) Payment Provider propio si hay reglas por zona o recargo · sin tarea en PLAN

## Reutilización
- [ ] Extraer módulos reutilizables (brand, media, metafield, package-preset) a plugin(s) · T19 · libre

## Fuera del MVP
- Colecciones automáticas, taxonomía con atributos, publicación programada,
  redirecciones de handle, descripción con IA, bundles
