import { useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query'
import { Toaster, toast } from 'sonner'
import { api } from './lib/api'
import { useAuthStore } from './lib/authStore'
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
      <Toaster position="bottom-right" richColors theme="dark" />
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
  } = useForm<OrderFormValues>({
    resolver: zodResolver(orderSchema),
    defaultValues: { priority: '보통', amount: 1000000 },
  })

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
    <div className="min-h-screen bg-[#090D16] text-slate-100 flex flex-col font-sans antialiased selection:bg-cyan-500/20 selection:text-cyan-300">
      {/* Top Navbar */}
      <header className="h-16 border-b border-slate-800/80 bg-[#0B0F19]/80 backdrop-blur-xl px-6 flex items-center justify-between sticky top-0 z-40">
        <div className="flex items-center gap-6">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center text-slate-950 font-black text-sm shadow-lg shadow-cyan-500/20">
              🦀
            </div>
            <div>
              <div className="font-bold text-sm text-slate-100 tracking-tight flex items-center gap-2">
                <span>Enterprise Agent Platform</span>
                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono bg-cyan-950/80 text-cyan-400 border border-cyan-800/60">
                  v1.0
                </span>
              </div>
            </div>
          </div>

          {/* Tab Navigation */}
          <nav className="hidden md:flex items-center gap-1 bg-slate-900/90 p-1 rounded-xl border border-slate-800/80">
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
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 shadow-md shadow-cyan-500/25 font-bold'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
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
          <div className="hidden lg:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-slate-900/60 border border-slate-800 text-[11px] font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                healthQuery.data?.status === 'HEALTHY' ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse' : 'bg-rose-400'
              }`}
            />
            <span className="text-slate-400 font-medium">
              SQLite WAL <span className="text-emerald-400 font-bold">ONLINE</span>
            </span>
          </div>

          {/* User Profile */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-2.5 pl-3 border-l border-slate-800">
              <div className="flex flex-col text-right">
                <span className="text-xs font-bold text-slate-200">{user.name}</span>
                <span className="text-[10px] text-slate-400 font-mono">{user.email}</span>
              </div>
              <span
                className={`px-2 py-0.5 rounded-md text-[10px] font-bold font-mono tracking-wide ${
                  user.role === 'Admin'
                    ? 'bg-purple-950/80 text-purple-300 border border-purple-800/60'
                    : user.role === 'Operator'
                    ? 'bg-blue-950/80 text-blue-300 border border-blue-800/60'
                    : 'bg-slate-800 text-slate-400'
                }`}
              >
                {user.role}
              </span>
              <button
                onClick={logout}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-rose-400 hover:bg-rose-950/20 rounded-lg transition-colors cursor-pointer"
              >
                로그아웃
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="px-4 py-1.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 text-xs font-bold rounded-xl shadow-lg shadow-cyan-500/20 cursor-pointer transition-all"
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
                <div className="text-xs font-mono font-semibold tracking-wider text-cyan-400 uppercase mb-1">
                  Enterprise Control Plane & RBAC
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                  전사 사용자 및 M2M API Key 총괄 관제
                </h1>
                <p className="text-xs text-slate-400 mt-1">
                  사내 구성원 권한(Role) 할당 및 AI 에이전트/CI 자동화 파이프라인 인증키 생명주기를 관리합니다.
                </p>
              </div>

              {user?.role === 'Admin' && (
                <button
                  onClick={() => setIsApiKeyModalOpen(true)}
                  className="px-4 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/25 flex items-center justify-center gap-2 cursor-pointer transition-all"
                >
                  <span>🔑</span>
                  <span>신규 M2M API Key 발급</span>
                </button>
              )}
            </div>

            {/* Non-Admin Warning Guard */}
            {user?.role !== 'Admin' && (
              <div className="p-8 rounded-2xl bg-gradient-to-b from-slate-900/90 to-slate-950 border border-slate-800 text-center space-y-4 shadow-2xl">
                <div className="w-12 h-12 rounded-2xl bg-purple-950/60 border border-purple-800/80 text-purple-400 text-2xl flex items-center justify-center mx-auto">
                  🔒
                </div>
                <div className="space-y-1">
                  <h3 className="text-base font-bold text-white">최고 관리자(Admin) 권한이 필요합니다</h3>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    현재 로그인 계정({user?.email || '게스트'})은 백오피스 관제 권한이 없습니다. 아래 버튼으로 데모 관리자 계정에 즉시 접속할 수 있습니다.
                  </p>
                </div>
                <button
                  onClick={() => handleQuickLogin('admin@enterprise.local')}
                  className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold rounded-xl shadow-lg shadow-purple-600/30 cursor-pointer"
                >
                  최고 관리자(Admin) 계정으로 전환
                </button>
              </div>
            )}

            {/* Admin Dashboard */}
            {user?.role === 'Admin' && (
              <div className="space-y-8">
                {/* Metric Summary Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-lg space-y-2">
                    <div className="text-xs font-mono text-slate-400">TOTAL ENTERPRISE USERS</div>
                    <div className="text-2xl font-black text-white font-mono">{usersList.length}명</div>
                    <div className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
                      <span>●</span> 전사 계정 활성 동기화됨
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-lg space-y-2">
                    <div className="text-xs font-mono text-slate-400">ACTIVE M2M API KEYS</div>
                    <div className="text-2xl font-black text-purple-400 font-mono">
                      {apiKeysList.filter((k) => k.is_active).length}개
                    </div>
                    <div className="text-[11px] text-purple-400 flex items-center gap-1 font-medium">
                      <span>●</span> SHA-256 일방향 해시 암호화
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-lg space-y-2">
                    <div className="text-xs font-mono text-slate-400">TOTAL REVENUE (ORDERS)</div>
                    <div className="text-2xl font-black text-cyan-400 font-mono">
                      {(ordersList.reduce((acc, o) => acc + o.amount, 0) / 10000).toLocaleString()}만원
                    </div>
                    <div className="text-[11px] text-cyan-400 flex items-center gap-1 font-medium">
                      <span>●</span> {ordersList.length}건 누적 수주
                    </div>
                  </div>

                  <div className="p-5 rounded-2xl bg-slate-900/60 border border-slate-800/80 shadow-lg space-y-2">
                    <div className="text-xs font-mono text-slate-400">SECURITY AUDIT STATUS</div>
                    <div className="text-2xl font-black text-emerald-400 font-mono">HEALTHY</div>
                    <div className="text-[11px] text-slate-400 flex items-center gap-1 font-medium">
                      <span>●</span> 0 Auth Failures Detected
                    </div>
                  </div>
                </div>

                {/* Section 1: User & RBAC Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-200 tracking-wide font-mono flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-cyan-400" />
                      1. 전사 사용자 및 RBAC 역할 관리 (User Directory)
                    </h2>
                    <span className="text-xs text-slate-500 font-mono">{usersList.length} Accounts</span>
                  </div>

                  <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/90 text-slate-400 font-mono uppercase tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="p-4">사번/ID</th>
                            <th className="p-4">성명</th>
                            <th className="p-4">이메일 계정</th>
                            <th className="p-4">인증 수단</th>
                            <th className="p-4 text-center">할당된 역할 (RBAC)</th>
                            <th className="p-4 text-right">가입 일시</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {usersList.map((u) => (
                            <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="p-4 font-mono font-bold text-cyan-400">{u.id}</td>
                              <td className="p-4 font-bold text-white">{u.name}</td>
                              <td className="p-4 text-slate-300 font-mono">{u.email}</td>
                              <td className="p-4">
                                <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                                  {u.auth_type}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <select
                                  value={u.role}
                                  onChange={(e) => updateRoleMutation.mutate({ userId: u.id, role: e.target.value })}
                                  className="px-3 py-1.5 bg-slate-950 border border-slate-700 rounded-lg text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer font-medium"
                                >
                                  <option value="Admin">Admin (최고 관리자)</option>
                                  <option value="Operator">Operator (운영자)</option>
                                  <option value="Viewer">Viewer (조회자)</option>
                                </select>
                              </td>
                              <td className="p-4 text-right text-slate-500 font-mono">{u.created_at}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>

                {/* Section 2: M2M API Keys Grid */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-200 tracking-wide font-mono flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-purple-400" />
                      2. M2M AI 에이전트 & CI Scoped API Keys
                    </h2>
                    <span className="text-xs text-slate-500 font-mono">{apiKeysList.length} Keys Registered</span>
                  </div>

                  <div className="rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md overflow-hidden shadow-xl">
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-slate-900/90 text-slate-400 font-mono uppercase tracking-wider border-b border-slate-800">
                          <tr>
                            <th className="p-4">Key ID</th>
                            <th className="p-4">에이전트 / CI 서비스명</th>
                            <th className="p-4">Key Prefix</th>
                            <th className="p-4 text-center">접근 권한</th>
                            <th className="p-4 text-center">상태</th>
                            <th className="p-4 text-right">발급 일시</th>
                            <th className="p-4 text-center">관리</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/60">
                          {apiKeysList.map((k) => (
                            <tr key={k.id} className="hover:bg-slate-800/30 transition-colors">
                              <td className="p-4 font-mono font-bold text-purple-400">{k.id}</td>
                              <td className="p-4 font-bold text-white">{k.name}</td>
                              <td className="p-4 font-mono text-slate-300">
                                <span className="bg-slate-950 px-2 py-1 rounded border border-slate-800">
                                  {k.key_prefix}...
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-purple-950 text-purple-300 border border-purple-800">
                                  {k.role}
                                </span>
                              </td>
                              <td className="p-4 text-center">
                                <span
                                  className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                                    k.is_active
                                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                      : 'bg-rose-950 text-rose-400 border border-rose-800'
                                  }`}
                                >
                                  {k.is_active ? 'ACTIVE' : 'REVOKED'}
                                </span>
                              </td>
                              <td className="p-4 text-right text-slate-500 font-mono">{k.created_at}</td>
                              <td className="p-4 text-center">
                                {k.is_active && (
                                  <button
                                    onClick={() => revokeApiKeyMutation.mutate(k.id)}
                                    className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 rounded-lg text-[11px] font-medium transition-colors cursor-pointer"
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
                <div className="text-xs font-mono font-semibold text-cyan-400 uppercase mb-1">
                  RUST AXUM 0.8 LIVE BACKEND
                </div>
                <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">
                  수주 및 배송 총괄 관리
                </h1>
              </div>
              <div className="flex gap-2">
                <a
                  href="http://127.0.0.1:8080/swagger-ui"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-xs font-medium rounded-xl text-slate-200 border border-slate-800 inline-flex items-center gap-1.5"
                >
                  <span>OpenAPI Swagger</span>
                  <span>↗</span>
                </a>
                <button
                  onClick={() => setIsOrderModalOpen(true)}
                  className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-xs font-bold rounded-xl text-slate-950 shadow-lg shadow-cyan-500/20 cursor-pointer"
                >
                  + 신규 수주 등록 (Zod 검증)
                </button>
              </div>
            </div>

            <div className="p-4 bg-slate-900/60 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="주문번호 또는 고객사 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3.5 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 w-64"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
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
                  <span className="text-xs text-cyan-400 font-mono">{selectedIds.length}건 선택됨</span>
                  <button
                    onClick={handleBatchApprove}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    일괄 결제 승인
                  </button>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 backdrop-blur-md overflow-hidden shadow-2xl">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-slate-400 font-mono uppercase tracking-wider border-b border-slate-800">
                    <tr>
                      <th className="p-4 w-10 text-center">
                        <input
                          type="checkbox"
                          checked={selectedIds.length === ordersList.length && ordersList.length > 0}
                          onChange={() => {
                            if (selectedIds.length === ordersList.length) setSelectedIds([])
                            else setSelectedIds(ordersList.map((o) => o.id))
                          }}
                          className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0"
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
                  <tbody className="divide-y divide-slate-800/60">
                    {ordersList.map((ord) => (
                      <tr key={ord.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-center">
                          <input
                            type="checkbox"
                            checked={selectedIds.includes(ord.id)}
                            onChange={() => {
                              setSelectedIds((prev) =>
                                prev.includes(ord.id) ? prev.filter((x) => x !== ord.id) : [...prev, ord.id]
                              )
                            }}
                            className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
                          />
                        </td>
                        <td className="p-4 font-mono font-bold text-cyan-400">{ord.id}</td>
                        <td className="p-4 font-medium text-white">{ord.client}</td>
                        <td className="p-4 text-slate-400">{ord.items}</td>
                        <td className="p-4 text-right font-mono font-bold text-slate-200">
                          {ord.amount.toLocaleString()}원
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                              ord.status === '결제완료'
                                ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                : ord.status === '배송준비'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : ord.status === '출고완료'
                                ? 'bg-blue-950 text-blue-400 border border-blue-800'
                                : 'bg-rose-950 text-rose-400 border border-rose-800'
                            }`}
                          >
                            {ord.status}
                          </span>
                        </td>
                        <td className="p-4 text-center">
                          <span
                            className={`font-semibold ${
                              ord.priority === '높음'
                                ? 'text-rose-400'
                                : ord.priority === '보통'
                                ? 'text-slate-300'
                                : 'text-slate-500'
                            }`}
                          >
                            {ord.priority}
                          </span>
                        </td>
                        <td className="p-4 font-mono text-slate-400">{ord.created_at}</td>
                        <td className="p-4 text-center">
                          <button
                            onClick={() => setEditingOrder(ord)}
                            className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded text-[11px] font-medium transition-colors cursor-pointer"
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
            <h2 className="text-xl font-bold text-white">SaaS 운영 및 실시간 SIEM 감사 로그</h2>
            <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
              <div className="font-semibold text-sm text-slate-200">Rust 백엔드 실시간 감사 이벤트</div>
              <div className="divide-y divide-slate-800">
                {(auditQuery.data || []).map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded font-mono ${
                          log.status === 'SUCCESS'
                            ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                            : 'bg-rose-950 text-rose-400 border border-rose-800'
                        }`}
                      >
                        {log.status}
                      </span>
                      <span className="font-semibold text-slate-300">{log.user_name}</span>
                      <span className="text-slate-400">{log.action}</span>
                    </div>
                    <span className="text-slate-500 font-mono">{log.created_at}</span>
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
          <div className="p-16 text-center space-y-4 bg-slate-900/40 rounded-2xl border border-slate-800">
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              Autonomous Rust & React Vibe Matrix
            </h2>
            <p className="text-sm text-slate-400">MicroVM 1ms 콜드스타트 + Axum 0.8 Zero-GC 아키텍처</p>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB: SERVICE */}
        {/* ========================================================================= */}
        {activeTab === 'service' && (
          <div className="p-16 text-center space-y-4 bg-slate-900/40 rounded-2xl border border-slate-800">
            <h2 className="text-3xl font-bold text-white">엔터프라이즈 사내 표준 플랫폼</h2>
            <p className="text-sm text-slate-400">OpenAPI 3.1 ➔ TypeScript 100% 자동 타입 동기화 파이프라인</p>
          </div>
        )}
      </main>

      {/* Auth Modal (Login / SSO) */}
      {isAuthModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-slate-800 rounded-3xl w-full max-w-md p-7 space-y-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
              <div>
                <h3 className="text-lg font-bold text-white">사내 엔터프라이즈 인증</h3>
                <p className="text-xs text-slate-400 mt-0.5">역할(Role)에 맞는 계정을 선택하세요</p>
              </div>
              <button onClick={() => setIsAuthModalOpen(false)} className="text-slate-500 hover:text-white text-lg">✕</button>
            </div>

            <div className="space-y-4">
              <div className="space-y-2.5">
                <button
                  onClick={() => handleQuickLogin('admin@enterprise.local')}
                  className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs flex items-center justify-between px-4 cursor-pointer shadow-lg shadow-purple-600/25 transition-all"
                >
                  <span className="flex items-center gap-2">
                    <span>👑</span>
                    <span>최고 관리자 (Admin) 원클릭 로그인</span>
                  </span>
                  <span className="text-[10px] font-mono opacity-80">전체 관제 권한</span>
                </button>

                <button
                  onClick={() => handleQuickLogin('operator@enterprise.local')}
                  className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold rounded-xl text-xs flex items-center justify-between px-4 cursor-pointer transition-all"
                >
                  <span className="flex items-center gap-2">
                    <span>⚙️</span>
                    <span>운영 리드 (Operator) 로그인</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-400">수주/출고 권한</span>
                </button>

                <button
                  onClick={() => handleQuickLogin('guest@enterprise.local')}
                  className="w-full py-3 bg-slate-900/60 hover:bg-slate-800/60 text-slate-400 border border-slate-800 font-medium rounded-xl text-xs flex items-center justify-between px-4 cursor-pointer transition-all"
                >
                  <span className="flex items-center gap-2">
                    <span>👁️</span>
                    <span>조회 전용 (Viewer) 로그인</span>
                  </span>
                  <span className="text-[10px] font-mono text-slate-500">읽기 전용</span>
                </button>
              </div>

              <div className="relative flex py-2 items-center">
                <div className="flex-grow border-t border-slate-800"></div>
                <span className="flex-shrink mx-3 text-slate-500 text-[11px] font-mono">또는 SSO 연동</span>
                <div className="flex-grow border-t border-slate-800"></div>
              </div>

              <button
                onClick={() => handleQuickLogin('admin@enterprise.local')}
                className="w-full py-3 bg-slate-900 hover:bg-slate-800 text-slate-300 font-medium rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer border border-slate-800"
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
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">신규 M2M API Key 발급</h3>
              <button onClick={() => setIsApiKeyModalOpen(false)} className="text-slate-500 hover:text-white text-lg">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">에이전트 / CI 서비스 명칭</label>
                <input
                  id="apiKeyNameInput"
                  placeholder="예: Hermes Autonomous Worker Bot"
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-purple-500"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsApiKeyModalOpen(false)}
                className="px-4 py-2.5 border border-slate-800 hover:bg-slate-900 text-slate-300 rounded-xl text-xs"
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
                className="px-5 py-2.5 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/25 cursor-pointer"
              >
                발급 완료
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Issued Raw API Key Reveal Popup */}
      {issuedRawKey && (
        <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-purple-800/80 rounded-3xl w-full max-w-lg p-7 space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-purple-950/80 border border-purple-800 text-purple-400 flex items-center justify-center text-xl font-bold">
              🔑
            </div>
            <div className="space-y-1">
              <h3 className="text-lg font-bold text-white">M2M API Key가 발급되었습니다</h3>
              <p className="text-xs text-rose-400">
                보안을 위해 이 원시 키는 지금 단 한 번만 표시됩니다. 지금 복사하여 안전하게 보관하세요.
              </p>
            </div>
            <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl font-mono text-xs text-cyan-400 break-all select-all flex items-center justify-between gap-3">
              <span>{issuedRawKey}</span>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(issuedRawKey)
                  toast.success('API Key가 복사되었습니다.')
                }}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-lg text-xs font-semibold shrink-0 cursor-pointer"
              >
                복사
              </button>
            </div>
            <button
              onClick={() => setIssuedRawKey(null)}
              className="w-full py-3 bg-purple-600 hover:bg-purple-500 text-white font-bold rounded-xl text-xs shadow-lg shadow-purple-600/25 cursor-pointer"
            >
              확인 및 닫기
            </button>
          </div>
        </div>
      )}

      {/* New Order Modal (Zod) */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit(onSubmitNewOrder)}
            className="bg-[#0B0F19] border border-slate-800 rounded-3xl w-full max-w-lg p-7 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">신규 수주 등록 (Zod 검증)</h3>
              <button type="button" onClick={() => setIsOrderModalOpen(false)} className="text-slate-500 hover:text-white text-lg">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">고객사명</label>
                <input
                  {...register('client')}
                  placeholder="예: 엔트로피패러독스"
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
                {errors.client && <p className="text-rose-400 text-[11px] mt-1">{errors.client.message}</p>}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">품목 내역</label>
                <input
                  {...register('items')}
                  placeholder="예: AOT 가속 모듈 10EA"
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
                {errors.items && <p className="text-rose-400 text-[11px] mt-1">{errors.items.message}</p>}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">수주 금액 (원)</label>
                <input
                  type="number"
                  {...register('amount', { valueAsNumber: true })}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-400"
                />
                {errors.amount && <p className="text-rose-400 text-[11px] mt-1">{errors.amount.message}</p>}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">우선순위</label>
                <select
                  {...register('priority')}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400"
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
                className="px-4 py-2.5 border border-slate-800 hover:bg-slate-900 text-slate-300 rounded-xl text-xs"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/20"
              >
                {isSubmitting ? '저장 중...' : 'DB에 등록 완료'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-slate-800 rounded-3xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">수주 상태 변경 ({editingOrder.id})</h3>
              <button onClick={() => setEditingOrder(null)} className="text-slate-500 hover:text-white text-lg">✕</button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">고객사</label>
                <input
                  disabled
                  value={editingOrder.client}
                  className="w-full p-3 bg-slate-950/60 border border-slate-800 rounded-xl text-slate-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">상태 변경</label>
                <select
                  value={editingOrder.status}
                  onChange={(e) => setEditingOrder({ ...editingOrder, status: e.target.value })}
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400"
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
                className="px-4 py-2.5 border border-slate-800 hover:bg-slate-900 text-slate-300 rounded-xl text-xs"
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
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/20"
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
