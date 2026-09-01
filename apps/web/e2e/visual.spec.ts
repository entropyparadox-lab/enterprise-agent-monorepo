import { test, expect } from '@playwright/test'

test.describe('Frontend Visual Regression Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Mock backend API endpoints
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

    await page.route('/api/auth/login', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'mock-jwt-token-admin',
          user: {
            id: 'USR-0001',
            email: 'admin@enterprise.local',
            name: '최고 관리자 (Admin)',
            role: 'Admin',
            auth_type: 'Password',
            status: 'Active',
            created_at: '2026-09-01 10:00:00',
          },
        }),
      })
    })

    await page.route('/api/admin/users', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'USR-0001',
            email: 'admin@enterprise.local',
            name: '최고 관리자 (Admin)',
            role: 'Admin',
            auth_type: 'Password',
            status: 'Active',
            created_at: '2026-09-01 10:00:00',
          },
          {
            id: 'USR-0002',
            email: 'operator@enterprise.local',
            name: '운영 리드 (Operator)',
            role: 'Operator',
            auth_type: 'Password',
            status: 'Active',
            created_at: '2026-09-01 10:00:00',
          },
        ]),
      })
    })

    await page.route('/api/admin/api-keys', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'KEY-0001',
            name: 'Hermes CI Worker Bot',
            key_prefix: 'ep_live_a1b2',
            role: 'Admin',
            created_at: '2026-09-01 10:00:00',
            is_active: true,
          },
        ]),
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

  test('5. Backoffice Admin Control Plane View Snapshot', async ({ page }) => {
    // Login as admin first
    await page.click('button:has-text("로그인 / SSO")')
    await page.click('button:has-text("최고 관리자(Admin) 원클릭 로그인")')
    await expect(page.locator('header span:has-text("최고 관리자")')).toBeVisible()

    // Switch to Backoffice Tab
    await page.click('button:has-text("5. 백오피스")')
    await expect(page.locator('text=전사 사용자 권한 & M2M API Key 총괄 관리')).toBeVisible()
    await expect(page).toHaveScreenshot('backoffice-admin-view.png', {
      maxDiffPixelRatio: 0.02,
    })
  })
})
