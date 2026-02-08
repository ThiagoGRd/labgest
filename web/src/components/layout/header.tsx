'use client'

import { Bell, Search, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
    <header className="sticky top-0 z-30 glass border-b border-black/5 dark:border-white/5 mx-6 mt-4 rounded-2xl">
      <div className="flex items-center justify-between h-20 px-8">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
          {subtitle && (
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden lg:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Pesquisar em tudo..."
              className="w-72 pl-11 bg-white/50 dark:bg-black/20 border-black/5 dark:border-white/5 rounded-xl h-11 focus:ring-2 focus:ring-indigo-500/20 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 p-1 bg-white/40 dark:bg-black/20 rounded-xl border border-white/20 dark:border-white/5">
            <ThemeToggle />

            {/* Notifications */}
            <button className="relative p-2 rounded-lg text-slate-500 hover:bg-white dark:hover:bg-slate-800 hover:text-indigo-600 transition-all">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2 right-2 h-2 w-2 bg-red-500 rounded-full ring-2 ring-white dark:ring-slate-900 animate-pulse"></span>
            </button>
          </div>

          {/* Primary Action */}
          {action && (
            <Button 
              onClick={action.onClick}
              className="bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-600/30 rounded-xl h-11 px-6 font-semibold transition-all hover:scale-[1.02] active:scale-[0.98]"
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
