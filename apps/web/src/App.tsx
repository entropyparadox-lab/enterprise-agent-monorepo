import { useState } from 'react'
import { QueryClient, QueryClientProvider, useQuery } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { api } from './lib/api'
import { useAuthStore } from './lib/authStore'
import { AdminView } from './features/admin/AdminView'
import { OrderGridView } from './features/sample_record/OrderGridView'
import { SaasSiemView } from './features/saas/SaasSiemView'
import { CinematicView } from './features/cinematic/CinematicView'
import { ServiceView } from './features/service/ServiceView'
import { AuthModal } from './features/auth/AuthModal'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 5,
      refetchOnWindowFocus: false,
    },
  },
})

export function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <DashboardShell />
      <Toaster position="bottom-right" richColors theme="dark" />
    </QueryClientProvider>
  )
}

function DashboardShell() {
  const [activeTab, setActiveTab] = useState<'admin' | 'erp' | 'saas' | 'cinematic' | 'service'>('admin')
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false)
  const { user, isAuthenticated, logout } = useAuthStore()

  // Telemetry Health Query
  const healthQuery = useQuery({
    queryKey: ['health'],
    queryFn: async () => {
      const res = await api.GET('/api/health')
      if (res.error) throw new Error('API Unreachable')
      return res.data
    },
    refetchInterval: 10000,
  })

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
                healthQuery.data?.status === 'HEALTHY'
                  ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50 animate-pulse'
                  : 'bg-rose-400'
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

      {/* Body Content Router */}
      <main className="flex-1 p-6 md:p-8 max-w-7xl mx-auto w-full space-y-8">
        {activeTab === 'admin' && <AdminView />}
        {activeTab === 'erp' && <OrderGridView />}
        {activeTab === 'saas' && <SaasSiemView />}
        {activeTab === 'cinematic' && <CinematicView />}
        {activeTab === 'service' && <ServiceView />}
      </main>

      {/* Auth Modal */}
      <AuthModal isOpen={isAuthModalOpen} onClose={() => setIsAuthModalOpen(false)} />
    </div>
  )
}

export default App
