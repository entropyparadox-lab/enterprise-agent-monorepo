import { useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery, useMutation } from '@tanstack/react-query'
import { Toaster, toast } from 'sonner'
import { api } from './lib/api'
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
      <DashboardRoot />
      <Toaster position="top-right" richColors theme="dark" />
    </QueryClientProvider>
  )
}

function DashboardRoot() {
  const [activeTab, setActiveTab] = useState<'erp' | 'saas' | 'cinematic' | 'service'>('erp')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('전체')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)

  // 1. Health Query
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await api.GET('/api/health')
      if (res.error) throw new Error('API Unreachable')
      return res.data
    },
    refetchInterval: 10000,
  })

  // 2. Orders Query
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

  // 3. Audit Logs Query
  const auditQuery = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const res = await api.GET('/api/audit-logs')
      if (res.error) throw new Error('Failed to fetch audit logs')
      return res.data
    },
    refetchInterval: 15000,
  })

  // 4. Create / Update Mutation
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
      toast.success('수주 상태가 성공적으로 변경되었습니다.')
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
      toast.success('신규 수주가 데이터베이스에 등록되었습니다.')
      setIsModalOpen(false)
    },
    onError: (err) => toast.error(err.message),
  })

  // Form handling
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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-slate-950/90 backdrop-blur-md border-b border-slate-800 px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center text-slate-950 font-black text-sm">
            🦀
          </div>
          <div>
            <div className="font-bold text-sm text-white">Enterprise Agent Monorepo</div>
            <div className="text-[11px] text-slate-400 font-mono">React 19 + Rust Axum 0.8 + SQLite WAL</div>
          </div>
        </div>

        {/* Backend Health Telemetry Chip */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-xs font-mono">
            <span
              className={`w-2 h-2 rounded-full ${
                healthQuery.data?.status === 'HEALTHY' ? 'bg-green-400 animate-pulse' : 'bg-red-400'
              }`}
            />
            <span className="text-slate-300">
              Axum API: {healthQuery.data?.status || 'CONNECTING...'} ({healthQuery.data?.database || 'WAITING'})
            </span>
          </div>

          <div className="flex bg-slate-900 border border-slate-800 p-1 rounded-xl">
            {[
              { id: 'erp', label: '1. ERP 그리드 (Live API)' },
              { id: 'saas', label: '2. SaaS 대시보드' },
              { id: 'cinematic', label: '3. 시네마틱 랜딩' },
              { id: 'service', label: '4. 서비스 소개' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-cyan-500 text-slate-950 font-bold shadow-md shadow-cyan-500/20'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 p-6 md:p-10 max-w-7xl mx-auto w-full space-y-6">
        {activeTab === 'erp' && (
          <div className="space-y-6">
            {/* Header Toolbar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-4">
              <div>
                <div className="text-xs font-mono text-cyan-400">RUST AXUM 0.8 LIVE BACKEND CONNECTED</div>
                <h1 className="text-2xl font-bold text-white tracking-tight">수주 및 배송 총괄 관리 (Live CRUD)</h1>
              </div>
              <div className="flex gap-2">
                <a
                  href="http://127.0.0.1:8080/swagger-ui"
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-xs font-medium rounded-xl text-slate-200 inline-flex items-center gap-1.5"
                >
                  <span>Swagger OpenAPI</span>
                  <span>↗</span>
                </a>
                <button
                  onClick={() => setIsModalOpen(true)}
                  className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-xs font-bold rounded-xl text-slate-950 shadow-md shadow-cyan-500/20 cursor-pointer"
                >
                  + 신규 수주 등록 (Zod 검증)
                </button>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-3">
                <input
                  type="text"
                  placeholder="주문번호 또는 고객사 검색..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3.5 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 w-64"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs text-slate-300 focus:outline-none focus:border-cyan-400"
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
                    className="px-3 py-1.5 bg-green-600 hover:bg-green-500 text-white text-xs font-bold rounded-lg cursor-pointer"
                  >
                    일괄 결제 승인
                  </button>
                </div>
              )}
            </div>

            {/* Data Grid */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950 overflow-hidden shadow-2xl">
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
                      <tr key={ord.id} className="hover:bg-slate-900/40 transition-colors">
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
                                ? 'bg-green-950 text-green-400 border border-green-800'
                                : ord.status === '배송준비'
                                ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                : ord.status === '출고완료'
                                ? 'bg-blue-950 text-blue-400 border border-blue-800'
                                : 'bg-red-950 text-red-400 border border-red-800'
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

        {activeTab === 'saas' && (
          <div className="space-y-6">
            <h2 className="text-xl font-bold text-white">SaaS 운영 및 실시간 SIEM 감사 로그</h2>
            <div className="p-6 rounded-2xl bg-slate-950 border border-slate-800 space-y-4">
              <div className="font-semibold text-sm text-slate-200">Rust 백엔드 실시간 감사 이벤트</div>
              <div className="divide-y divide-slate-800">
                {(auditQuery.data || []).map((log) => (
                  <div key={log.id} className="py-3 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-3">
                      <span
                        className={`px-2 py-0.5 rounded font-mono ${
                          log.status === 'SUCCESS'
                            ? 'bg-green-950 text-green-400 border border-green-800'
                            : 'bg-red-950 text-red-400 border border-red-800'
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

        {activeTab === 'cinematic' && (
          <div className="p-12 text-center space-y-4 bg-slate-950 rounded-2xl border border-slate-800">
            <h2 className="text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-blue-500">
              Autonomous Rust & React Vibe Matrix
            </h2>
            <p className="text-sm text-slate-400">MicroVM 1ms 콜드스타트 + Axum 0.8 Zero-GC 아키텍처</p>
          </div>
        )}

        {activeTab === 'service' && (
          <div className="p-12 text-center space-y-4 bg-slate-950 rounded-2xl border border-slate-800">
            <h2 className="text-3xl font-bold text-white">엔터프라이즈 사내 표준 플랫폼</h2>
            <p className="text-sm text-slate-400">OpenAPI 3.1 ➔ TypeScript 100% 자동 타입 동기화 파이프라인</p>
          </div>
        )}
      </main>

      {/* New Order Modal (React Hook Form + Zod) */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit(onSubmitNewOrder)}
            className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">신규 수주 등록 (Zod 검증)</h3>
              <button type="button" onClick={() => setIsModalOpen(false)} className="text-slate-500 hover:text-white text-lg">
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs">
              <div>
                <label className="block text-slate-400 mb-1">고객사명</label>
                <input
                  {...register('client')}
                  placeholder="예: 엔트로피패러독스"
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
                {errors.client && <p className="text-rose-400 text-[11px] mt-1">{errors.client.message}</p>}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">품목 내역</label>
                <input
                  {...register('items')}
                  placeholder="예: AOT 가속 모듈 10EA"
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400"
                />
                {errors.items && <p className="text-rose-400 text-[11px] mt-1">{errors.items.message}</p>}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">수주 금액 (원)</label>
                <input
                  type="number"
                  {...register('amount', { valueAsNumber: true })}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white font-mono focus:outline-none focus:border-cyan-400"
                />
                {errors.amount && <p className="text-rose-400 text-[11px] mt-1">{errors.amount.message}</p>}
              </div>

              <div>
                <label className="block text-slate-400 mb-1">우선순위</label>
                <select
                  {...register('priority')}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400"
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
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-slate-800 hover:bg-slate-900 text-slate-300 rounded-xl text-xs"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-cyan-500/20"
              >
                {isSubmitting ? '저장 중...' : 'DB에 등록 완료'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Edit Order Modal */}
      {editingOrder && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-slate-800 rounded-2xl w-full max-w-lg p-6 space-y-5 shadow-2xl">
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
                  className="w-full p-2.5 bg-slate-900/50 border border-slate-800 rounded-xl text-slate-400"
                />
              </div>

              <div>
                <label className="block text-slate-400 mb-1">상태 변경</label>
                <select
                  value={editingOrder.status}
                  onChange={(e) => setEditingOrder({ ...editingOrder, status: e.target.value })}
                  className="w-full p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-white focus:outline-none focus:border-cyan-400"
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
                className="px-4 py-2 border border-slate-800 hover:bg-slate-900 text-slate-300 rounded-xl text-xs"
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
                className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold rounded-xl text-xs shadow-md shadow-cyan-500/20"
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
