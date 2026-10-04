import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin-auth"

jest.setTimeout(60 * 1000)

const UNKNOWN_ID = "mfdef_does_not_exist"

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    const createDefinition = async (body: Record<string, unknown> = {}) => {
      const res = await api.post(
        "/admin/metafield-definitions",
        {
          key: "fabric",
          label: "Fabric",
          type: "text",
          owner_type: "product",
          ...body,
        },
        adminHeaders
      )
      return res.data.metafield_definition
    }

    const postInvalid = (body: Record<string, unknown>) =>
      api
        .post(
          "/admin/metafield-definitions",
          {
            key: "fabric",
            label: "Fabric",
            type: "text",
            owner_type: "product",
            ...body,
          },
          adminHeaders
        )
        .catch((e) => e.response)

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
    })

    describe("POST /admin/metafield-definitions", () => {
      it("creates a text definition", async () => {
        const res = await api.post(
          "/admin/metafield-definitions",
          { key: "fabric", label: "Fabric", type: "text", owner_type: "product" },
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.metafield_definition).toEqual({
          id: expect.stringMatching(/^mfdef_/),
          key: "fabric",
          label: "Fabric",
          type: "text",
          options: null,
          owner_type: "product",
          storefront_access: false,
          created_at: expect.any(String),
          updated_at: expect.any(String),
        })
      })

      it("creates a select definition with trimmed options", async () => {
        const res = await api.post(
          "/admin/metafield-definitions",
          {
            key: "fit",
            label: " Fit ",
            type: "select",
            options: [" slim ", "regular", "oversized"],
            owner_type: "product",
          },
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.metafield_definition).toEqual(
          expect.objectContaining({
            key: "fit",
            label: "Fit",
            type: "select",
            options: ["slim", "regular", "oversized"],
          })
        )
      })

      it("returns 400 when label is missing", async () => {
        const res = await postInvalid({ label: undefined })

        expect(res.status).toBe(400)
      })

      it.each(["Fabric", "1abc", "a-b", "fabric type", ""])(
        "returns 400 for key %p",
        async (key) => {
          const res = await postInvalid({ key })

          expect(res.status).toBe(400)
        }
      )

      it("returns 400 for a key longer than 64 characters", async () => {
        const res = await postInvalid({ key: `a${"b".repeat(64)}` })

        expect(res.status).toBe(400)
      })

      it("returns 400 for an unknown type", async () => {
        const res = await postInvalid({ type: "date" })

        expect(res.status).toBe(400)
      })

      it("returns 400 for a select without options", async () => {
        const missing = await postInvalid({ type: "select" })
        const empty = await postInvalid({ type: "select", options: [] })

        expect(missing.status).toBe(400)
        expect(missing.data.message).toBe(
          "A select metafield definition needs at least one option"
        )
        expect(empty.status).toBe(400)
      })

      it("returns 400 for options on a non-select type", async () => {
        const res = await postInvalid({ type: "text", options: ["a"] })

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          "Options are only allowed for select metafield definitions, not text"
        )
      })

      it("returns 400 for duplicate options", async () => {
        const res = await postInvalid({
          type: "select",
          options: ["slim", " slim"],
        })

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          "Metafield definition options must be unique"
        )
      })

      it("returns 400 for a blank option", async () => {
        const res = await postInvalid({ type: "select", options: ["slim", " "] })

        expect(res.status).toBe(400)
      })

      it("returns 400 for an owner type that is not allowed", async () => {
        const res = await postInvalid({ owner_type: "customer" })

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          "Owner type customer is not allowed. Allowed owner types: product"
        )
      })

      it("returns 400 for a key already used by the owner type", async () => {
        await createDefinition({ key: "fabric" })

        const res = await postInvalid({ key: "fabric", label: "Other" })

        expect(res.status).toBe(400)
        expect(res.data.message).toBe(
          "A metafield definition with key fabric already exists for owner type product"
        )
      })

      it("returns 400 for unknown fields", async () => {
        const res = await postInvalid({ required: true })

        expect(res.status).toBe(400)
      })

      it("returns 401 without authentication", async () => {
        const res = await api
          .post("/admin/metafield-definitions", {
            key: "fabric",
            label: "Fabric",
            type: "text",
            owner_type: "product",
          })
          .catch((e) => e.response)

        expect(res.status).toBe(401)
      })
    })

    describe("GET /admin/metafield-definitions", () => {
      it("lists definitions newest first with pagination", async () => {
        const first = await createDefinition({ key: "first" })
        const second = await createDefinition({ key: "second" })
        const third = await createDefinition({ key: "third" })

        const page1 = await api.get(
          "/admin/metafield-definitions?limit=2",
          adminHeaders
        )

        expect(page1.status).toBe(200)
        expect(page1.data).toEqual(
          expect.objectContaining({ count: 3, offset: 0, limit: 2 })
        )
        expect(
          page1.data.metafield_definitions.map((d: { id: string }) => d.id)
        ).toEqual([third.id, second.id])

        const page2 = await api.get(
          "/admin/metafield-definitions?limit=2&offset=2",
          adminHeaders
        )

        expect(page2.data).toEqual(
          expect.objectContaining({ count: 3, offset: 2, limit: 2 })
        )
        expect(
          page2.data.metafield_definitions.map((d: { id: string }) => d.id)
        ).toEqual([first.id])
      })

      it("filters by owner_type", async () => {
        const definition = await createDefinition({ key: "fabric" })

        const matching = await api.get(
          "/admin/metafield-definitions?owner_type=product",
          adminHeaders
        )
        const other = await api.get(
          "/admin/metafield-definitions?owner_type=customer",
          adminHeaders
        )

        expect(matching.data.metafield_definitions).toEqual([
          expect.objectContaining({ id: definition.id }),
        ])
        expect(other.data.metafield_definitions).toEqual([])
        expect(other.data.count).toBe(0)
      })

      it("leaves out deleted definitions", async () => {
        const kept = await createDefinition({ key: "kept" })
        const removed = await createDefinition({ key: "removed" })

        await api.delete(
          `/admin/metafield-definitions/${removed.id}`,
          adminHeaders
        )

        const res = await api.get("/admin/metafield-definitions", adminHeaders)

        expect(res.data.count).toBe(1)
        expect(res.data.metafield_definitions).toEqual([
          expect.objectContaining({ id: kept.id }),
        ])
      })

      it("returns 400 for an invalid limit", async () => {
        const res = await api
          .get("/admin/metafield-definitions?limit=abc", adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 400 for unknown query params", async () => {
        const res = await api
          .get("/admin/metafield-definitions?with_deleted=true", adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 401 without authentication", async () => {
        const res = await api
          .get("/admin/metafield-definitions")
          .catch((e) => e.response)

        expect(res.status).toBe(401)
      })
    })

    describe("GET /admin/metafield-definitions/:id", () => {
      it("returns the definition", async () => {
        const definition = await createDefinition({
          key: "fit",
          type: "select",
          options: ["slim", "regular"],
        })

        const res = await api.get(
          `/admin/metafield-definitions/${definition.id}`,
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.metafield_definition).toEqual(definition)
      })

      it("returns 404 for an unknown id", async () => {
        const res = await api
          .get(`/admin/metafield-definitions/${UNKNOWN_ID}`, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(404)
      })

      it("returns 401 without authentication", async () => {
        const definition = await createDefinition()

        const res = await api
          .get(`/admin/metafield-definitions/${definition.id}`)
          .catch((e) => e.response)

        expect(res.status).toBe(401)
      })
    })

    describe("DELETE /admin/metafield-definitions/:id", () => {
      it("deletes the definition", async () => {
        const definition = await createDefinition()

        const res = await api.delete(
          `/admin/metafield-definitions/${definition.id}`,
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data).toEqual({
          id: definition.id,
          object: "metafield_definition",
          deleted: true,
        })

        const after = await api
          .get(`/admin/metafield-definitions/${definition.id}`, adminHeaders)
          .catch((e) => e.response)

        expect(after.status).toBe(404)
      })

      it("frees the key for a new definition", async () => {
        const definition = await createDefinition({ key: "fabric" })

        await api.delete(
          `/admin/metafield-definitions/${definition.id}`,
          adminHeaders
        )

        const res = await api.post(
          "/admin/metafield-definitions",
          { key: "fabric", label: "Fabric", type: "text", owner_type: "product" },
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.metafield_definition.id).not.toBe(definition.id)
      })

      it("returns 404 for an already deleted definition", async () => {
        const definition = await createDefinition()

        await api.delete(
          `/admin/metafield-definitions/${definition.id}`,
          adminHeaders
        )

        const res = await api
          .delete(`/admin/metafield-definitions/${definition.id}`, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(404)
      })

      it("returns 404 for an unknown id", async () => {
        const res = await api
          .delete(`/admin/metafield-definitions/${UNKNOWN_ID}`, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(404)
      })

      it("returns 401 without authentication", async () => {
        const definition = await createDefinition()

        const res = await api
          .delete(`/admin/metafield-definitions/${definition.id}`)
          .catch((e) => e.response)

        expect(res.status).toBe(401)

        const after = await api.get(
          `/admin/metafield-definitions/${definition.id}`,
          adminHeaders
        )

        expect(after.status).toBe(200)
      })

      it("returns 400 for an invalid delete_values", async () => {
        const definition = await createDefinition()

        const res = await api
          .delete(
            `/admin/metafield-definitions/${definition.id}?delete_values=yes`,
            adminHeaders
          )
          .catch((e) => e.response)

        expect(res.status).toBe(400)

        const after = await api.get(
          `/admin/metafield-definitions/${definition.id}`,
          adminHeaders
        )

        expect(after.status).toBe(200)
      })
    })

    describe("POST /admin/metafield-definitions/:id", () => {
      const postUpdate = (
        id: string,
        body: Record<string, unknown>,
        headers: unknown = adminHeaders
      ) =>
        api
          .post(`/admin/metafield-definitions/${id}`, body, headers)
          .catch((e) => e.response)

      it("turns storefront access on and off", async () => {
        const definition = await createDefinition()

        const on = await postUpdate(definition.id, { storefront_access: true })

        expect(on.status).toBe(200)
        expect(on.data.metafield_definition).toEqual({
          ...definition,
          storefront_access: true,
          updated_at: expect.any(String),
        })

        const off = await postUpdate(definition.id, {
          storefront_access: false,
        })

        expect(off.data.metafield_definition.storefront_access).toBe(false)

        const stored = await api.get(
          `/admin/metafield-definitions/${definition.id}`,
          adminHeaders
        )

        expect(stored.data.metafield_definition.storefront_access).toBe(false)
      })

      it.each([
        ["no flag", {}],
        ["a non-boolean flag", { storefront_access: "yes" }],
        ["another field", { storefront_access: true, label: "Other" }],
      ])("returns 400 for %s", async (_, body) => {
        const definition = await createDefinition()

        const res = await postUpdate(definition.id, body)

        expect(res.status).toBe(400)
      })

      it("returns 404 for an unknown id", async () => {
        const res = await postUpdate(UNKNOWN_ID, { storefront_access: true })

        expect(res.status).toBe(404)
      })

      it("returns 404 for a deleted definition", async () => {
        const definition = await createDefinition()
        await api.delete(
          `/admin/metafield-definitions/${definition.id}`,
          adminHeaders
        )

        const res = await postUpdate(definition.id, { storefront_access: true })

        expect(res.status).toBe(404)
      })

      it("returns 401 without authentication", async () => {
        const definition = await createDefinition()

        const res = await postUpdate(
          definition.id,
          { storefront_access: true },
          {}
        )

        expect(res.status).toBe(401)
      })
    })
  },
})
