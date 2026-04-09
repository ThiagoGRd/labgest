'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { SidebarProvider, useSidebar } from '@/components/providers/sidebar-provider'
import { cn } from '@/lib/utils'
import { Menu } from 'lucide-react'

interface DashboardLayoutProps {
  children: React.ReactNode
}

function DashboardContent({ children }: DashboardLayoutProps) {
  const { collapsed, toggleMobile } = useSidebar()

  // TODO: Pegar usuário do contexto de autenticação
  const user = {
    nome: 'Thiago Cruz',
    email: 'thiago@labgest.com',
    tipo: 'Administrador',
  }

  return (
    <div className="min-h-screen mesh-bg relative overflow-hidden">
      <Sidebar user={user} />
      
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

export function DashboardLayout({ children }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardContent>{children}</DashboardContent>
    </SidebarProvider>
  )
}
