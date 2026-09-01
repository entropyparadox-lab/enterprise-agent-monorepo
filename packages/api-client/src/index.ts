import createClient from 'openapi-fetch'
import type { paths, components } from './schema.d.ts'

export type { paths, components }

export type UserDto = components['schemas']['UserDto']
export type RegisterRequest = components['schemas']['RegisterRequest']
export type LoginRequest = components['schemas']['LoginRequest']
export type AuthResponse = components['schemas']['AuthResponse']
export type UpdateUserRoleRequest = components['schemas']['UpdateUserRoleRequest']
export type ApiKeyInfo = components['schemas']['ApiKeyInfo']
export type CreateApiKeyRequest = components['schemas']['CreateApiKeyRequest']
export type CreateApiKeyResponse = components['schemas']['CreateApiKeyResponse']

export type Order = components['schemas']['Order']
export type CreateOrderRequest = components['schemas']['CreateOrderRequest']
export type UpdateOrderRequest = components['schemas']['UpdateOrderRequest']
export type AuditLog = components['schemas']['AuditLog']
export type HealthResponse = components['schemas']['HealthResponse']
export type ErrorResponse = components['schemas']['ErrorResponse']

export function createApiClient(baseUrl = '') {
  return createClient<paths>({ baseUrl })
}
