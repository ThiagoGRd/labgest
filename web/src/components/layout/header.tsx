'use client'

import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/theme-toggle'

interface HeaderProps {
  title: string
  subtitle?: string
  action?: {
    label: string
    onClick: () => void
  }
}

export function Header({ title, subtitle, action }: HeaderProps) {
  return (
    <header className="sticky top-16 z-30 mx-0 mt-2 rounded-2xl border-b border-white/20 bg-white/80 shadow-sm backdrop-blur-xl transition-all duration-300 sm:mx-6 sm:mt-4 md:top-0 dark:border-white/5 dark:bg-slate-950/80">
      <div className="flex min-h-20 items-center justify-between gap-3 px-4 py-3 sm:px-8">
        {/* Title */}
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500 sm:text-xs sm:tracking-widest dark:text-slate-400">{subtitle}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-2 sm:gap-4">
          <div className="flex items-center gap-2 p-1.5 bg-slate-100/50 dark:bg-white/5 rounded-xl border border-transparent dark:border-white/5 backdrop-blur-sm">
            <ThemeToggle />
          </div>

          {/* Primary Action */}
          {action && (
            <Button
              onClick={action.onClick}
              className="bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg shadow-primary/25 rounded-xl h-11 px-6 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
            >
              <Plus className="h-5 w-5 mr-2 stroke-[3px]" />
              {action.label}
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
