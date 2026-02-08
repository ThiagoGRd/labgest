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
} from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { logout } from '@/actions/auth'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Prioridades', href: '/prioridades', icon: Clock },
  { name: 'Ordens', href: '/ordens', icon: ClipboardList },
  { name: 'Produção', href: '/producao', icon: Kanban },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Serviços', href: '/servicos', icon: Package },
  { name: 'Estoque', href: '/estoque', icon: Boxes },
  { name: 'Financeiro', href: '/financeiro', icon: DollarSign },
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
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={cn(
        "fixed left-0 top-0 z-40 h-screen transition-all duration-300 flex flex-col",
        "glass dark:bg-slate-950/40 border-r border-white/10",
        collapsed ? "w-20" : "w-64"
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center justify-between px-4 border-b border-black/5 dark:border-white/5">
        {!collapsed && (
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/40">
              <span className="text-white font-bold text-sm">LG</span>
            </div>
            <span className="text-slate-900 dark:text-white font-bold text-lg tracking-tight">LabGest</span>
          </Link>
        )}
        {collapsed && (
          <div className="h-8 w-8 mx-auto rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/40">
            <span className="text-white font-bold text-sm">LG</span>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || pathname?.startsWith(item.href + '/')
          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 group",
                isActive
                  ? "bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 scale-[1.02]"
                  : "text-slate-500 dark:text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 hover:text-indigo-600 dark:hover:text-white",
                collapsed && "justify-center px-2"
              )}
              title={collapsed ? item.name : undefined}
            >
              <item.icon className={cn(
                "h-5 w-5 flex-shrink-0 transition-transform duration-300 group-hover:scale-110",
                isActive ? "text-white" : "text-slate-400 group-hover:text-indigo-600"
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
      <div className="border-t border-black/5 dark:border-white/5 p-4">
        {!collapsed && (
          <div className="flex items-center gap-3 px-2 py-2.5 rounded-xl bg-white/40 dark:bg-black/20 border border-white/20 dark:border-white/5 mb-3 shadow-sm">
            <Avatar name={user.nome} size="sm" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-slate-900 dark:text-white truncate">{user.nome}</p>
              <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 truncate">{user.tipo}</p>
            </div>
            <button
              onClick={() => logout()}
              className="p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 transition-colors"
              title="Sair"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
        
        <button
          onClick={() => setCollapsed(!collapsed)}
          className={cn(
            "flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-slate-400 hover:bg-white/50 dark:hover:bg-white/5 hover:text-indigo-600 transition-all duration-300",
            collapsed && "px-2"
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
