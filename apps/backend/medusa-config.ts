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
  ],
})
