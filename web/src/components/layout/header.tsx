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
    <header className="sticky top-0 z-30 glass border-b border-white/20 dark:border-white/10 mx-6 mt-4 rounded-2xl shadow-sm transition-all duration-300">
      <div className="flex items-center justify-between h-20 px-8">
        {/* Title */}
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          {subtitle && (
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative hidden lg:block">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/70" />
            <Input
              placeholder="Pesquisar em tudo..."
              className="w-72 pl-11 bg-white/50 dark:bg-black/20 border-white/20 dark:border-white/10 rounded-xl h-11 focus:ring-2 focus:ring-primary/20 transition-all hover:bg-white/60 dark:hover:bg-white/5"
            />
          </div>

          <div className="flex items-center gap-2 p-1.5 bg-white/50 dark:bg-black/20 rounded-xl border border-white/20 dark:border-white/10 backdrop-blur-sm">
            <ThemeToggle />

            {/* Notifications */}
            <button className="relative p-2 rounded-lg text-muted-foreground hover:bg-white/80 dark:hover:bg-white/10 hover:text-primary transition-all">
              <Bell className="h-5 w-5" />
              <span className="absolute top-2.5 right-2 h-2 w-2 bg-rose-500 rounded-full ring-2 ring-white dark:ring-black animate-pulse"></span>
            </button>
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
