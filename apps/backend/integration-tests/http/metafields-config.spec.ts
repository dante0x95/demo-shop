import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin-auth"

jest.setTimeout(60 * 1000)

// Runs with the metafield module's defaults: medusa-config.ts passes it no
// options.
medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
    })

    describe("GET /admin/metafields/config", () => {
      it("returns the owner types definitions can target", async () => {
        const res = await api.get("/admin/metafields/config", adminHeaders)

        expect(res.status).toBe(200)
        expect(res.data).toEqual({ config: { owner_types: ["product"] } })
      })

      it("lists only owner types the definitions API accepts", async () => {
        const res = await api.get("/admin/metafields/config", adminHeaders)

        for (const owner_type of res.data.config.owner_types) {
          const created = await api.post(
            "/admin/metafield-definitions",
            { key: "fabric", label: "Fabric", type: "text", owner_type },
            adminHeaders
          )

          expect(created.status).toBe(200)
        }
      })

      it("requires an admin session", async () => {
        const res = await api
          .get("/admin/metafields/config")
          .catch((e) => e.response)

        expect(res.status).toBe(401)
      })
    })
  },
})
