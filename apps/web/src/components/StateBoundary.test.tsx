import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { StateBoundary } from './StateBoundary'

describe('StateBoundary (5-State UI Guard)', () => {
  it('1. Loading state renders animated skeleton fallback', () => {
    const html = renderToStaticMarkup(
      <StateBoundary isLoading={true}>
        <div>Data content</div>
      </StateBoundary>
    )
    expect(html).toContain('data-testid="state-boundary-loading"')
    expect(html).toContain('animate-pulse')
    expect(html).not.toContain('Data content')
  })

  it('2. Error state renders recovery callout with message', () => {
    const html = renderToStaticMarkup(
      <StateBoundary error={new Error('Database query timed out')}>
        <div>Data content</div>
      </StateBoundary>
    )
    expect(html).toContain('data-testid="state-boundary-error"')
    expect(html).toContain('Database query timed out')
    expect(html).not.toContain('Data content')
  })

  it('3. Empty state renders actionable empty callout when array is empty', () => {
    const html = renderToStaticMarkup(
      <StateBoundary
        data={[]}
        emptyMessage="수주 내역이 없습니다."
        emptyAction={<button>신규 등록</button>}
      >
        <div>Data content</div>
      </StateBoundary>
    )
    expect(html).toContain('data-testid="state-boundary-empty"')
    expect(html).toContain('수주 내역이 없습니다.')
    expect(html).toContain('신규 등록')
    expect(html).not.toContain('Data content')
  })

  it('4. Success state renders children with data', () => {
    const orders = [{ id: 'ORD-1', client: '엔트로피패러독스' }]
    const html = renderToStaticMarkup(
      <StateBoundary data={orders}>
        {(items) => (
          <ul>
            {items.map((i) => (
              <li key={i.id}>{i.client}</li>
            ))}
          </ul>
        )}
      </StateBoundary>
    )
    expect(html).toContain('엔트로피패러독스')
    expect(html).not.toContain('state-boundary-loading')
    expect(html).not.toContain('state-boundary-empty')
  })
})
