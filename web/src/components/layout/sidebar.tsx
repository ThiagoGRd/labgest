'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ClipboardList,
  Users,
  Package,
  Boxes,
  Kanban,
  DollarSign,
  BarChart3,
  Settings,
  LogOut,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Clock,
  Building2,
} from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { logout } from '@/actions/auth'
import { useSidebar } from '@/components/providers/sidebar-provider'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Prioridades', href: '/prioridades', icon: Clock },
  { name: 'Ordens', href: '/ordens', icon: ClipboardList },
  { name: 'Produção', href: '/producao', icon: Kanban },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Serviços', href: '/servicos', icon: Package },
  { name: 'Estoque', href: '/estoque', icon: Boxes },
  { name: 'Financeiro', href: '/financeiro', icon: DollarSign },
  { name: 'Labs Externos', href: '/labs-externos', icon: Building2 },
  { name: 'Relatórios', href: '/relatorios', icon: BarChart3, hasAI: true },
  { name: 'Configurações', href: '/configuracoes', icon: Settings },
]

interface SidebarProps {
  user: {
    nome: string
    email: string
    tipo: string
  }
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const { collapsed, setCollapsed } = useSidebar()

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300 ease-in-out flex flex-col",
        "glass-panel border-r border-white/20 dark:border-white/10",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-20 items-center justify-between px-6 border-b border-white/10 dark:border-white/5">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
              <span className="text-white font-black text-sm tracking-tighter">LG</span>
            </div>
            <span className="text-foreground font-bold text-xl tracking-tight">LabGest</span>
          </Link>
        )}
        {collapsed && (
          <div className="h-9 w-9 mx-auto rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <span className="text-white font-black text-sm tracking-tighter">LG</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-4 py-6 space-y-2 overflow-y-auto custom-scrollbar">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3.5 py-3 rounded-2xl text-sm font-medium transition-all duration-300 group relative overflow-hidden",
                isActive
                  ? "bg-primary text-primary-foreground shadow-lg shadow-primary/25"
                  : "text-muted-foreground hover:bg-white/50 dark:hover:bg-white/10 hover:text-foreground",
                collapsed && "justify-center px-0 py-3"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className={cn(
                "h-5 w-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110",
                isActive ? "text-primary-foreground" : "text-muted-foreground group-hover:text-primary"
              )} />
              {!collapsed && (
                <span className="flex-1 tracking-tight">{item.name}</span>
              )}
              {!collapsed && item.hasAI && (
                <Sparkles className="h-4 w-4 text-amber-400 animate-pulse" />
              )}
            </Link>
          )
        })}
      </nav>

      {/* User & Collapse */}
      <div className="border-t border-white/10 dark:border-white/5 p-4 mx-2">
        {!collapsed && (
          <div className="flex items-center gap-3 px-3 py-3 rounded-2xl bg-white/50 dark:bg-black/20 border border-white/20 dark:border-white/5 mb-4 shadow-sm backdrop-blur-sm">
            <Avatar name={user.nome} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{user.nome}</p>
              <p className="text-[10px] uppercase tracking-wider font-bold text-muted-foreground truncate opacity-80">{user.tipo}</p>
            </div>
            <button
              onClick={() => logout()}
              className="p-2 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive dark:hover:bg-destructive/20 transition-all"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-muted-foreground hover:bg-white/50 dark:hover:bg-white/10 hover:text-primary transition-all duration-300",
            collapsed && "px-0"
          )}
        >
          {collapsed ? (
            <ChevronRight className="h-5 w-5" />
          ) : (
            <>
              <ChevronLeft className="h-5 w-5" />
              <span className="text-xs font-bold uppercase tracking-widest">Recolher</span>
            </>
          )}
        </button>
      </div>
    </aside>
  )
}
