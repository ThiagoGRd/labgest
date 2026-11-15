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
    <header className="sticky top-16 z-30 mx-0 mt-2 rounded-2xl border border-slate-200/90 bg-white/95 shadow-xs backdrop-blur-md transition-colors sm:mx-6 sm:mt-4 md:top-3 dark:border-slate-800 dark:bg-slate-900/95">
      <div className="flex min-h-18 items-center justify-between gap-3 px-4 py-3 sm:px-6">
        <div className="min-w-0">
          <h1 className="truncate text-xl font-bold tracking-tight text-slate-900 sm:text-2xl dark:text-white">{title}</h1>
          {subtitle && (
            <p className="mt-0.5 line-clamp-2 text-xs font-medium text-slate-500 dark:text-slate-400">{subtitle}</p>
          )}
        </div>

        <div className="flex shrink-0 items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1 dark:border-slate-800 dark:bg-slate-950/60">
            <ThemeToggle />
          </div>

          {action && (
            <Button
              onClick={action.onClick}
              className="h-10 px-4 sm:px-5"
            >
              <Plus className="h-4 w-4 stroke-[2.5px]" />
              {action.label}
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
