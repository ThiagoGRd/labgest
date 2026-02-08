'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { SidebarProvider, useSidebar } from '@/components/providers/sidebar-provider'
import { cn } from '@/lib/utils'

interface DashboardLayoutProps {
  children: React.ReactNode
}

function DashboardContent({ children }: DashboardLayoutProps) {
  const { collapsed } = useSidebar()

  // TODO: Pegar usuário do contexto de autenticação
  const user = {
    nome: 'Thiago Cruz',
    email: 'thiago@labgest.com',
    tipo: 'Administrador',
  }

  return (
    <div className="min-h-screen mesh-bg relative overflow-hidden">
      <Sidebar user={user} />
      <main
        className={cn(
          "transition-all duration-300 min-h-screen flex flex-col",
          collapsed ? "ml-20" : "ml-64"
        )}
      >
        <div className="flex-1 animate-in p-6">
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
