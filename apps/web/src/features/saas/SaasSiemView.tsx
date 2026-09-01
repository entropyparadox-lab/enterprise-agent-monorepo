import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { StateBoundary } from '../../components/StateBoundary'

export function SaasSiemView() {
  const auditQuery = useQuery({
    queryKey: ['audit-logs'],
    queryFn: async () => {
      const res = await api.GET('/api/audit-logs')
      if (res.error) throw new Error('Failed to fetch audit logs')
      return res.data
    },
    refetchInterval: 15000,
  })

  const logs = auditQuery.data || []

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <h2 className="text-xl font-bold text-white">SaaS 운영 및 실시간 SIEM 감사 로그</h2>
      <StateBoundary
        isLoading={auditQuery.isLoading}
        error={auditQuery.error}
        data={logs}
        onRetry={() => auditQuery.refetch()}
        emptyMessage="감사 로그가 비어 있습니다."
      >
        <div className="p-6 rounded-2xl bg-slate-900/40 border border-slate-800 space-y-4">
          <div className="font-semibold text-sm text-slate-200">Rust 백엔드 실시간 감사 이벤트</div>
          <div className="divide-y divide-slate-800">
            {logs.map((log) => (
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
      </StateBoundary>
    </div>
  )
}
