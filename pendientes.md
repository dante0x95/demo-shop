# Pendientes: Medusa (tienda de ropa + delivery)

## Módulos
- [x] brand
- [ ] media: biblioteca de medios (media_asset)
- [ ] metafield: definiciones de campos personalizados
- [ ] package-preset: cajas/paquetes predefinidos
- [ ] driver: repartidores (actor type propio)

## Links
- [x] product ↔ brand
- [ ] order ↔ driver

## Workflows
- [ ] create-product-full: producto + variantes + inventario por ubicación + marca
- [ ] assign-driver: asignar repartidor a un pedido
- [ ] confirm-delivery: marcar entregado + capturar pago contra entrega

## Endpoints Admin
- [x] GET/POST /admin/brands
- [x] GET/POST/DELETE /admin/brands/:id
- [ ] POST /admin/products/full → workflow create-product-full
- [ ] POST /admin/media (subir + registrar)
- [ ] GET /admin/media (biblioteca, con paginación)
- [ ] DELETE /admin/media/:id
- [ ] GET/POST/DELETE /admin/metafield-definitions
- [ ] GET/POST/DELETE /admin/package-presets
- [ ] GET/POST /admin/drivers
- [ ] POST /admin/orders/:id/assign-driver

## Admin UI (panel de Medusa, temporal)
- [x] Marcas: listado + crear

## Endpoints Driver (protegidos con authenticate("driver"))
- [ ] POST /drivers (registro, junto con /auth/driver/emailpass/register)
- [ ] GET /drivers/me
- [ ] GET /drivers/me/orders
- [ ] POST /drivers/me/orders/:id/delivered
- [ ] POST /drivers/me/orders/:id/collect-payment

## Endpoints Store (storefront + agente de WhatsApp)
- [x] GET /store/brands
- [ ] GET /store/brands/:id/products

## Middlewares
- [ ] additional_data.brand_id en creación de producto
- [ ] authenticate("driver", ["session", "bearer"]) en /drivers/me/*

## Pagos
- [ ] Contra entrega: proveedor manual (system) habilitado en la región
- [ ] (Opcional) Payment Provider propio si hay reglas por zona o recargo

## Reutilización
- [ ] Extraer módulos reutilizables (brand, media, metafield, package-preset) a plugin(s)

## Fuera del MVP
- Colecciones automáticas, taxonomía con atributos, publicación programada,
  redirecciones de handle, descripción con IA, bundles
