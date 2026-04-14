import React from "react"
import { SearchX, Inbox, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"

interface EmptyStateProps extends React.HTMLAttributes<HTMLDivElement> {
  icon?: LucideIcon
  title: string
  description?: string
  action?: React.ReactNode
  variant?: 'default' | 'card'
}

export function EmptyState({ 
  icon: Icon = SearchX, 
  title, 
  description, 
  action, 
  variant = 'default',
  className,
  ...props 
}: EmptyStateProps) {
  return (
    <div 
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 animate-in",
        variant === 'card' ? "bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-2xl" : "",
        className
      )}
      {...props}
    >
      <div className="relative mb-6">
        {/* Glow effect */}
        <div className="absolute inset-0 bg-indigo-500/20 dark:bg-indigo-500/10 blur-xl rounded-full scale-150" />
        
        <div className="relative h-20 w-20 flex items-center justify-center rounded-2xl bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 shadow-lg shadow-slate-200/50 dark:shadow-none">
          <Icon className="h-10 w-10 text-slate-400 dark:text-slate-500 stroke-[1.5]" />
        </div>
      </div>
      
      <h3 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">
        {title}
      </h3>
      
      {description && (
        <p className="text-sm font-medium text-slate-500 dark:text-slate-400 max-w-xs mb-6 leading-relaxed">
          {description}
        </p>
      )}
      
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  )
}
