'use client'

import { Sidebar } from '@/components/layout/sidebar'
import { SidebarProvider, useSidebar } from '@/components/providers/sidebar-provider'
import { cn } from '@/lib/utils'
import * as Dialog from '@radix-ui/react-dialog'
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
  const { collapsed, isMobile, isOpenMobile, setIsOpenMobile } = useSidebar()

  const usuarioExibido = user ?? {
    nome: 'Equipe LabGest',
    email: '',
    tipo: 'Usuário',
  }

  return (
    <Dialog.Root open={isOpenMobile} onOpenChange={setIsOpenMobile} modal={isMobile}>
      <div className="min-h-screen mesh-bg relative overflow-x-hidden">
        <Sidebar user={usuarioExibido} />

        {/* Mobile Top Header */}
        <div className="md:hidden fixed top-0 left-0 right-0 z-30 h-16 border-b border-slate-200 bg-white/95 backdrop-blur-md dark:border-slate-800 dark:bg-slate-900/95 flex items-center justify-between px-4">
          <div className="flex items-center gap-3 w-full">
            <Dialog.Trigger asChild>
              <button
                id="admin-menu-trigger"
                aria-label="Abrir menu"
                className="p-2 -ml-2 rounded-xl text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800 transition-colors"
              >
                <Menu className="h-6 w-6" />
              </button>
            </Dialog.Trigger>
            <div className="flex items-center gap-2.5">
              <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-xs">
                <span className="text-white font-bold text-xs tracking-tight">LG</span>
              </div>
              <span className="text-slate-900 dark:text-white font-bold text-lg tracking-tight">LabGest</span>
            </div>
          </div>
        </div>

        <main
          className={cn(
            'transition-all duration-300 min-h-screen flex flex-col pt-16 md:pt-0',
            collapsed ? 'md:ml-20' : 'md:ml-64'
          )}
        >
          <div className="flex-1 animate-in p-3 sm:p-4 md:p-6">
            {children}
          </div>
        </main>
      </div>
    </Dialog.Root>
  )
}

export function DashboardLayout({ children, user }: DashboardLayoutProps) {
  return (
    <SidebarProvider>
      <DashboardContent user={user}>{children}</DashboardContent>
    </SidebarProvider>
  )
}
