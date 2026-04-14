import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 active:scale-[0.97]",
  {
    variants: {
      variant: {
        default:
          "bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 hover:bg-emerald-500 hover:shadow-emerald-500/30 dark:bg-emerald-600 dark:hover:bg-emerald-500 focus-visible:ring-emerald-500",
        destructive:
          "bg-red-600 text-white shadow-sm hover:bg-red-500 focus-visible:ring-red-500",
        outline:
          "border border-slate-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 shadow-sm hover:bg-slate-50 dark:hover:bg-zinc-800 text-slate-900 dark:text-zinc-100 hover:text-emerald-600 dark:hover:text-emerald-400 focus-visible:ring-emerald-500",
        secondary:
          "bg-slate-100 dark:bg-zinc-800/50 text-slate-900 dark:text-slate-100 shadow-sm hover:bg-slate-200 dark:hover:bg-zinc-800 focus-visible:ring-slate-500",
        ghost: 
          "hover:bg-slate-100 dark:hover:bg-zinc-800 hover:text-slate-900 dark:hover:text-zinc-100 text-slate-600 dark:text-slate-400",
        link: 
          "text-emerald-600 dark:text-emerald-400 underline-offset-4 hover:underline",
        success:
          "bg-emerald-600 text-white shadow hover:bg-emerald-500 focus-visible:ring-emerald-500",
        warning:
          "bg-amber-500 text-white shadow hover:bg-amber-400 focus-visible:ring-amber-500",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-md px-3 text-xs",
        lg: "h-12 rounded-lg px-8 text-base",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  loading?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, loading, disabled, children, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        )}
        {children}
      </button>
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
