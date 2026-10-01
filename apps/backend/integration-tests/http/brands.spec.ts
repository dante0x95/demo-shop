import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { BRAND_MODULE } from "../../src/modules/brand"
import BrandModuleService from "../../src/modules/brand/service"
import { createAdminUser } from "../helpers/admin-auth"

jest.setTimeout(60 * 1000)

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
    })

    describe("POST /admin/brands", () => {
      it("creates a brand with a generated handle and is_active true", async () => {
        const res = await api.post(
          "/admin/brands",
          { name: "Nike Air", logo_url: "https://cdn.example.com/nike.png" },
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.brand).toEqual(
          expect.objectContaining({
            id: expect.stringMatching(/^brand_/),
            name: "Nike Air",
            handle: "nike-air",
            is_active: true,
            description: null,
            logo_url: "https://cdn.example.com/nike.png",
            banner_url: null,
          })
        )
      })

      it("normalizes an explicit handle", async () => {
        const res = await api.post(
          "/admin/brands",
          { name: "Adidas", handle: "Adidas Originals", is_active: false },
          adminHeaders
        )

        expect(res.status).toBe(200)
        expect(res.data.brand.handle).toBe("adidas-originals")
        expect(res.data.brand.is_active).toBe(false)
      })

      it("returns 400 when name is missing", async () => {
        const res = await api
          .post("/admin/brands", { description: "No name" }, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 400 when name is only whitespace", async () => {
        const res = await api
          .post("/admin/brands", { name: "   " }, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 400 when logo_url is not a URL", async () => {
        const res = await api
          .post(
            "/admin/brands",
            { name: "Puma", logo_url: "not-a-url" },
            adminHeaders
          )
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 400 for unknown fields", async () => {
        const res = await api
          .post("/admin/brands", { name: "Puma", color: "red" }, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 400 for a duplicate name regardless of case", async () => {
        await api.post("/admin/brands", { name: "Nike" }, adminHeaders)

        const res = await api
          .post(
            "/admin/brands",
            { name: "NIKE", handle: "nike-two" },
            adminHeaders
          )
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe("A brand with this name already exists")
      })

      it("does not treat LIKE wildcards in the name as patterns", async () => {
        await api.post("/admin/brands", { name: "Brand X" }, adminHeaders)

        const res = await api.post(
          "/admin/brands",
          { name: "Brand_", handle: "brand-underscore" },
          adminHeaders
        )

        expect(res.status).toBe(200)
      })

      it("returns 400 for a duplicate handle", async () => {
        await api.post("/admin/brands", { name: "Nike" }, adminHeaders)

        const res = await api
          .post(
            "/admin/brands",
            { name: "Nike Inc", handle: "nike" },
            adminHeaders
          )
          .catch((e) => e.response)

        expect(res.status).toBe(400)
        expect(res.data.message).toBe("A brand with this handle already exists")
      })

      it("returns 400 when name has no letter or digit to build a handle", async () => {
        const res = await api
          .post("/admin/brands", { name: "!!!" }, adminHeaders)
          .catch((e) => e.response)

        expect(res.status).toBe(400)
      })

      it("returns 401 without authentication", async () => {
        const res = await api
          .post("/admin/brands", { name: "Nike" })
          .catch((e) => e.response)

        expect(res.status).toBe(401)
      })
    })

    describe("concurrent POST /admin/brands", () => {
      it("enforces case-insensitive name uniqueness in the database", async () => {
        const brandModuleService: BrandModuleService =
          getContainer().resolve(BRAND_MODULE)

        await brandModuleService.createBrands({
          name: "Race Brand",
          handle: "race-one",
        })

        await expect(
          brandModuleService.createBrands({
            name: "RACE BRAND",
            handle: "race-two",
          })
        ).rejects.toThrow()
      })

      it("rejects the second of two racing creates with the duplicate-name 400", async () => {
        const brandModuleService: BrandModuleService =
          getContainer().resolve(BRAND_MODULE)
        const listBrands = brandModuleService.listBrands.bind(brandModuleService)

        // Hold both uniqueness checks until each has read the (empty) table,
        // so both requests reach the insert.
        let arrived = 0
        let releaseChecks!: () => void
        const bothChecked = new Promise<void>((resolve) => {
          releaseChecks = resolve
        })
        const listSpy = jest
          .spyOn(brandModuleService, "listBrands")
          .mockImplementation(async (...args) => {
            if (arrived >= 2) {
              return listBrands(...args)
            }
            arrived++
            const result = await listBrands(...args)
            if (arrived === 2) {
              releaseChecks()
            }
            await bothChecked
            return result
          })

        try {
          const responses = await Promise.all([
            api
              .post(
                "/admin/brands",
                { name: "Race Brand", handle: "race-one" },
                adminHeaders
              )
              .catch((e) => e.response),
            api
              .post(
                "/admin/brands",
                { name: "RACE BRAND", handle: "race-two" },
                adminHeaders
              )
              .catch((e) => e.response),
          ])

          // Both early checks saw an empty table, so the 400 comes from the
          // unique index rejecting the second insert.
          expect(arrived).toBe(2)
          expect(responses.map((r) => r.status).sort()).toEqual([200, 400])
          expect(responses.find((r) => r.status === 400).data.message).toBe(
            "A brand with this name already exists"
          )
        } finally {
          listSpy.mockRestore()
        }

        const [, count] = await brandModuleService.listAndCountBrands({
          name: { $ilike: "race brand" },
        })
        expect(count).toBe(1)
      })
    })

    describe("GET /admin/brands", () => {
      beforeEach(async () => {
        for (const name of ["Alpha", "Beta", "Gamma"]) {
          await api.post("/admin/brands", { name }, adminHeaders)
        }
      })

      it("returns a paginated list", async () => {
        const firstPage = await api.get(
          "/admin/brands?limit=2&order=name",
          adminHeaders
        )

        expect(firstPage.status).toBe(200)
        expect(firstPage.data).toEqual({
          brands: [
            expect.objectContaining({ name: "Alpha", handle: "alpha" }),
            expect.objectContaining({ name: "Beta", handle: "beta" }),
          ],
          count: 3,
          offset: 0,
          limit: 2,
        })

        const secondPage = await api.get(
          "/admin/brands?limit=2&offset=2&order=name",
          adminHeaders
        )

        expect(secondPage.data).toEqual({
          brands: [expect.objectContaining({ name: "Gamma" })],
          count: 3,
          offset: 2,
          limit: 2,
        })
      })

      it("uses the default limit of 20", async () => {
        const res = await api.get("/admin/brands", adminHeaders)

        expect(res.data.limit).toBe(20)
        expect(res.data.brands).toHaveLength(3)
      })

      it("returns 401 without authentication", async () => {
        const res = await api.get("/admin/brands").catch((e) => e.response)

        expect(res.status).toBe(401)
      })
    })
  },
})
