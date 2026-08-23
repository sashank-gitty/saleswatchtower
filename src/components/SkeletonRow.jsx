function SkeletonRow() {
  return (
    <div className="animate-pulse rounded-lg border border-slate-200 bg-white/60 p-4 dark:border-zinc-800 dark:bg-zinc-900/60">
      <div className="mb-3 flex items-center gap-2">
        <div className="h-3 w-16 rounded bg-slate-200 dark:bg-zinc-800" />
        <div className="h-4 w-14 rounded-full bg-slate-200 dark:bg-zinc-800" />
        <div className="h-4 w-20 rounded-full bg-slate-200 dark:bg-zinc-800" />
      </div>
      <div className="mb-2 h-4 w-3/4 rounded bg-slate-200 dark:bg-zinc-800" />
      <div className="mb-1.5 h-3 w-full rounded bg-slate-200 dark:bg-zinc-800" />
      <div className="h-3 w-5/6 rounded bg-slate-200 dark:bg-zinc-800" />
    </div>
  )
}

export default SkeletonRow
