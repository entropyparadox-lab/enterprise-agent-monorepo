import { type ReactNode } from 'react'

export interface StateBoundaryProps<T = unknown> {
  /** Loading state flag */
  isLoading?: boolean
  /** Error object if query/operation failed */
  error?: Error | null
  /** Optional manual override for empty condition (defaults to checking !data or empty array) */
  isEmpty?: boolean
  /** The data payload being fetched or displayed */
  data?: T | null
  /** Retry callback handler for error state */
  onRetry?: () => void
  /** Custom fallback for loading state (defaults to clean pulse skeleton) */
  loadingFallback?: ReactNode
  /** Custom fallback for empty state (defaults to actionable callout) */
  emptyFallback?: ReactNode
  /** Custom fallback for error state */
  errorFallback?: ReactNode | ((error: Error) => ReactNode)
  /** Action button or helper for empty state */
  emptyAction?: ReactNode
  /** Custom message for empty state */
  emptyMessage?: string
  /** Child component or render prop receiving verified non-empty data */
  children: ReactNode | ((data: NonNullable<T>) => ReactNode)
}

/**
 * StateBoundary: Enterprise 5-State UI Guard Component
 * Enforces Design Axiom #6 (5 UI States Completeness: Loading, Empty, Error, Success, Partial)
 */
export function StateBoundary<T>({
  isLoading,
  error,
  isEmpty,
  data,
  onRetry,
  loadingFallback,
  emptyFallback,
  errorFallback,
  emptyAction,
  emptyMessage = '표시할 데이터가 없습니다.',
  children,
}: StateBoundaryProps<T>) {
  // 1. Loading State
  if (isLoading) {
    if (loadingFallback) return <>{loadingFallback}</>
    return (
      <div
        data-testid="state-boundary-loading"
        className="w-full p-8 rounded-2xl border border-slate-800/80 bg-slate-900/40 backdrop-blur-md space-y-4 animate-pulse"
      >
        <div className="h-4 bg-slate-800 rounded-lg w-1/3" />
        <div className="space-y-2">
          <div className="h-10 bg-slate-800/60 rounded-xl w-full" />
          <div className="h-10 bg-slate-800/40 rounded-xl w-full" />
          <div className="h-10 bg-slate-800/20 rounded-xl w-full" />
        </div>
      </div>
    )
  }

  // 2. Error State
  if (error) {
    if (errorFallback) {
      return <>{typeof errorFallback === 'function' ? errorFallback(error) : errorFallback}</>
    }
    return (
      <div
        data-testid="state-boundary-error"
        className="w-full p-6 rounded-2xl border border-rose-900/60 bg-rose-950/20 text-center space-y-3"
      >
        <div className="w-10 h-10 rounded-xl bg-rose-950/80 border border-rose-800/80 text-rose-400 flex items-center justify-center mx-auto text-lg">
          ⚠️
        </div>
        <div className="space-y-1">
          <h4 className="text-sm font-bold text-white">데이터를 불러오는 중 오류가 발생했습니다</h4>
          <p className="text-xs text-rose-400/90 font-mono">{error.message}</p>
        </div>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-1.5 bg-rose-900/60 hover:bg-rose-900 text-rose-200 border border-rose-700/80 rounded-xl text-xs font-semibold transition-colors cursor-pointer"
          >
            다시 시도
          </button>
        )}
      </div>
    )
  }

  // 3. Empty State Check
  const isDataEmpty =
    isEmpty !== undefined
      ? isEmpty
      : data === undefined ||
        data === null ||
        (Array.isArray(data) && data.length === 0)

  if (isDataEmpty) {
    if (emptyFallback) return <>{emptyFallback}</>
    return (
      <div
        data-testid="state-boundary-empty"
        className="w-full p-10 rounded-2xl border border-slate-800/80 bg-slate-900/30 text-center space-y-4"
      >
        <div className="w-12 h-12 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 flex items-center justify-center mx-auto text-xl">
          📂
        </div>
        <div className="space-y-1">
          <p className="text-sm font-bold text-slate-200">{emptyMessage}</p>
          <p className="text-xs text-slate-500">새로운 항목을 생성하거나 필터를 초기화하세요.</p>
        </div>
        {emptyAction && <div className="pt-1">{emptyAction}</div>}
      </div>
    )
  }

  // 4. Success / Valid Data State
  if (typeof children === 'function') {
    return <>{children(data as NonNullable<T>)}</>
  }

  return <>{children}</>
}
