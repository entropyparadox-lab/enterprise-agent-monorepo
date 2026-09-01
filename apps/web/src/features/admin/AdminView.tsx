import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { useAuthStore } from '../../lib/authStore'
import { StateBoundary } from '../../components/StateBoundary'
import { toast } from 'sonner'
import type { UserDto, ApiKeyInfo } from '@repo/api-client'

export function AdminView() {
  const queryClient = useQueryClient()
  const { user, login } = useAuthStore()
  const [isApiKeyModalOpen, setIsApiKeyModalOpen] = useState(false)
  const [issuedRawKey, setIssuedRawKey] = useState<string | null>(null)

  // 1. Admin Users Query
  const adminUsersQuery = useQuery({
    queryKey: ['admin-users'],
    queryFn: async () => {
      const res = await api.GET('/api/admin/users')
      if (res.error) throw new Error('Admin permission required')
      return res.data
    },
    enabled: user?.role === 'Admin',
  })

  // 2. Admin API Keys Query
  const apiKeysQuery = useQuery({
    queryKey: ['admin-api-keys'],
    queryFn: async () => {
      const res = await api.GET('/api/admin/api-keys')
      if (res.error) throw new Error('Admin permission required')
      return res.data
    },
    enabled: user?.role === 'Admin',
  })

  // 3. Orders query for revenue stat
  const ordersQuery = useQuery({
    queryKey: ['orders-stat'],
    queryFn: async () => {
      const res = await api.GET('/api/orders')
      return res.data || []
    },
  })

  // Update Role Mutation
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

  // Create API Key Mutation
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

  // Revoke API Key Mutation
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
    } catch (e: any) {
      toast.error(e.message)
    }
  }

  const usersList: UserDto[] = adminUsersQuery.data || []
  const apiKeysList: ApiKeyInfo[] = apiKeysQuery.data || []
  const ordersList = ordersQuery.data || []

  return (
    <div className="space-y-8 animate-in fade-in duration-300">
      {/* Header & Primary Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono font-medium tracking-wider text-cyan-400 uppercase mb-1">
            Enterprise Control Plane // RBAC &amp; M2M Keys
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
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg shadow-sm flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <span>+ 신규 M2M API Key 발급</span>
          </button>
        )}
      </div>

      {/* Non-Admin Warning Guard */}
      {user?.role !== 'Admin' && (
        <div className="p-8 rounded-xl bg-slate-900/60 border border-slate-800 text-center space-y-4 shadow-xl">
          <div className="w-12 h-12 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 text-2xl flex items-center justify-center mx-auto">
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
            className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 text-xs font-bold rounded-lg shadow-sm cursor-pointer transition-colors"
          >
            최고 관리자(Admin) 계정으로 전환
          </button>
        </div>
      )}

      {/* Admin Dashboard */}
      {user?.role === 'Admin' && (
        <div className="space-y-8">
          {/* Metric Summary Data Strip */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-px bg-slate-800/80 rounded-xl overflow-hidden border border-slate-800 shadow-sm">
            <div className="bg-[#0B0F19] p-4.5 space-y-1">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Total Accounts</div>
              <div className="text-xl font-bold text-white font-mono tracking-tight">{usersList.length}명</div>
              <div className="text-[11px] text-emerald-400 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 inline-block" /> 계정 활성 동기화됨
              </div>
            </div>

            <div className="bg-[#0B0F19] p-4.5 space-y-1">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Active M2M Keys</div>
              <div className="text-xl font-bold text-cyan-400 font-mono tracking-tight">
                {apiKeysList.filter((k) => k.is_active).length}개
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" /> SHA-256 일방향 암호화
              </div>
            </div>

            <div className="bg-[#0B0F19] p-4.5 space-y-1">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Order Volume</div>
              <div className="text-xl font-bold text-white font-mono tracking-tight">
                {(ordersList.reduce((acc, o) => acc + o.amount, 0) / 10000).toLocaleString()}만원
              </div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-slate-500 inline-block" /> {ordersList.length}건 누적 수주
              </div>
            </div>

            <div className="bg-[#0B0F19] p-4.5 space-y-1">
              <div className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">Database State</div>
              <div className="text-xl font-bold text-emerald-400 font-mono tracking-tight">ONLINE</div>
              <div className="text-[11px] text-slate-400 flex items-center gap-1.5 font-medium">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse inline-block" /> SQLite WAL Mode
              </div>
            </div>
          </div>

          {/* Section 1: User & RBAC Grid */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-200 tracking-wider uppercase font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                1. 전사 사용자 및 RBAC 역할 관리 (User Directory)
              </h2>
              <span className="text-xs text-slate-500 font-mono">{usersList.length} Accounts</span>
            </div>

            <StateBoundary
              isLoading={adminUsersQuery.isLoading}
              error={adminUsersQuery.error}
              data={usersList}
              onRetry={() => adminUsersQuery.refetch()}
              emptyMessage="등록된 전사 사용자가 없습니다."
            >
              <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 font-mono uppercase tracking-wider border-b border-slate-800">
                      <tr>
                        <th className="p-3.5">사번/ID</th>
                        <th className="p-3.5">성명</th>
                        <th className="p-3.5">이메일 계정</th>
                        <th className="p-3.5">인증 수단</th>
                        <th className="p-3.5 text-center">할당된 역할 (RBAC)</th>
                        <th className="p-3.5 text-right">가입 일시</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800/60">
                      {usersList.map((u) => (
                        <tr key={u.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-cyan-400">{u.id}</td>
                          <td className="p-3.5 font-bold text-white">{u.name}</td>
                          <td className="p-3.5 text-slate-300 font-mono">{u.email}</td>
                          <td className="p-3.5">
                            <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                              {u.auth_type}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <select
                              value={u.role}
                              onChange={(e) => updateRoleMutation.mutate({ userId: u.id, role: e.target.value })}
                              className="px-2.5 py-1 bg-slate-950 border border-slate-700 rounded text-xs text-white focus:outline-none focus:border-cyan-400 cursor-pointer font-medium"
                            >
                              <option value="Admin">Admin (최고 관리자)</option>
                              <option value="Operator">Operator (운영자)</option>
                              <option value="Viewer">Viewer (조회자)</option>
                            </select>
                          </td>
                          <td className="p-3.5 text-right text-slate-500 font-mono">{u.created_at}</td>
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
              <h2 className="text-xs font-bold text-slate-200 tracking-wider uppercase font-mono flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-cyan-400" />
                2. M2M AI 에이전트 &amp; CI Scoped API Keys
              </h2>
              <span className="text-xs text-slate-500 font-mono">{apiKeysList.length} Keys Registered</span>
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
                  className="px-3.5 py-1.5 bg-cyan-500 text-slate-950 rounded-lg text-xs font-bold cursor-pointer"
                >
                  + 첫 API Key 발급하기
                </button>
              }
            >
              <div className="rounded-xl border border-slate-800 bg-slate-900/30 overflow-hidden shadow-sm">
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-900/90 text-slate-400 font-mono uppercase tracking-wider border-b border-slate-800">
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
                    <tbody className="divide-y divide-slate-800/60">
                      {apiKeysList.map((k) => (
                        <tr key={k.id} className="hover:bg-slate-800/20 transition-colors">
                          <td className="p-3.5 font-mono font-bold text-cyan-400">{k.id}</td>
                          <td className="p-3.5 font-bold text-white">{k.name}</td>
                          <td className="p-3.5 font-mono text-slate-300">
                            <span className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-[11px]">
                              {k.key_prefix}...
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-slate-800 text-slate-300 border border-slate-700">
                              {k.role}
                            </span>
                          </td>
                          <td className="p-3.5 text-center">
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
                          <td className="p-3.5 text-right text-slate-500 font-mono">{k.created_at}</td>
                          <td className="p-3.5 text-center">
                            {k.is_active && (
                              <button
                                onClick={() => revokeApiKeyMutation.mutate(k.id)}
                                className="px-2.5 py-1 bg-rose-950/60 hover:bg-rose-900/80 text-rose-300 border border-rose-800/80 rounded text-[11px] font-medium transition-colors cursor-pointer"
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

      {/* New API Key Modal */}
      {isApiKeyModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-[#0B0F19] border border-slate-800 rounded-3xl w-full max-w-md p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">신규 M2M API Key 발급</h3>
              <button onClick={() => setIsApiKeyModalOpen(false)} className="text-slate-500 hover:text-white text-lg cursor-pointer">✕</button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-400 mb-1.5 font-medium">에이전트 / CI 서비스 명칭</label>
                <input
                  id="apiKeyNameInput"
                  placeholder="예: Hermes Autonomous Worker Bot"
                  className="w-full p-3 bg-slate-950 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                onClick={() => setIsApiKeyModalOpen(false)}
                className="px-4 py-2.5 border border-slate-800 hover:bg-slate-900 text-slate-300 rounded-xl text-xs cursor-pointer"
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
                className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/25 cursor-pointer"
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
          <div className="bg-[#0B0F19] border border-cyan-800/80 rounded-3xl w-full max-w-lg p-7 space-y-5 shadow-2xl">
            <div className="w-12 h-12 rounded-2xl bg-cyan-950/80 border border-cyan-800 text-cyan-400 flex items-center justify-center text-xl font-bold">
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
              className="w-full py-3 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/25 cursor-pointer"
            >
              확인 및 닫기
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
