import { describe, it, expect } from 'vitest'
import { cn } from './utils'
import { z } from 'zod'

const orderSchema = z.object({
  client: z.string().min(2, '고객사명은 최소 2글자 이상이어야 합니다'),
  items: z.string().min(2, '품목 내역을 입력해주세요'),
  amount: z.number().min(1000, '수주 금액은 1,000원 이상이어야 합니다'),
  priority: z.enum(['높음', '보통', '낮음']),
})

describe('Utility & Validation Invariants', () => {
  it('cn() merges tailwind classes without conflict', () => {
    const result = cn('px-2 py-1', 'bg-blue-500', 'px-4')
    expect(result).toBe('py-1 bg-blue-500 px-4')
  })

  it('orderSchema rejects invalid amounts and empty clients', () => {
    const invalid = orderSchema.safeParse({
      client: '',
      items: '품목',
      amount: 500,
      priority: '보통',
    })
    expect(invalid.success).toBe(false)
  })

  it('orderSchema accepts valid enterprise payloads', () => {
    const valid = orderSchema.safeParse({
      client: '엔트로피패러독스',
      items: 'AOT 모듈',
      amount: 4850000,
      priority: '높음',
    })
    expect(valid.success).toBe(true)
  })
})
