import { createApiClient } from '@repo/api-client'
import { env } from './env'
import { useAuthStore } from './authStore'

export const api = createApiClient(env.VITE_API_URL)

// Dynamic middleware injecting Authorization header
api.use({
  onRequest({ request }) {
    const token = useAuthStore.getState().token
    if (token) {
      request.headers.set('Authorization', `Bearer ${token}`)
    }
    return request
  },
})
