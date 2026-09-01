import React from 'react'

interface StateBoundaryProps<T> {
  isLoading?: boolean
  error?: Error | null
  data?: T[] | null
  onRetry?: () => void
  emptyMessage?: string
  emptyAction?: React.ReactNode
  children: React.ReactNode | ((data: T[]) => React.ReactNode)
}

export function StateBoundary<T>({
  isLoading = false,
  error,
  data,
  onRetry,
  emptyMessage = '데이터가 없습니다.',
  emptyAction,
  children,
}: StateBoundaryProps<T>) {
  // 1. Loading State (Skeleton)
  if (isLoading) {
    return (
      <div data-testid="state-boundary-loading" className="p-8 border border-slate-800 rounded-xl bg-slate-900/20 animate-pulse space-y-3">
        <div className="h-4 bg-slate-800 rounded w-1/3" />
        <div className="h-10 bg-slate-800/60 rounded" />
        <div className="h-10 bg-slate-800/40 rounded" />
      </div>
    )
  }

  // 2. Error State (Actionable Recovery)
  if (error) {
    return (
      <div data-testid="state-boundary-error" className="p-6 border border-rose-900/60 rounded-xl bg-rose-950/20 text-center space-y-3">
        <div className="text-rose-400 font-bold text-xs">데이터 로드 실패</div>
        <p className="text-slate-400 text-xs">{error.message || '요청 처리 중 오류가 발생했습니다.'}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="px-3 py-1.5 bg-rose-900/60 hover:bg-rose-900 text-rose-200 rounded-lg text-xs font-semibold cursor-pointer"
          >
            다시 시도
          </button>
        )}
      </div>
    )
  }

  // 3. Empty State (Actionable Callout)
  if (!data || data.length === 0) {
    return (
      <div data-testid="state-boundary-empty" className="p-8 border border-dashed border-slate-800 rounded-xl text-center space-y-3 bg-slate-900/10">
        <div className="text-slate-500 text-xs">{emptyMessage}</div>
        {emptyAction && <div>{emptyAction}</div>}
      </div>
    )
  }

  // 4. Success State
  if (typeof children === 'function') {
    return <>{children(data)}</>
  }

  return <>{children}</>
}
