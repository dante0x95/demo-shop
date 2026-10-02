# Pendientes: Medusa (tienda de ropa + delivery)

## Trabajo en paralelo (2-3 sesiones)
Cada sesión, en su propio worktree, ejecuta `/next-task`: toma cualquier tarea **libre** que
ninguna otra sesión haya reclamado. Detalle: `docs/PLAN.md` → "Parallel work".

Etiquetas: **libre** = todas sus dependencias ya están en `main` ·
**tras Txx** = espera a que esas tareas estén mergeadas.

## Módulos
- [x] brand
- [x] media: biblioteca de medios (media_asset)
- [ ] metafield: definiciones de campos personalizados · T09 · libre
- [ ] package-preset: cajas/paquetes predefinidos · T10 · libre
- [ ] driver: repartidores (actor type propio) · T12 · libre

## Links
- [x] product ↔ brand
- [ ] order ↔ driver · T15 · tras T12

## Workflows
- [ ] create-product-full: producto + variantes + inventario por ubicación + marca · T08 · libre
- [ ] assign-driver: asignar repartidor a un pedido · T15 · tras T12
- [ ] confirm-delivery: marcar entregado + capturar pago contra entrega · T17 + T18 · tras T16

## Endpoints Admin
- [x] GET/POST /admin/brands
- [x] GET/POST/DELETE /admin/brands/:id
- [ ] POST /admin/products/full → workflow create-product-full · T08 · libre
- [x] POST /admin/media (subir + registrar)
- [x] GET /admin/media (biblioteca, con paginación)
- [ ] DELETE /admin/media/:id · T07 · libre si se permite borrar en uso; si se bloquea (409), tras T08
- [ ] GET/POST/DELETE /admin/metafield-definitions · T09 · libre
- [ ] GET/POST/DELETE /admin/package-presets · T10 · libre
- [ ] GET/POST /admin/drivers · T14 · tras T12
- [ ] POST /admin/orders/:id/assign-driver · T15 · tras T12

## Admin UI (panel de Medusa, temporal)
- [x] Marcas: listado + crear
- [x] Marcas: detalle + editar + eliminar (con productos vinculados) + e2e

## Endpoints Driver (protegidos con authenticate("driver"))
- [ ] POST /drivers (registro, junto con /auth/driver/emailpass/register) · T12 · libre
- [ ] GET /drivers/me · T13 · tras T12
- [ ] GET /drivers/me/orders · T16 · tras T13 + T15
- [ ] POST /drivers/me/orders/:id/delivered · T17 · tras T16
- [ ] POST /drivers/me/orders/:id/collect-payment · T18 · tras T11 + T17

## Endpoints Store (storefront + agente de WhatsApp)
- [x] GET /store/brands
- [x] GET /store/brands/:id/products

## Middlewares
- [ ] additional_data.brand_id en creación de producto · T08 · libre
- [ ] authenticate("driver", ["session", "bearer"]) en /drivers/me/* · T13 · tras T12

## Pagos
- [ ] Contra entrega: proveedor manual (system) habilitado en la región · T11 · libre
- [ ] (Opcional) Payment Provider propio si hay reglas por zona o recargo · sin tarea en PLAN

## Reutilización
- [ ] Extraer módulos reutilizables (brand, media, metafield, package-preset) a plugin(s) · T19 · tras T07 + T08 + T09 + T10

## Fuera del MVP
- Colecciones automáticas, taxonomía con atributos, publicación programada,
  redirecciones de handle, descripción con IA, bundles
