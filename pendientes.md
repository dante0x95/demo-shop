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
- [x] seo: título y meta descripción por producto (product_seo_override) · T22

## Links
- [x] product ↔ brand
- [x] order ↔ driver · T15
- [x] product → product_seo_override (link de solo lectura) · T22

## Workflows
- [x] create-product-full: producto + variantes + inventario por ubicación + marca · T08
- [x] assign-driver: asignar repartidor a un pedido · T15
- [x] confirm-delivery: marcar entregado + capturar pago contra entrega · T17 + T17.1 + T18

## Endpoints Admin
- [x] GET/POST /admin/brands
- [x] GET/POST/DELETE /admin/brands/:id
- [x] POST /admin/products/full → workflow create-product-full · T08
- [x] POST /admin/media (subir + registrar)
- [x] GET /admin/media (biblioteca, con paginación)
- [x] DELETE /admin/media/:id · T07
- [x] GET/POST/DELETE /admin/metafield-definitions · T09
- [x] GET/POST/DELETE /admin/package-presets · T10
- [x] POST /admin/package-presets/:id/set-default · T27
- [x] GET/POST /admin/products/:id/seo · T22
- [x] GET/POST /admin/drivers · T14
- [x] Invitación de repartidores creados desde el admin (email + reenviar) · T14.1
- [x] Invitación: sin logins compartidos, invitación vencida, códigos de error, sin lock en memoria · T14.2
- [x] POST /admin/orders/:id/assign-driver · T15

## Paridad con el formulario de producto de Shopify
- [x] Valores de metafields por producto · T20
- [x] Precio de comparación (compare-at) y costo por artículo · T21
- [x] SEO: título de página y meta descripción · T22
- [x] Paquete predefinido por producto · T23

## Admin UI (panel de Medusa, temporal)
- [x] Marcas: listado + crear
- [x] Marcas: detalle + editar + eliminar (con productos vinculados) + e2e
- [x] Repartidores: listado + crear + reenviar invitación · T24
- [x] Pedido: widget para asignar repartidor + estado de entrega · T25
- [x] Pedido: estado "parcialmente entregado" + botón de asignar deshabilitado · T25.1
- [x] Biblioteca de medios: explorar + subir + eliminar · T26
- [x] Biblioteca de medios: filtro solo con los tipos permitidos + miniaturas en e2e · T26.1
- [x] Paquetes predefinidos: página de ajustes · T27
- [x] Metafields: definiciones + valores en el producto · T28
- [x] Producto: widgets de compare-at, costo, SEO y paquete · T29
- [ ] Página "Agregar producto" estilo Shopify · T30 · libre

## Endpoints Driver (protegidos con authenticate("driver"))
- [x] POST /drivers (registro, junto con /auth/driver/emailpass/register)
- [x] GET /drivers/me · T13
- [x] GET /drivers/me/orders · T16
- [x] POST /drivers/me/orders/:id/delivered · T17
- [x] Repartidor inactivo no puede confirmar entregas (403) · T17.1
- [x] POST /drivers/me/orders/:id/collect-payment · T18

## Endpoints Store (storefront + agente de WhatsApp)
- [x] GET /store/brands
- [x] GET /store/brands/:id/products
- [x] `seo` resuelto (con fallback) en productos de /store/products y /store/brands/:id/products · T22

## Middlewares
- [x] additional_data.brand_id en creación de producto · T08
- [x] authenticate("driver", ["session", "bearer"]) en /drivers/me/* · T13

## Pagos
- [x] Contra entrega: proveedor manual (system) habilitado en la región · T11
- [ ] (Opcional) Payment Provider propio si hay reglas por zona o recargo · sin tarea en PLAN

## Notificaciones
- [ ] Proveedor real de email (hoy: proveedor local de Medusa, desde T14.1) · sin tarea en PLAN

## Reutilización
- [ ] Extraer módulos reutilizables (brand, media, metafield, package-preset) a plugin(s) · T19 · libre

## Fuera del MVP
- Colecciones automáticas, taxonomía con atributos, publicación programada,
  redirecciones de handle, descripción con IA, bundles
