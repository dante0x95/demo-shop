import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin-auth"

jest.setTimeout(60 * 1000)

const UNKNOWN_ID = "pkgpre_does_not_exist"

const VALID_BODY = {
  name: "Small box",
  length: 30,
  width: 20,
  height: 10.5,
  dimension_unit: "cm",
  weight: 0.25,
  weight_unit: "kg",
}

type Preset = { id: string; is_default: boolean }

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    const createPreset = async (
      body: Record<string, unknown> = {}
    ): Promise<Preset> => {
      const res = await api.post(
        "/admin/package-presets",
        { ...VALID_BODY, ...body },
        adminHeaders
      )
      return res.data.package_preset
    }

    const postPreset = (body: Record<string, unknown>) =>
      api
        .post("/admin/package-presets", { ...VALID_BODY, ...body }, adminHeaders)
        .catch((e) => e.response)

    const getPreset = async (id: string): Promise<Preset> => {
      const res = await api.get(`/admin/package-presets/${id}`, adminHeaders)
      return res.data.package_preset
    }

    const listDefaults = async (): Promise<Preset[]> => {
      const res = await api.get(
        "/admin/package-presets?is_default=true",
        adminHeaders
      )
      return res.data.package_presets
    }

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
    })

    describe("POST /admin/package-presets", () => {
      it("creates a preset", async () => {
        const res = await api.post(
          "/admin/package-presets",
          { ...VALID_BODY, name: " Small box " },
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.package_preset).toEqual({
          id: expect.stringMatching(/^pkgpre_/),
          name: "Small box",
          length: 30,
          width: 20,
          height: 10.5,
          dimension_unit: "cm",
          weight: 0.25,
          weight_unit: "kg",
          is_default: false,
          created_at: expect.any(String),
          updated_at: expect.any(String),
        })
      })

      it("accepts an empty-package weight of 0", async () => {
        const res = await postPreset({ weight: 0, weight_unit: "g" })

        expect(res.status).toBe(200)
        expect(res.data.package_preset).toEqual(
          expect.objectContaining({ weight: 0, weight_unit: "g" })
        )
      })

      it("creates the first default", async () => {
        const created = await createPreset({ is_default: true })

        expect(created.is_default).toBe(true)
        expect(await listDefaults()).toEqual([
          expect.objectContaining({ id: created.id }),
        ])
      })

      it("replaces the current default with a new default", async () => {
        const previous = await createPreset({ name: "Old", is_default: true })
        const current = await createPreset({ name: "New", is_default: true })

        expect(current.is_default).toBe(true)
        expect((await getPreset(previous.id)).is_default).toBe(false)
        expect(await listDefaults()).toEqual([
          expect.objectContaining({ id: current.id }),
        ])
      })

      it("keeps the current default when the new preset is not default", async () => {
        const defaultPreset = await createPreset({ is_default: true })
        const other = await createPreset({ name: "Other", is_default: false })

        expect(other.is_default).toBe(false)
        expect((await getPreset(defaultPreset.id)).is_default).toBe(true)
      })

      it("keeps exactly one default under concurrent default requests", async () => {
        const responses = await Promise.all(
          Array.from({ length: 5 }, (_, i) =>
            postPreset({ name: `Box ${i}`, is_default: true })
          )
        )

        const statuses = responses.map((res) => res.status)

        expect(statuses.every((status) => [200, 409].includes(status))).toBe(
          true
        )
        expect(statuses).toContain(200)
        responses
          .filter((res) => res.status === 409)
          .forEach((res) =>
            expect(res.data.message).toBe(
              "Another package preset was set as the default at the same time. Retry the request."
            )
          )

        expect(await listDefaults()).toHaveLength(1)
      })

      it("returns 400 when name is missing", async () => {
        const res = await postPreset({ name: undefined })

        expect(res.status).toBe(400)
      })

      it("returns 400 for a blank name", async () => {
        const res = await postPreset({ name: "  " })

        expect(res.status).toBe(400)
      })

      it.each(["length", "width", "height"])(
        "returns 400 for a missing, zero or negative %s",
        async (field) => {
          const missing = await postPreset({ [field]: undefined })
          const zero = await postPreset({ [field]: 0 })
          const negative = await postPreset({ [field]: -1 })

          expect(missing.status).toBe(400)
          expect(zero.status).toBe(400)
          expect(negative.status).toBe(400)
        }
      )

      it("returns 400 for a missing or negative weight", async () => {
        const missing = await postPreset({ weight: undefined })
        const negative = await postPreset({ weight: -0.1 })

        expect(missing.status).toBe(400)
        expect(negative.status).toBe(400)
      })

      it("returns 400 for a non-numeric dimension", async () => {
        const res = await postPreset({ length: "30" })

        expect(res.status).toBe(400)
      })

      it("returns 400 for unknown or missing units", async () => {
        const dimension = await postPreset({ dimension_unit: "ft" })
        const weight = await postPreset({ weight_unit: "ton" })
        const missing = await postPreset({ weight_unit: undefined })

        expect(dimension.status).toBe(400)
        expect(weight.status).toBe(400)
        expect(missing.status).toBe(400)
      })

      it("returns 400 for a non-boolean is_default", async () => {
        const res = await postPreset({ is_default: "yes" })

        expect(res.status).toBe(400)
      })

      it("returns 400 for unknown fields", async () => {
        const res = await postPreset({ units: "metric" })

        expect(res.status).toBe(400)
      })

      it("returns 401 without authentication", async () => {
        const res = await api
          .post("/admin/package-presets", VALID_BODY)
          .catch((e) => e.response)

        expect(res.status).toBe(401)
      })
    })

    describe("GET /admin/package-presets", () => {
      it("lists presets newest first with pagination", async () => {
        const first = await createPreset({ name: "First" })
        const second = await createPreset({ name: "Second" })
        const third = await createPreset({ name: "Third" })

        const page1 = await api.get(
          "/admin/package-presets?limit=2",
          adminHeaders
        )

        expect(page1.status).toBe(200)
        expect(page1.data).toEqual(
          expect.objectContaining({ count: 3, offset: 0, limit: 2 })
        )
        expect(page1.data.package_presets.map((p: Preset) => p.id)).toEqual([
          third.id,
          second.id,
        ])

        const page2 = await api.get(
          "/admin/package-presets?limit=2&offset=2",
          adminHeaders
        )

        expect(page2.data).toEqual(
          expect.objectContaining({ count: 3, offset: 2, limit: 2 })
        )
        expect(page2.data.package_presets.map((p: Preset) => p.id)).toEqual([
          first.id,
        ])
      })

      it("filters by is_default", async () => {
        const defaultPreset = await createPreset({ is_default: true })
        const other = await createPreset({ name: "Other" })

        const defaults = await api.get(
          "/admin/package-presets?is_default=true",
          adminHeaders
        )
        const others = await api.get(
          "/admin/package-presets?is_default=false",
          adminHeaders
        )

        expect(defaults.data.package_presets).toEqual([
          expect.objectContaining({ id: defaultPreset.id }),
        ])
        expect(defaults.data.count).toBe(1)
        expect(others.data.package_presets).toEqual([
          expect.objectContaining({ id: other.id }),
        ])
      })

      it("leaves out deleted presets", async () => {
        const kept = await createPreset({ name: "Kept" })
        const removed = await createPreset({ name: "Removed" })

        await api.delete(`/admin/package-presets/${removed.id}`, adminHeaders)

        const res = await api.get("/admin/package-presets", adminHeaders)

        expect(res.data.count).toBe(1)
        expect(res.data.package_presets).toEqual([
          expect.objectContaining({ id: kept.id }),
        ])
      })

      it("returns 400 for an invalid limit", async () => {
        const res = await api
          .get("/admin/package-presets?limit=abc", adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 400 for an invalid is_default", async () => {
        const res = await api
          .get("/admin/package-presets?is_default=yes", adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 400 for unknown query params", async () => {
        const res = await api
          .get("/admin/package-presets?with_deleted=true", adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 401 without authentication", async () => {
        const res = await api
          .get("/admin/package-presets")
          .catch((e) => e.response)

        expect(res.status).toBe(401)
      })
    })

    describe("GET /admin/package-presets/:id", () => {
      it("returns the preset", async () => {
        const created = await createPreset({ is_default: true })

        const res = await api.get(
          `/admin/package-presets/${created.id}`,
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.package_preset).toEqual(created)
      })

      it("returns 400 for unknown query params", async () => {
        const created = await createPreset()

        const res = await api
          .get(`/admin/package-presets/${created.id}?foo=bar`, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 404 for an unknown id", async () => {
        const res = await api
          .get(`/admin/package-presets/${UNKNOWN_ID}`, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(404)
      })

      it("returns 401 without authentication", async () => {
        const created = await createPreset()

        const res = await api
          .get(`/admin/package-presets/${created.id}`)
          .catch((e) => e.response)

        expect(res.status).toBe(401)
      })
    })

    describe("DELETE /admin/package-presets/:id", () => {
      it("deletes the preset", async () => {
        const created = await createPreset()

        const res = await api.delete(
          `/admin/package-presets/${created.id}`,
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data).toEqual({
          id: created.id,
          object: "package_preset",
          deleted: true,
        })

        const after = await api
          .get(`/admin/package-presets/${created.id}`, adminHeaders)
          .catch((e) => e.response)

        expect(after.status).toBe(404)
      })

      it("deleting the default leaves no default and frees the slot", async () => {
        const removed = await createPreset({ is_default: true })

        await api.delete(`/admin/package-presets/${removed.id}`, adminHeaders)

        expect(await listDefaults()).toEqual([])

        const created = await createPreset({ name: "New", is_default: true })

        expect(created.is_default).toBe(true)
        expect(await listDefaults()).toEqual([
          expect.objectContaining({ id: created.id }),
        ])
      })

      it("returns 404 for an already deleted preset", async () => {
        const created = await createPreset()

        await api.delete(`/admin/package-presets/${created.id}`, adminHeaders)

        const res = await api
          .delete(`/admin/package-presets/${created.id}`, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(404)
      })

      it("returns 404 for an unknown id", async () => {
        const res = await api
          .delete(`/admin/package-presets/${UNKNOWN_ID}`, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(404)
      })

      it("returns 401 without authentication", async () => {
        const created = await createPreset()

        const res = await api
          .delete(`/admin/package-presets/${created.id}`)
          .catch((e) => e.response)

        expect(res.status).toBe(401)

        const after = await api.get(
          `/admin/package-presets/${created.id}`,
          adminHeaders
        )

        expect(after.status).toBe(200)
      })
    })
  },
})
