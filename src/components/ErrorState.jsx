function ErrorState({ message, onRetry }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4 dark:bg-zinc-950">
      <div className="w-full max-w-sm rounded-lg border border-rose-500/20 bg-rose-500/5 p-6 text-center">
        <p className="text-sm font-semibold text-rose-600 dark:text-rose-400">Couldn't load signals</p>
        <p className="mt-2 text-sm text-body-500 dark:text-zinc-400">{message}</p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md border border-slate-200 px-3 py-1.5 text-xs font-semibold text-body-600 transition-colors hover:border-slate-300 hover:text-ink-900 dark:border-zinc-800 dark:text-zinc-300 dark:hover:border-zinc-700 dark:hover:text-zinc-100"
        >
          Retry
        </button>
      </div>
    </div>
  )
}

export default ErrorState
