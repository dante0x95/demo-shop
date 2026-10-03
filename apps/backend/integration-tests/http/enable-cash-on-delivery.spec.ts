import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  ContainerRegistrationKeys,
  MedusaError,
  Modules,
} from "@medusajs/framework/utils"
import enableCashOnDelivery from "../../src/scripts/enable-cash-on-delivery"
import { createAdminUser } from "../helpers/admin-auth"
import { createPublishableKeyHeaders } from "../helpers/publishable-key"

jest.setTimeout(60 * 1000)

const PROVIDER_ID = "pp_system_default"
// A second, made-up provider: the test env only registers the system one.
const OTHER_PROVIDER_ID = "pp_other_test"

medusaIntegrationTestRunner({
  inApp: true,
  env: {},
  testSuite: ({ api, getContainer }) => {
    let adminHeaders: { headers: Record<string, string> }

    const runScript = (args: string[] = []) =>
      enableCashOnDelivery({ container: getContainer(), args })

    const createRegion = async (name: string) => {
      const regionModuleService = getContainer().resolve(Modules.REGION)
      return regionModuleService.createRegions({ name, currency_code: "eur" })
    }

    const setDefaultRegion = async (regionId: string | null) => {
      const storeModuleService = getContainer().resolve(Modules.STORE)
      const stores = await storeModuleService.listStores()
      expect(stores.length).toBeGreaterThan(0)
      for (const store of stores) {
        await storeModuleService.updateStores(store.id, {
          default_region_id: regionId,
        })
      }
    }

    // Reads the link table directly so a duplicate row can't be hidden by
    // the API returning each provider once.
    const activeLinks = async (regionId: string) => {
      const pg = getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION)
      const { rows } = await pg.raw(
        `SELECT payment_provider_id FROM region_payment_provider
         WHERE region_id = ? AND deleted_at IS NULL
         ORDER BY payment_provider_id`,
        [regionId]
      )
      return rows.map((row) => row.payment_provider_id)
    }

    const adminRegionProviders = async (regionId: string) => {
      const res = await api.get(
        `/admin/regions/${regionId}?fields=id,*payment_providers`,
        adminHeaders
      )
      return res.data.region.payment_providers.map((provider) => provider.id)
    }

    const runScriptError = async (args: string[] = []) => {
      try {
        await runScript(args)
      } catch (error) {
        return error
      }
      throw new Error("Expected the script to fail")
    }

    beforeEach(async () => {
      adminHeaders = await createAdminUser(api, getContainer())
      await setDefaultRegion(null)
    })

    describe("enable-cash-on-delivery script", () => {
      it("enables the provider in the store's default region and the storefront lists it", async () => {
        const region = await createRegion("Argentina")
        await setDefaultRegion(region.id)

        const result = await runScript()

        expect(result).toEqual({
          provider_id: PROVIDER_ID,
          enabled_region_ids: [region.id],
          unchanged_region_ids: [],
        })
        expect(await activeLinks(region.id)).toEqual([PROVIDER_ID])
        expect(await adminRegionProviders(region.id)).toEqual([PROVIDER_ID])

        const storeHeaders = await createPublishableKeyHeaders(getContainer())
        const res = await api.get(
          `/store/payment-providers?region_id=${region.id}`,
          storeHeaders
        )
        expect(res.status).toBe(200)
        expect(res.data.payment_providers).toEqual([
          expect.objectContaining({ id: PROVIDER_ID }),
        ])
      })

      it("running it twice doesn't duplicate the provider", async () => {
        const region = await createRegion("Argentina")
        await setDefaultRegion(region.id)

        await runScript()
        const second = await runScript()

        expect(second).toEqual({
          provider_id: PROVIDER_ID,
          enabled_region_ids: [],
          unchanged_region_ids: [region.id],
        })
        expect(await activeLinks(region.id)).toEqual([PROVIDER_ID])
        expect(await adminRegionProviders(region.id)).toEqual([PROVIDER_ID])
      })

      it("only touches the default region when there are several", async () => {
        const store = await createRegion("Argentina")
        const other = await createRegion("Uruguay")
        await setDefaultRegion(store.id)

        await runScript()

        expect(await activeLinks(store.id)).toEqual([PROVIDER_ID])
        expect(await activeLinks(other.id)).toEqual([])
      })

      it("uses the only region when the store has no default region", async () => {
        const region = await createRegion("Argentina")

        const result = await runScript()

        expect(result.enabled_region_ids).toEqual([region.id])
        expect(await activeLinks(region.id)).toEqual([PROVIDER_ID])
      })

      it("keeps the providers the region already had", async () => {
        const region = await createRegion("Argentina")
        await setDefaultRegion(region.id)

        const pg = getContainer().resolve(ContainerRegistrationKeys.PG_CONNECTION)
        await pg.raw(
          `INSERT INTO payment_provider (id, is_enabled) VALUES (?, true)
           ON CONFLICT (id) DO NOTHING`,
          [OTHER_PROVIDER_ID]
        )
        const link = getContainer().resolve(ContainerRegistrationKeys.LINK)
        await link.create({
          [Modules.REGION]: { region_id: region.id },
          [Modules.PAYMENT]: { payment_provider_id: OTHER_PROVIDER_ID },
        })

        await runScript()

        expect(await activeLinks(region.id)).toEqual([
          OTHER_PROVIDER_ID,
          PROVIDER_ID,
        ])
      })

      it("targets the region ids passed as arguments", async () => {
        const first = await createRegion("Argentina")
        const second = await createRegion("Uruguay")
        const untouched = await createRegion("Chile")
        await setDefaultRegion(untouched.id)

        const result = await runScript([first.id, ` ${second.id} `, first.id])

        expect(result.enabled_region_ids.sort()).toEqual(
          [first.id, second.id].sort()
        )
        expect(await activeLinks(first.id)).toEqual([PROVIDER_ID])
        expect(await activeLinks(second.id)).toEqual([PROVIDER_ID])
        expect(await activeLinks(untouched.id)).toEqual([])
      })

      it("fails on an unknown region id and changes nothing", async () => {
        const region = await createRegion("Argentina")

        const error = await runScriptError([region.id, "reg_unknown"])

        expect(error).toEqual(
          expect.objectContaining({
            type: MedusaError.Types.NOT_FOUND,
            message: "Regions with ids: reg_unknown were not found",
          })
        )
        expect(await activeLinks(region.id)).toEqual([])
      })

      it("fails without picking one when there are several regions and no default", async () => {
        const first = await createRegion("Argentina")
        const second = await createRegion("Uruguay")

        const error = await runScriptError()

        expect(error).toEqual(
          expect.objectContaining({
            type: MedusaError.Types.INVALID_DATA,
            message: expect.stringContaining(
              "2 regions and no default region"
            ),
          })
        )
        expect(await activeLinks(first.id)).toEqual([])
        expect(await activeLinks(second.id)).toEqual([])
      })

      it("fails when no region exists", async () => {
        const error = await runScriptError()

        expect(error).toEqual(
          expect.objectContaining({
            type: MedusaError.Types.NOT_FOUND,
            message: "No region exists; create the store region first",
          })
        )
      })
    })
  },
})
