import { type ReactNode } from 'react'

export interface StateBoundaryProps<T = unknown> {
  /** Loading state flag */
  isLoading?: boolean
  /** Error object if query/operation failed */
  error?: Error | null
  /** Optional manual override for empty condition */
  isEmpty?: boolean
  /** The data payload being fetched or displayed */
  data?: T[] | null
  /** Retry callback handler for error state */
  onRetry?: () => void
  /** Custom fallback for loading state */
  loadingFallback?: ReactNode
  /** Custom fallback for empty state */
  emptyFallback?: ReactNode
  /** Custom fallback for error state */
  errorFallback?: ReactNode | ((error: Error) => ReactNode)
  /** Action button or helper for empty state */
  emptyAction?: ReactNode
  /** Custom message for empty state */
  emptyMessage?: string
  /** Child component or render prop receiving verified non-empty data */
  children: ReactNode | ((data: T[]) => ReactNode)
}

/**
 * StateBoundary: Enterprise 3-Tier Semantic 5-State UI Guard (Stripe/Linear Standard)
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
  // 1. Loading State (Skeleton)
  if (isLoading) {
    if (loadingFallback) return <>{loadingFallback}</>
    return (
      <div
        data-testid="state-boundary-loading"
        className="w-full p-8 rounded-card border border-surface-border bg-surface-panel shadow-xs animate-pulse space-y-3"
      >
        <div className="h-4 bg-surface-subtle rounded w-1/3" />
        <div className="space-y-2">
          <div className="h-10 bg-surface-subtle/80 rounded w-full" />
          <div className="h-10 bg-surface-subtle/50 rounded w-full" />
        </div>
      </div>
    )
  }

  // 2. Error State (Actionable Recovery)
  if (error) {
    if (errorFallback) {
      return <>{typeof errorFallback === 'function' ? errorFallback(error) : errorFallback}</>
    }
    return (
      <div
        data-testid="state-boundary-error"
        className="w-full p-6 rounded-card border border-status-danger-border bg-status-danger-bg text-center space-y-3 shadow-xs"
      >
        <div className="text-status-danger font-bold text-xs">데이터 로드 실패</div>
        <p className="text-ink-body text-xs font-mono">{error.message || '요청 처리 중 오류가 발생했습니다.'}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-3.5 py-1.5 bg-status-danger hover:opacity-90 text-white rounded-button text-xs font-semibold cursor-pointer transition-opacity shadow-xs"
          >
            다시 시도
          </button>
        )}
      </div>
    )
  }

  // 3. Empty State Check (Actionable Callout)
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
        className="w-full p-8 rounded-card border border-dashed border-surface-border text-center space-y-3 bg-surface-panel shadow-xs"
      >
        <div className="text-ink-muted text-xs font-medium">{emptyMessage}</div>
        {emptyAction && <div className="pt-1">{emptyAction}</div>}
      </div>
    )
  }

  // 4. Success / Valid Data State
  if (typeof children === 'function' && data) {
    return <>{children(data)}</>
  }

  return <>{children}</>
}
