function Checkbox({ checked, indeterminate, onChange, label, className = "" }) {
  const state = checked ? "checked" : indeterminate ? "indeterminate" : "unchecked"

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={indeterminate ? "mixed" : checked}
      aria-label={label}
      onClick={(e) => {
        e.stopPropagation()
        onChange(e)
      }}
      className={`inline-flex h-4 w-4 flex-shrink-0 items-center justify-center ${className}`}
    >
      {state === "unchecked" ? (
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
          <rect x="0.75" y="0.75" width="14.5" height="14.5" rx="3" className="fill-transparent stroke-slate-300 dark:stroke-zinc-600" strokeWidth="1.5" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5">
          <rect width="16" height="16" rx="3.5" className="fill-brand-600" />
          {state === "checked" ? (
            <path d="M4.5 8.2 6.8 10.5 11.5 5.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          ) : (
            <path d="M4.5 8H11.5" stroke="white" strokeWidth="1.6" strokeLinecap="round" />
          )}
        </svg>
      )}
    </button>
  )
}

export default Checkbox
