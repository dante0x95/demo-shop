import { loadEnv, defineConfig } from '@medusajs/framework/utils'

loadEnv(process.env.NODE_ENV || 'development', process.cwd())

// Unset or empty env vars fall back to the module's defaults.
const optionalNumber = (value?: string) =>
  value?.trim() ? Number(value) : undefined

const optionalList = (value?: string) =>
  value?.trim() ? value.split(',').map((item) => item.trim()) : undefined

module.exports = defineConfig({
  projectConfig: {
    databaseUrl: process.env.DATABASE_URL,
    http: {
      storeCors: process.env.STORE_CORS!,
      adminCors: process.env.ADMIN_CORS!,
      authCors: process.env.AUTH_CORS!,
      jwtSecret: process.env.JWT_SECRET,
      cookieSecret: process.env.COOKIE_SECRET,
    }
  },
  modules: [
    {
      resolve: './src/modules/brand',
    },
    {
      resolve: './src/modules/driver',
    },
    {
      resolve: './src/modules/media',
      options: {
        max_file_size: optionalNumber(process.env.MEDIA_MAX_FILE_SIZE),
        max_files: optionalNumber(process.env.MEDIA_MAX_FILES),
        allowed_mime_types: optionalList(process.env.MEDIA_ALLOWED_MIME_TYPES),
      },
    },
    {
      resolve: './src/modules/metafield',
    },
    {
      resolve: './src/modules/package-preset',
    },
    {
      resolve: './src/modules/seo',
    },
    {
      // Medusa's default local file provider, registered only so file URLs
      // can follow FILE_BACKEND_URL (e.g. the E2E server on another port).
      // Unset keeps the provider's default, http://localhost:9000/static.
      resolve: '@medusajs/medusa/file',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/file-local',
            id: 'local',
            options: {
              backend_url: process.env.FILE_BACKEND_URL?.trim() || undefined,
            },
          },
        ],
      },
    },
    {
      resolve: './src/modules/variant-pricing',
    },
    {
      // Medusa's default local provider (logs instead of sending), extended
      // from "feed" to "email" for driver invitations until a real email
      // provider is set up.
      resolve: '@medusajs/medusa/notification',
      options: {
        providers: [
          {
            resolve: '@medusajs/medusa/notification-local',
            id: 'local',
            options: {
              name: 'Local Notification Provider',
              channels: ['feed', 'email'],
            },
          },
        ],
      },
    },
  ],
})
