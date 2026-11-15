import * as React from "react"
import { cn } from "@/lib/utils"

export interface InputProps
  extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: string
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <div className="w-full">
        <input
          type={type}
          className={cn(
            "flex h-10 w-full rounded-xl border bg-white dark:bg-slate-950/60 px-3 py-2 text-sm text-slate-900 dark:text-slate-100 transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-slate-400 dark:placeholder:text-slate-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50",
            error
              ? "border-red-500 focus-visible:ring-red-500/20"
              : "border-slate-200 dark:border-slate-700 focus-visible:ring-indigo-500/25 focus-visible:border-indigo-500 dark:focus-visible:border-indigo-400",
            className
          )}
          ref={ref}
          {...props}
        />
        {error && (
          <p className="mt-1 text-xs text-red-600 dark:text-red-400">{error}</p>
        )}
      </div>
    )
  }
)
Input.displayName = "Input"

export { Input }
