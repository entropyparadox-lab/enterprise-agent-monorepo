import { api } from '../../lib/api'
import { useAuthStore } from '../../lib/authStore'
import { toast } from 'sonner'

interface AuthModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AuthModal({ isOpen, onClose }: AuthModalProps) {
  const { login } = useAuthStore()

  if (!isOpen) return null

  const handleQuickLogin = async (email: string) => {
    try {
      const res = await api.POST('/api/auth/login', {
        body: { email, password: 'AdminPass123!' },
      })
      if (res.error || !res.data) throw new Error('Login failed')
      login(res.data.token, res.data.user)
      toast.success(`${res.data.user.name} 계정으로 로그인되었습니다.`)
      onClose()
    } catch (e: any) {
      toast.error(e.message || '로그인 실패')
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
      <div className="bg-[#0B0F19] border border-slate-800 rounded-3xl w-full max-w-md p-7 space-y-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-lg font-bold text-white">사내 엔터프라이즈 인증</h3>
            <p className="text-xs text-slate-400 mt-0.5">역할(Role)에 맞는 계정을 선택하세요</p>
          </div>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg cursor-pointer">
            ✕
          </button>
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
  )
}
