import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { StateBoundary } from '../../components/StateBoundary'
import { toast } from 'sonner'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import type { Order, CreateOrderRequest, UpdateOrderRequest } from '@repo/api-client'

const orderSchema = z.object({
  client: z.string().min(2, '고객사명은 최소 2글자 이상이어야 합니다'),
  items: z.string().min(2, '품목 내역을 입력해주세요'),
  amount: z.number().min(1000, '수주 금액은 1,000원 이상이어야 합니다'),
  priority: z.enum(['높음', '보통', '낮음']),
})

type OrderFormValues = z.infer<typeof orderSchema>

export function OrderGridView() {
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('전체')
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [editingOrder, setEditingOrder] = useState<Order | null>(null)

  // Orders Query
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

  // Update Order Mutation
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
      queryClient.invalidateQueries({ queryKey: ['orders-stat'] })
      toast.success('수주 상태가 변경되었습니다.')
      setEditingOrder(null)
    },
    onError: (err) => toast.error(err.message),
  })

  // Create Order Mutation
  const createMutation = useMutation({
    mutationFn: async (body: CreateOrderRequest) => {
      const res = await api.POST('/api/orders', { body })
      if (res.error) throw new Error('Creation failed')
      return res.data
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['orders-stat'] })
      toast.success('신규 수주가 등록되었습니다.')
      setIsOrderModalOpen(false)
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
    <div className="space-y-6 animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="text-[11px] font-mono font-semibold text-cyan-400 uppercase mb-1">
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

      <StateBoundary
        isLoading={ordersQuery.isLoading}
        error={ordersQuery.error}
        data={ordersList}
        onRetry={() => ordersQuery.refetch()}
        emptyMessage="조건에 일치하는 수주 내역이 없습니다."
        emptyAction={
          <button
            onClick={() => setIsOrderModalOpen(true)}
            className="px-3.5 py-1.5 bg-cyan-500 text-slate-950 rounded-lg text-xs font-bold"
          >
            + 첫 수주 등록하기
          </button>
        }
      >
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
                      className="rounded bg-slate-900 border-slate-700 text-cyan-500 focus:ring-0 cursor-pointer"
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
      </StateBoundary>

      {/* New Order Modal */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmit(onSubmitNewOrder)}
            className="bg-[#0B0F19] border border-slate-800 rounded-3xl w-full max-w-lg p-7 space-y-5 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white">신규 수주 등록 (Zod 검증)</h3>
              <button type="button" onClick={() => setIsOrderModalOpen(false)} className="text-slate-500 hover:text-white text-lg cursor-pointer">
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
                className="px-4 py-2.5 border border-slate-800 hover:bg-slate-900 text-slate-300 rounded-xl text-xs cursor-pointer"
              >
                취소
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/20 cursor-pointer"
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
              <button onClick={() => setEditingOrder(null)} className="text-slate-500 hover:text-white text-lg cursor-pointer">✕</button>
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
                className="px-4 py-2.5 border border-slate-800 hover:bg-slate-900 text-slate-300 rounded-xl text-xs cursor-pointer"
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
                className="px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-slate-950 font-bold rounded-xl text-xs shadow-lg shadow-cyan-500/20 cursor-pointer"
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
