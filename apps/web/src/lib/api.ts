import { createApiClient } from '@repo/api-client'
import { env } from './env'

export const api = createApiClient(env.VITE_API_URL)
