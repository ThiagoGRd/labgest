'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { SidebarProvider, useSidebar } from '@/components/providers/sidebar-provider'
import { cn } from '@/lib/utils'
import { Menu } from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
  user?: {
    nome: string
    email: string
    tipo: string
  }
}

function DashboardContent({ children, user }: DashboardLayoutProps) {
  const { collapsed, toggleMobile } = useSidebar()

  const usuarioExibido = user ?? {
    nome: 'Equipe LabGest',
    email: '',
    tipo: 'Usuário',
  }

  return (
    <div className="min-h-screen mesh-bg relative overflow-hidden">
      <Sidebar user={usuarioExibido} />
      
      {/* Mobile Top Header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-16 glass-panel border-b border-white/20 dark:border-white/10 flex items-center justify-between px-4">
        <div className="flex items-center gap-3 w-full">
          <button 
            onClick={toggleMobile}
            className="p-2 -ml-2 rounded-xl text-foreground hover:bg-white/50 dark:hover:bg-white/10 transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center">
              <span className="text-white font-black text-xs">LG</span>
            </div>
            <span className="text-foreground font-bold text-lg tracking-tight">LabGest</span>
          </div>
        </div>
      </div>

      <main
        className={cn(
          "transition-all duration-300 min-h-screen flex flex-col pt-16 md:pt-0",
          collapsed ? "md:ml-20" : "md:ml-64"
        )}
      >
        <div className="flex-1 animate-in p-4 md:p-6">
          {children}
        </div>
      </main>
    </div>
  )
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardContent user={user}>{children}</DashboardContent>
    </SidebarProvider>
  )
}
