import createClient from 'openapi-fetch'
import type { paths, components } from './schema.d.ts'

export type { paths, components }

export type Order = components['schemas']['Order']
export type CreateOrderRequest = components['schemas']['CreateOrderRequest']
export type UpdateOrderRequest = components['schemas']['UpdateOrderRequest']
export type AuditLog = components['schemas']['AuditLog']
export type HealthResponse = components['schemas']['HealthResponse']

export function createApiClient(baseUrl = '') {
  return createClient<paths>({ baseUrl })
}
