import { z } from 'zod'

const envSchema = z.object({
  VITE_API_URL: z.string().optional().default(''),
  MODE: z.string().optional().default('development'),
  DEV: z.boolean().optional().default(true),
  PROD: z.boolean().optional().default(false),
})

export const env = envSchema.parse({
  VITE_API_URL: import.meta.env.VITE_API_URL,
  MODE: import.meta.env.MODE,
  DEV: import.meta.env.DEV,
  PROD: import.meta.env.PROD,
})
