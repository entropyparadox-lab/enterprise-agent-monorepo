import { test, expect } from '@playwright/test'

test.describe('Frontend Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock the backend API endpoints so visual snapshots are 100% deterministic
    await page.route('/api/health', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          status: 'HEALTHY',
          version: '0.1.0',
          uptime_seconds: 42,
          database: 'CONNECTED_SQLITE_WAL',
        }),
      })
    })

    await page.route('/api/orders*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'ORD-2026-0891',
            client: '엔트로피패러독스',
            items: 'AOT 가속 모듈 4EA',
            amount: 4850000,
            status: '결제완료',
            priority: '높음',
            created_at: '2026-09-01 10:00:00',
            updated_at: '2026-09-01 10:00:00',
          },
          {
            id: 'ORD-2026-0892',
            client: '메타오가닉 코리아',
            items: 'KTCC 5대 지표 분석 센서',
            amount: 12500000,
            status: '배송준비',
            priority: '높음',
            created_at: '2026-08-31 15:30:00',
            updated_at: '2026-08-31 15:30:00',
          },
          {
            id: 'ORD-2026-0893',
            client: '아진글로벌 시스템',
            items: 'Vision AI 엣지 게이트웨이',
            amount: 8900000,
            status: '출고완료',
            priority: '보통',
            created_at: '2026-08-30 09:15:00',
            updated_at: '2026-08-30 09:15:00',
          },
        ]),
      })
    })

    await page.route('/api/audit-logs', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 1,
            log_type: 'deploy',
            user_name: '성호 (DevOps)',
            action: 'Cluster #04 zgate hot-patch applied',
            status: 'SUCCESS',
            created_at: '2026-09-01 12:00:00',
          },
        ]),
      })
    })

    await page.goto('/')
  })

  test('1. ERP Data Grid View Snapshot', async ({ page }) => {
    await expect(page.locator('table')).toBeVisible()
    await expect(page).toHaveScreenshot('erp-data-grid.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('2. New Order Zod Modal Snapshot', async ({ page }) => {
    await page.click('button:has-text("+ 신규 수주 등록")')
    await expect(page.locator('h3:has-text("신규 수주 등록")')).toBeVisible()
    await expect(page).toHaveScreenshot('new-order-modal.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('3. SaaS Dashboard View Snapshot', async ({ page }) => {
    await page.click('button:has-text("2. SaaS 대시보드")')
    await expect(page.locator('text=SaaS 운영 및 실시간 SIEM 감사 로그')).toBeVisible()
    await expect(page).toHaveScreenshot('saas-dashboard.png', {
      maxDiffPixelRatio: 0.02,
    })
  })

  test('4. Mobile Responsive Viewport Snapshot', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await expect(page.locator('header')).toBeVisible()
    await expect(page).toHaveScreenshot('mobile-viewport.png', {
      maxDiffPixelRatio: 0.02,
    })
  })
})
