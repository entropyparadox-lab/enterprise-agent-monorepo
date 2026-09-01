import { useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query'
import { Toaster, toast } from 'sonner'
import { api } from './lib/api'
import { useAuthStore } from './lib/authStore'
import { StateBoundary } from './components/StateBoundary'
import type { Order, CreateOrderRequest, UpdateOrderRequest } from '@repo/api-client'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 5,
      refetchOnWindowFocus: false,
    },
  },
})

const orderSchema = z.object({
  client: z.string().min(2, '고객사명은 최소 2글자 이상이어야 합니다'),
  items: z.string().min(2, '품목 내역을 입력해주세요'),
  amount: z.number().min(1000, '수주 금액은 1,000원 이상이어야 합니다'),
  priority: z.enum(['높음', '보통', '낮음']),
})

type OrderFormValues = z.infer<typeof orderSchema>

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardShell />
      <Toaster position="bottom-right" richColors theme="light" />
    </QueryClientProvider>
  )
}

function DashboardShell() {
  const [activeTab, setActiveTab] = useState<'erp' | 'saas' | 'cinematic' | 'service' | 'admin'>('admin')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('전체')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)
  const [issuedRawKey, setIssuedRawKey] = useState<string | null>(null)

  // Auth Store
  const { user, isAuthenticated, login, logout } = useAuthStore()

  // Queries
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await api.GET('/api/health')
      if (res.error) throw new Error('API Unreachable')
      return res.data
    },
    refetchInterval: 10000,
  })

  const ordersQuery = useQuery({
    queryKey: ['orders', searchTerm, statusFilter],
    queryFn: async () => {
      const res = await api.GET('/api/orders', {
        params: {
          query: {
            search: searchTerm || undefined,
            status: statusFilter === '전체' ? undefined : statusFilter,
          },
        },
      })
      if (res.error) throw new Error('Failed to fetch orders')
      return res.data
    },
  })

  const auditQuery = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const res = await api.GET('/api/audit-logs')
      if (res.error) throw new Error('Failed to fetch audit logs')
      return res.data
    },
    refetchInterval: 15000,
  })

  const adminUsersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.GET('/api/admin/users')
      if (res.error) throw new Error('Admin permission required')
      return res.data
    },
    enabled: activeTab === 'admin' && user?.role === 'Admin',
  })

  const apiKeysQuery = useQuery({
    queryKey: ['admin-api-keys'],
    queryFn: async () => {
      const res = await api.GET('/api/admin/api-keys')
      if (res.error) throw new Error('Admin permission required')
      return res.data
    },
    enabled: activeTab === 'admin' && user?.role === 'Admin',
  })

  // Mutations
  const updateMutation = useMutation({
    mutationFn: async (payload: { id: string; body: UpdateOrderRequest }) => {
      const res = await api.PUT('/api/orders/{id}', {
        params: { path: { id: payload.id } },
        body: payload.body,
      })
      if (res.error) throw new Error('Update failed')
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success('수주 상태가 변경되었습니다.')
      setEditingOrder(null)
    },
    onError: (err) => toast.error(err.message),
  })

  const createMutation = useMutation({
    mutationFn: async (body: CreateOrderRequest) => {
      const res = await api.POST('/api/orders', { body })
      if (res.error) throw new Error('Creation failed')
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      toast.success('신규 수주가 등록되었습니다.')
      setIsOrderModalOpen(false)
    },
    onError: (err) => toast.error(err.message),
  })

  const updateRoleMutation = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: string }) => {
      const res = await api.PUT('/api/admin/users/{id}/role', {
        params: { path: { id: userId } },
        body: { role },
      })
      if (res.error) throw new Error('Role update failed')
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users'] })
      toast.success('사용자 역할(Role)이 변경되었습니다.')
    },
    onError: (err) => toast.error(err.message),
  })

  const createApiKeyMutation = useMutation({
    mutationFn: async (name: string) => {
      const res = await api.POST('/api/admin/api-keys', {
        body: { name, role: 'Admin' },
      })
      if (res.error) throw new Error('API Key generation failed')
      return res.data
    },
    onSuccess: (data) => {
      if (data) {
        queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] })
        setIssuedRawKey(data.raw_key)
        toast.success('신규 M2M API Key가 발급되었습니다.')
        setIsApiKeyModalOpen(false)
      }
    },
    onError: (err) => toast.error(err.message),
  })

  const revokeApiKeyMutation = useMutation({
    mutationFn: async (keyId: string) => {
      const res = await api.DELETE('/api/admin/api-keys/{id}', {
        params: { path: { id: keyId } },
      })
      if (res.error) throw new Error('Revoke failed')
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-api-keys'] })
      toast.success('API Key가 비활성화되었습니다.')
    },
    onError: (err) => toast.error(err.message),
  })

  const handleQuickLogin = async (email: string) => {
    try {
      const res = await api.POST('/api/auth/login', {
        body: { email, password: 'AdminPass123!' },
      })
      if (res.error || !res.data) throw new Error('Login failed')
      login(res.data.token, res.data.user)
      toast.success(`${res.data.user.name} 계정으로 로그인되었습니다.`)
      setIsAuthModalOpen(false)
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<OrderFormValues>(({
    resolver: zodResolver(orderSchema),
    defaultValues: { priority: '보통', amount: 1000000 },
  }) as any)

  const onSubmitNewOrder = (data: OrderFormValues) => {
    createMutation.mutate({
      client: data.client,
      items: data.items,
      amount: data.amount,
      priority: data.priority,
    })
    reset()
  }

  const handleBatchApprove = () => {
    if (selectedIds.length === 0) return
    selectedIds.forEach((id) => {
      updateMutation.mutate({ id, body: { status: '결제완료' } })
    })
    setSelectedIds([])
  }

  const ordersList = ordersQuery.data || []
  const usersList = adminUsersQuery.data || []
  const apiKeysList = apiKeysQuery.data || []

  return (
    <div className="min-h-screen bg-surface-canvas text-ink-title flex flex-col font-sans antialiased selection:bg-brand-subtle selection:text-brand-primary">
      {/* Top Navbar (Pure Light Editorial) */}
      <header className="h-16 border-b border-surface-border bg-surface-panel/95 backdrop-blur-md px-6 flex items-center justify-between sticky top-0 z-40 shadow-xs">
        <div className="flex items-center gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-button bg-brand-primary flex items-center justify-center text-white font-black text-sm shadow-xs">
              🦀
            </div>
            <div>
              <div className="font-bold text-sm text-ink-title tracking-tight flex items-center gap-2">
                <span>Enterprise Agent Platform</span>
                <span className="px-1.5 py-0.5 rounded-badge text-[10px] font-mono bg-brand-subtle text-brand-primary border border-brand-border font-semibold">
                  v1.0
                </span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-surface-subtle p-1 rounded-card border border-surface-border">
            {[
              { id: 'admin', label: '백오피스 관제' },
              { id: 'erp', label: 'ERP 수주 그리드' },
              { id: 'saas', label: 'SIEM 보안 로그' },
              { id: 'cinematic', label: '시네마틱' },
              { id: 'service', label: '서비스 소개' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3.5 py-1.5 rounded-button text-xs transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-surface-panel text-ink-title shadow-xs font-bold'
                    : 'text-ink-muted hover:text-ink-title hover:bg-surface-canvas font-medium'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Session Status */}
        <div className="flex items-center gap-3">
          {/* Telemetry Badge */}
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-button bg-surface-subtle border border-surface-border text-[11px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                healthQuery.data?.status === 'HEALTHY' ? 'bg-status-success shadow-xs animate-pulse' : 'bg-status-danger'
              }`}
            />
            <span className="text-ink-body font-medium">
              SQLite WAL <span className="text-status-success font-bold">ONLINE</span>
            </span>
          </div>

          {/* User Profile */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2.5 pl-3 border-l border-surface-border">
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-ink-title">{user.name}</span>
                <span className="text-[10px] text-ink-muted font-mono">{user.email}</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-badge text-[10px] font-bold font-mono tracking-wide ${
                  user.role === 'Admin'
                    ? 'bg-ink-title text-white'
                    : user.role === 'Operator'
                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                    : 'bg-surface-subtle text-ink-body border border-surface-border'
                }`}
              >
                {user.role}
              </span>
              <button
                onClick={logout}
                className="px-2.5 py-1 text-xs text-ink-muted hover:text-status-danger hover:bg-status-danger-bg rounded-button transition-colors cursor-pointer"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-4 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-button shadow-xs cursor-pointer transition-all"
            >
              로그인 / SSO
            </button>
          )}
        </div>
      </header>

      {/* Body Content */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        {/* ========================================================================= */}
        {/* TAB: BACKOFFICE CONTROL PLANE (DEFAULT) */}
        {/* ========================================================================= */}
        {activeTab === 'admin' && (
          <div className="space-y-8 animate-in fade-in duration-300">
            {/* Header & Primary Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-mono font-bold tracking-wider text-brand-primary uppercase mb-1">
                  Enterprise Control Plane // RBAC &amp; M2M Keys
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-ink-title tracking-tight">
                  전사 사용자 및 M2M API Key 총괄 관제
                </h1>
                <p className="text-xs text-ink-muted mt-1">
                  사내 구성원 권한(Role) 할당 및 AI 에이전트/CI 자동화 파이프라인 인증키 생명주기를 관리합니다.
                </p>
              </div>

              {user?.role === 'Admin' && (
                <button
                  onClick={() => setIsApiKeyModalOpen(true)}
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-button shadow-xs flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
                >
                  <span>+ 신규 M2M API Key 발급</span>
                </button>
              )}
            </div>

            {/* Non-Admin Warning Guard */}
            {user?.role !== 'Admin' && (
              <div className="p-8 rounded-card bg-surface-panel border border-surface-border text-center space-y-4 shadow-xs">
                <div className="w-12 h-12 rounded-card bg-surface-subtle border border-surface-border text-ink-muted text-2xl flex items-center justify-center mx-auto">
                  🔒
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-ink-title">최고 관리자(Admin) 권한이 필요합니다</h3>
                  <p className="text-xs text-ink-muted max-w-md mx-auto">
                    현재 로그인 계정({user?.email || '게스트'})은 백오피스 관제 권한이 없습니다. 아래 버튼으로 데모 관리자 계정에 즉시 접속할 수 있습니다.
                  </p>
                </div>
                <button
                  onClick={() => handleQuickLogin('admin@enterprise.local')}
                  className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white text-xs font-bold rounded-button shadow-xs cursor-pointer transition-colors"
                >
                  최고 관리자(Admin) 계정으로 전환
                </button>
              </div>
            )}

            {/* Admin Dashboard */}
            {user?.role === 'Admin' && (
              <div className="space-y-8">
                {/* Metric Summary Data Strip (3-Tier Semantic, Zero Data Slop) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-surface-border rounded-card overflow-hidden border border-surface-border shadow-xs">
                  <div className="bg-surface-panel p-5 space-y-1">
                    <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider font-semibold">Total Accounts</div>
                    <div className="text-2xl font-black text-ink-title font-mono tracking-tight">{usersList.length}명</div>
                    <div className="text-[11px] text-status-success flex items-center gap-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-status-success inline-block" /> 계정 활성 동기화됨
                    </div>
                  </div>

                  <div className="bg-surface-panel p-5 space-y-1">
                    <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider font-semibold">Active M2M Keys</div>
                    <div className="text-2xl font-black text-brand-primary font-mono tracking-tight">
                      {apiKeysList.filter((k) => k.is_active).length}개
                    </div>
                    <div className="text-[11px] text-ink-muted flex items-center gap-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-brand-primary inline-block" /> SHA-256 일방향 암호화
                    </div>
                  </div>

                  <div className="bg-surface-panel p-5 space-y-1">
                    <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider font-semibold">Order Volume</div>
                    <div className="text-2xl font-black text-ink-title font-mono tracking-tight">
                      {(ordersList.reduce((acc, o) => acc + o.amount, 0) / 10000).toLocaleString()}만원
                    </div>
                    <div className="text-[11px] text-ink-muted flex items-center gap-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-ink-disabled inline-block" /> {ordersList.length}건 누적 수주
                    </div>
                  </div>

                  <div className="bg-surface-panel p-5 space-y-1">
                    <div className="text-[10px] font-mono text-ink-muted uppercase tracking-wider font-semibold">Database State</div>
                    <div className="text-2xl font-black text-status-success font-mono tracking-tight">ONLINE</div>
                    <div className="text-[11px] text-ink-muted flex items-center gap-1.5 font-medium">
                      <span className="w-1.5 h-1.5 rounded-full bg-status-success animate-pulse inline-block" /> SQLite WAL Mode
                    </div>
                  </div>
                </div>

                {/* Section 1: User & RBAC Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold text-ink-body tracking-wider uppercase font-mono flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-brand-primary" />
                      1. 전사 사용자 및 RBAC 역할 관리 (User Directory)
                    </h2>
                    <span className="text-xs text-ink-muted font-mono font-medium">{usersList.length} Accounts</span>
                  </div>

                  <StateBoundary
                    isLoading={adminUsersQuery.isLoading}
                    error={adminUsersQuery.error}
                    data={usersList}
                    onRetry={() => adminUsersQuery.refetch()}
                    emptyMessage="등록된 전사 사용자가 없습니다."
                  >
                    <div className="rounded-card border border-surface-border bg-surface-panel overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-surface-subtle text-ink-muted font-mono uppercase tracking-wider border-b border-surface-border font-semibold">
                            <tr>
                              <th className="p-3.5">사번/ID</th>
                              <th className="p-3.5">성명</th>
                              <th className="p-3.5">이메일 계정</th>
                              <th className="p-3.5">인증 수단</th>
                              <th className="p-3.5 text-center">할당된 역할 (RBAC)</th>
                              <th className="p-3.5 text-right">가입 일시</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-border/60">
                            {usersList.map((u) => (
                              <tr key={u.id} className="hover:bg-surface-hover transition-colors">
                                <td className="p-3.5 font-mono font-bold text-brand-primary">{u.id}</td>
                                <td className="p-3.5 font-bold text-ink-title">{u.name}</td>
                                <td className="p-3.5 text-ink-body font-mono">{u.email}</td>
                                <td className="p-3.5">
                                  <span className="px-2 py-0.5 rounded-badge text-[10px] font-mono bg-surface-subtle text-ink-body border border-surface-border">
                                    {u.auth_type}
                                  </span>
                                </td>
                                <td className="p-3.5 text-center">
                                  <select
                                    value={u.role}
                                    onChange={(e) => updateRoleMutation.mutate({ userId: u.id, role: e.target.value })}
                                    className="px-2.5 py-1 bg-surface-panel border border-surface-border-subtle rounded-button text-xs text-ink-title focus:outline-none focus:border-brand-primary cursor-pointer font-medium shadow-xs"
                                  >
                                    <option value="Admin">Admin (최고 관리자)</option>
                                    <option value="Operator">Operator (운영자)</option>
                                    <option value="Viewer">Viewer (조회자)</option>
                                  </select>
                                </td>
                                <td className="p-3.5 text-right text-ink-muted font-mono">{u.created_at}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </StateBoundary>
                </div>

                {/* Section 2: M2M API Keys Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-xs font-bold text-ink-body tracking-wider uppercase font-mono flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-brand-primary" />
                      2. M2M AI 에이전트 &amp; CI Scoped API Keys
                    </h2>
                    <span className="text-xs text-ink-muted font-mono font-medium">{apiKeysList.length} Keys Registered</span>
                  </div>

                  <StateBoundary
                    isLoading={apiKeysQuery.isLoading}
                    error={apiKeysQuery.error}
                    data={apiKeysList}
                    onRetry={() => apiKeysQuery.refetch()}
                    emptyMessage="발급된 M2M API Key가 없습니다."
                    emptyAction={
                      <button
                        onClick={() => setIsApiKeyModalOpen(true)}
                        className="px-3.5 py-1.5 bg-brand-primary hover:bg-brand-primary-hover text-white rounded-button text-xs font-bold shadow-xs cursor-pointer"
                      >
                        + 첫 API Key 발급하기
                      </button>
                    }
                  >
                    <div className="rounded-card border border-surface-border bg-surface-panel overflow-hidden shadow-xs">
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-surface-subtle text-ink-muted font-mono uppercase tracking-wider border-b border-surface-border font-semibold">
                            <tr>
                              <th className="p-3.5">Key ID</th>
                              <th className="p-3.5">에이전트 / CI 서비스명</th>
                              <th className="p-3.5">Key Prefix</th>
                              <th className="p-3.5 text-center">접근 권한</th>
                              <th className="p-3.5 text-center">상태</th>
                              <th className="p-3.5 text-right">발급 일시</th>
                              <th className="p-3.5 text-center">관리</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-surface-border/60">
                            {apiKeysList.map((k) => (
                              <tr key={k.id} className="hover:bg-surface-hover transition-colors">
                                <td className="p-3.5 font-mono font-bold text-brand-primary">{k.id}</td>
                                <td className="p-3.5 font-bold text-ink-title">{k.name}</td>
                                <td className="p-3.5 font-mono text-ink-body">
                                  <span className="bg-surface-subtle px-2 py-0.5 rounded-badge border border-surface-border text-[11px]">
                                    {k.key_prefix}...
                                  </span>
                                </td>
                                <td className="p-3.5 text-center">
                                  <span className="px-2.5 py-0.5 rounded-badge text-[10px] font-bold font-mono bg-surface-subtle text-ink-title border border-surface-border">
                                    {k.role}
                                  </span>
                                </td>
                                <td className="p-3.5 text-center">
                                  <span
                                    className={`inline-block px-2 py-0.5 rounded-badge text-[10px] font-bold ${
                                      k.is_active
                                        ? 'bg-status-success-bg text-status-success border border-status-success-border'
                                        : 'bg-status-danger-bg text-status-danger border border-status-danger-border'
                                    }`}
                                  >
                                    {k.is_active ? 'ACTIVE' : 'REVOKED'}
                                  </span>
                                </td>
                                <td className="p-3.5 text-right text-ink-muted font-mono">{k.created_at}</td>
                                <td className="p-3.5 text-center">
                                  {k.is_active && (
                                    <button
                                      onClick={() => revokeApiKeyMutation.mutate(k.id)}
                                      className="px-2.5 py-1 bg-status-danger-bg hover:bg-status-danger-border text-status-danger border border-status-danger-border rounded-button text-[11px] font-medium transition-colors cursor-pointer"
                                    >
                                      비활성화
                                    </button>
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  </StateBoundary>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: ERP GRID */}
        {/* ========================================================================= */}
        {activeTab === 'erp' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <div className="text-xs font-mono font-bold text-brand-primary uppercase mb-1">
                  RUST AXUM 0.8 LIVE BACKEND
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-ink-title tracking-tight">
                  수주 및 배송 총괄 관리
                </h1>
              </div>
              <div className="flex gap-2">
                <a
                  href="http://127.0.0.1:8080/swagger-ui"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-surface-panel hover:bg-surface-subtle text-xs font-medium rounded-button text-ink-body border border-surface-border inline-flex items-center gap-1.5 shadow-xs"
                >
                  <span>OpenAPI Swagger</span>
                  <span>↗</span>
                </a>
                <button
                  onClick={() => setIsOrderModalOpen(true)}
                  className="px-4 py-2 bg-brand-primary hover:bg-brand-primary-hover text-xs font-bold rounded-button text-white shadow-xs cursor-pointer transition-colors"
                >
                  + 신규 수주 등록 (Zod 검증)
                </button>
              </div>
            </div>

            <div className="p-4 bg-surface-panel border border-surface-border rounded-card flex flex-wrap items-center justify-between gap-4 shadow-xs">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="주문번호 또는 고객사 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3.5 py-2 bg-surface-canvas border border-surface-border rounded-input text-xs text-ink-title placeholder-ink-muted focus:outline-none focus:border-brand-primary w-64"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-surface-canvas border border-surface-border rounded-input text-xs text-ink-body focus:outline-none focus:border-brand-primary"
                >
                  <option value="전체">모든 상태</option>
                  <option value="결제완료">결제완료</option>
                  <option value="배송준비">배송준비</option>
                  <option value="출고완료">출고완료</option>
                  <option value="주문취소">주문취소</option>
                </select>
              </div>

              {selectedIds.length > 0 && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-brand-primary font-mono font-semibold">{selectedIds.length}건 선택됨</span>
                  <button
                    onClick={handleBatchApprove}
                    className="px-3 py-1.5 bg-status-success hover:opacity-90 text-white text-xs font-bold rounded-button cursor-pointer shadow-xs"
                  >
                    일괄 결제 승인
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-card border border-surface-border bg-surface-panel overflow-hidden shadow-xs">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-surface-subtle text-ink-muted font-mono uppercase tracking-wider border-b border-surface-border font-semibold">
                    <tr>
                      <th className="p-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === ordersList.length && ordersList.length > 0}
                          onChange={() => {
                            if (selectedIds.length === ordersList.length) setSelectedIds([])
                            else setSelectedIds(ordersList.map((o) => o.id))
                          }}
                          className="rounded bg-surface-panel border-surface-border-subtle text-brand-primary focus:ring-0 cursor-pointer"
                        />
                      </th>
                      <th className="p-4">주문번호</th>
                      <th className="p-4">고객사</th>
                      <th className="p-4">품목 내역</th>
                      <th className="p-4 text-right">수주금액 (원)</th>
                      <th className="p-4 text-center">상태</th>
                      <th className="p-4 text-center">우선순위</th>
                      <th className="p-4">등록일</th>
                      <th className="p-4 text-center">작업</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-surface-border/60">
                    {ordersList.map((ord) => (
                      <tr key={ord.id} className="hover:bg-surface-hover transition-colors">
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(ord.id)}
                            onChange={() => {
                              setSelectedIds((prev) =>
                                prev.includes(ord.id) ? prev.filter((x) => x !== ord.id) : [...prev, ord.id]
                              )
                            }}
                            className="rounded bg-surface-panel border-surface-border-subtle text-brand-primary focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="p-4 font-mono font-bold text-brand-primary">{ord.id}</td>
                        <td className="p-4 font-semibold text-ink-title">{ord.client}</td>
                        <td className="p-4 text-ink-body">{ord.items}</td>
                        <td className="p-4 text-right font-mono font-bold text-ink-title">
                          {ord.amount.toLocaleString()}원
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-badge text-[10px] font-bold ${
                              ord.status === '결제완료'
                                ? 'bg-status-success-bg text-status-success border border-status-success-border'
                                : ord.status === '배송준비'
                                ? 'bg-status-warning-bg text-status-warning border border-status-warning-border'
                                : ord.status === '출고완료'
                                ? 'bg-blue-50 text-blue-700 border border-blue-200'
                                : 'bg-status-danger-bg text-status-danger border border-status-danger-border'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`font-semibold ${
                              ord.priority === '높음'
                                ? 'text-status-danger font-bold'
                                : ord.priority === '보통'
                                ? 'text-ink-body'
                                : 'text-ink-disabled'
                            }`}
                          >
                            {ord.priority}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-ink-muted">{ord.created_at}</td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => setEditingOrder(ord)}
                            className="px-2.5 py-1 bg-surface-subtle hover:bg-surface-canvas text-ink-body border border-surface-border rounded-button text-[11px] font-medium transition-colors cursor-pointer"
                          >
                            상태 수정
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: SAAS DASHBOARD */}
        {/* ========================================================================= */}
        {activeTab === 'saas' && (
          <div className="space-y-6 animate-in fade-in duration-300">
            <h2 className="text-xl font-bold text-ink-title">SaaS 운영 및 실시간 SIEM 감사 로그</h2>
            <div className="p-6 rounded-card bg-surface-panel border border-surface-border space-y-4 shadow-xs">
              <div className="font-semibold text-sm text-ink-title">Rust 백엔드 실시간 감사 이벤트</div>
              <div className="divide-y divide-surface-border/60">
                {(auditQuery.data || []).map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded-badge font-mono text-[11px] font-semibold ${
                          log.status === 'SUCCESS'
                            ? 'bg-status-success-bg text-status-success border border-status-success-border'
                            : 'bg-status-danger-bg text-status-danger border border-status-danger-border'
                        }`}
                      >
                        {log.status}
                      </span>
                      <span className="font-semibold text-ink-title">{log.user_name}</span>
                      <span className="text-ink-body">{log.action}</span>
                    </div>
                    <span className="text-ink-muted font-mono">{log.created_at}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: CINEMATIC */}
        {/* ========================================================================= */}
        {activeTab === 'cinematic' && (
          <div className="p-16 text-center space-y-4 bg-surface-panel rounded-card border border-surface-border shadow-xs">
            <h2 className="text-3xl font-black text-brand-primary">
              Autonomous Rust &amp; React Vibe Matrix
            </h2>
            <p className="text-sm text-ink-muted">MicroVM 1ms 콜드스타트 + Axum 0.8 Zero-GC 아키텍처</p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: SERVICE */}
        {/* ========================================================================= */}
        {activeTab === 'service' && (
          <div className="p-16 text-center space-y-4 bg-surface-panel rounded-card border border-surface-border shadow-xs">
            <h2 className="text-3xl font-bold text-ink-title">엔터프라이즈 사내 표준 플랫폼</h2>
            <p className="text-sm text-ink-muted">OpenAPI 3.1 ➔ TypeScript 100% 자동 타입 동기화 파이프라인</p>
          </div>
        )}
      </main>

      {/* Auth Modal (Login / SSO) */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-ink-title/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-surface-border rounded-card w-full max-w-md p-7 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-border/60 pb-4">
              <div>
                <h3 className="text-lg font-bold text-ink-title">사내 엔터프라이즈 인증</h3>
                <p className="text-xs text-ink-muted mt-0.5">역할(Role)에 맞는 계정을 선택하세요</p>
              </div>
              <button onClick={() => setIsAuthModalOpen(false)} className="text-ink-muted hover:text-ink-title text-lg cursor-pointer">✕</button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2.5">
                <button
                  onClick={() => handleQuickLogin('admin@enterprise.local')}
                  className="w-full py-3 bg-ink-title hover:opacity-90 text-white font-bold rounded-button text-xs flex items-center justify-between px-4 cursor-pointer shadow-xs transition-all"
                >
                  <span className="flex items-center gap-2">
                    <span>👑</span>
                    <span>최고 관리자 (Admin) 원클릭 로그인</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-300">전체 관제 권한</span>
                </button>

                <button
                  onClick={() => handleQuickLogin('operator@enterprise.local')}
                  className="w-full py-3 bg-surface-subtle hover:bg-surface-canvas text-ink-body border border-surface-border font-bold rounded-button text-xs flex items-center justify-between px-4 cursor-pointer transition-all"
                >
                  <span className="flex items-center gap-2">
                    <span>⚙️</span>
                    <span>운영 리드 (Operator) 로그인</span>
                  </span>
                  <span className="text-[10px] font-mono text-ink-muted">수주/출고 권한</span>
                </button>

                <button
                  onClick={() => handleQuickLogin('guest@enterprise.local')}
                  className="w-full py-3 bg-surface-panel hover:bg-surface-subtle text-ink-muted border border-surface-border font-medium rounded-button text-xs flex items-center justify-between px-4 cursor-pointer transition-all"
                >
                  <span className="flex items-center gap-2">
                    <span>👁️</span>
                    <span>조회 전용 (Viewer) 로그인</span>
                  </span>
                  <span className="text-[10px] font-mono text-ink-disabled">읽기 전용</span>
                </button>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-surface-border"></div>
                <span className="flex-shrink mx-3 text-ink-muted text-[11px] font-mono">또는 SSO 연동</span>
                <div className="flex-grow border-t border-surface-border"></div>
              </div>

              <button
                onClick={() => handleQuickLogin('admin@enterprise.local')}
                className="w-full py-3 bg-surface-panel hover:bg-surface-subtle text-ink-body font-medium rounded-button text-xs flex items-center justify-center gap-2 cursor-pointer border border-surface-border shadow-xs"
              >
                <span>🌐</span>
                <span>Google Workspace / MS Entra SSO</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New API Key Modal */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 bg-ink-title/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-surface-border rounded-card w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-border/60 pb-3">
              <h3 className="text-lg font-bold text-ink-title">신규 M2M API Key 발급</h3>
              <button onClick={() => setIsApiKeyModalOpen(false)} className="text-ink-muted hover:text-ink-title text-lg cursor-pointer">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-ink-body mb-1.5 font-medium">에이전트 / CI 서비스 명칭</label>
                <input
                  id="apiKeyNameInput"
                  placeholder="예: Hermes Autonomous Worker Bot"
                  className="w-full p-3 bg-surface-panel border border-surface-border-subtle rounded-input text-ink-title focus:outline-none focus:border-brand-primary"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsApiKeyModalOpen(false)}
                className="px-4 py-2.5 border border-surface-border hover:bg-surface-subtle text-ink-body rounded-button text-xs cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={() => {
                  const input = document.getElementById('apiKeyNameInput') as HTMLInputElement
                  if (input && input.value) {
                    createApiKeyMutation.mutate(input.value)
                  }
                }}
                className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white font-bold rounded-button text-xs shadow-xs cursor-pointer"
              >
                발급 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issued Raw API Key Reveal Popup */}
      {issuedRawKey && (
        <div className="fixed inset-0 bg-ink-title/50 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-surface-border rounded-card w-full max-w-lg p-7 space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-button bg-brand-subtle border border-brand-border text-brand-primary flex items-center justify-center text-xl font-bold">
              🔑
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-ink-title">M2M API Key가 발급되었습니다</h3>
              <p className="text-xs text-status-danger font-medium">
                보안을 위해 이 원시 키는 지금 단 한 번만 표시됩니다. 지금 복사하여 안전하게 보관하세요.
              </p>
            </div>
            <div className="p-3.5 bg-surface-subtle border border-surface-border rounded-button font-mono text-xs text-ink-title break-all select-all flex items-center justify-between gap-3">
              <span className="text-brand-primary font-bold">{issuedRawKey}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(issuedRawKey)
                  toast.success('API Key가 복사되었습니다.')
                }}
                className="px-3 py-1.5 bg-ink-title hover:opacity-90 text-white rounded-button text-xs font-semibold shrink-0 cursor-pointer shadow-xs"
              >
                복사
              </button>
            </div>
            <button
              onClick={() => setIssuedRawKey(null)}
              className="w-full py-3 bg-brand-primary hover:bg-brand-primary-hover text-white font-bold rounded-button text-xs shadow-xs cursor-pointer"
            >
              확인 및 닫기
            </button>
          </div>
        </div>
      )}

      {/* New Order Modal (Zod) */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-ink-title/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit(onSubmitNewOrder)}
            className="bg-surface-panel border border-surface-border rounded-card w-full max-w-lg p-7 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-surface-border/60 pb-3">
              <h3 className="text-lg font-bold text-ink-title">신규 수주 등록 (Zod 검증)</h3>
              <button type="button" onClick={() => setIsOrderModalOpen(false)} className="text-ink-muted hover:text-ink-title text-lg cursor-pointer">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-ink-body mb-1 font-medium">고객사명</label>
                <input
                  {...register('client')}
                  placeholder="예: 엔트로피패러독스"
                  className="w-full p-3 bg-surface-panel border border-surface-border-subtle rounded-input text-ink-title focus:outline-none focus:border-brand-primary"
                />
                {errors.client && <p className="text-status-danger text-[11px] mt-1">{errors.client.message}</p>}
              </div>

              <div>
                <label className="block text-ink-body mb-1 font-medium">품목 내역</label>
                <input
                  {...register('items')}
                  placeholder="예: AOT 가속 모듈 10EA"
                  className="w-full p-3 bg-surface-panel border border-surface-border-subtle rounded-input text-ink-title focus:outline-none focus:border-brand-primary"
                />
                {errors.items && <p className="text-status-danger text-[11px] mt-1">{errors.items.message}</p>}
              </div>

              <div>
                <label className="block text-ink-body mb-1 font-medium">수주 금액 (원)</label>
                <input
                  type="number"
                  {...register('amount', { valueAsNumber: true })}
                  className="w-full p-3 bg-surface-panel border border-surface-border-subtle rounded-input text-ink-title font-mono focus:outline-none focus:border-brand-primary"
                />
                {errors.amount && <p className="text-status-danger text-[11px] mt-1">{errors.amount.message}</p>}
              </div>

              <div>
                <label className="block text-ink-body mb-1 font-medium">우선순위</label>
                <select
                  {...register('priority')}
                  className="w-full p-3 bg-surface-panel border border-surface-border-subtle rounded-input text-ink-title focus:outline-none focus:border-brand-primary"
                >
                  <option value="높음">높음</option>
                  <option value="보통">보통</option>
                  <option value="낮음">낮음</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setIsOrderModalOpen(false)}
                className="px-4 py-2.5 border border-surface-border hover:bg-surface-subtle text-ink-body rounded-button text-xs cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white font-bold rounded-button text-xs shadow-xs cursor-pointer"
              >
                {isSubmitting ? '저장 중...' : 'DB에 등록 완료'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-ink-title/40 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-surface-panel border border-surface-border rounded-card w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-surface-border/60 pb-3">
              <h3 className="text-lg font-bold text-ink-title">수주 상태 변경 ({editingOrder.id})</h3>
              <button onClick={() => setEditingOrder(null)} className="text-ink-muted hover:text-ink-title text-lg cursor-pointer">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-ink-body mb-1 font-medium">고객사</label>
                <input
                  disabled
                  value={editingOrder.client}
                  className="w-full p-3 bg-surface-subtle border border-surface-border rounded-input text-ink-muted"
                />
              </div>

              <div>
                <label className="block text-ink-body mb-1 font-medium">상태 변경</label>
                <select
                  value={editingOrder.status}
                  onChange={(e) => setEditingOrder({ ...editingOrder, status: e.target.value })}
                  className="w-full p-3 bg-surface-panel border border-surface-border-subtle rounded-input text-ink-title focus:outline-none focus:border-brand-primary"
                >
                  <option value="결제완료">결제완료</option>
                  <option value="배송준비">배송준비</option>
                  <option value="출고완료">출고완료</option>
                  <option value="주문취소">주문취소</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setEditingOrder(null)}
                className="px-4 py-2.5 border border-surface-border hover:bg-surface-subtle text-ink-body rounded-button text-xs cursor-pointer"
              >
                취소
              </button>
              <button
                onClick={() => {
                  updateMutation.mutate({
                    id: editingOrder.id,
                    body: { status: editingOrder.status },
                  })
                }}
                className="px-5 py-2.5 bg-brand-primary hover:bg-brand-primary-hover text-white font-bold rounded-button text-xs shadow-xs cursor-pointer"
              >
                저장 완료
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default App
