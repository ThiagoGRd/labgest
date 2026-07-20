'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'
import {
  LayoutDashboard,
  ClipboardList,
  PlusCircle,
  History,
  User,
  LogOut,
  Sparkles,
  DollarSign
} from 'lucide-react'
import { useState, useEffect } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { logout } from '@/actions/auth'
import { WhatsNewPortal } from '@/components/ui/whats-new-portal'
import { PortalNotifications } from '@/components/ui/portal-notifications'
import { VERSAO_ATUAL } from '@/lib/release-notes'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Meus Pedidos', href: '/pedidos', icon: ClipboardList },
  { name: 'Novo Pedido', href: '/novo-pedido', icon: PlusCircle },
  { name: 'Histórico', href: '/historico', icon: History },
  { name: 'Financeiro', href: '/financeiro', icon: DollarSign },
  { name: 'Meu Perfil', href: '/perfil', icon: User },
]

export interface PortalUser {
  nome: string
  email: string
  cro: string
}

interface PortalLayoutProps {
  children: React.ReactNode
  user: PortalUser
}

export function PortalLayout({ children, user }: PortalLayoutProps) {
  const pathname = usePathname()
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)
  const [hasNew, setHasNew] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem('labgest_portal_seen_version')
    // O valor só existe no navegador; a leitura após a hidratação evita divergência com o servidor.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHasNew(seen !== VERSAO_ATUAL)
  }, [])

  return (
    <div className="min-h-screen mesh-bg pb-16 selection:bg-emerald-500/30 selection:text-emerald-400 md:pb-0">
      {/* Header */}
      <header className="fixed left-0 right-0 top-0 z-50 mx-auto max-w-7xl rounded-none glass md:left-4 md:right-4 md:top-4 md:rounded-2xl">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex h-16 items-center justify-between md:h-20">
            {/* Logo */}
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-600 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:shadow-emerald-500/30 transition-all duration-500">
                <span className="text-white font-black text-lg">LG</span>
              </div>
              <div className="hidden sm:block">
                <h1 className="font-bold text-white tracking-tight">Portal do Dentista</h1>
                <p className="text-[10px] uppercase font-bold tracking-widest text-emerald-500">Premium Service</p>
              </div>
            </Link>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1 p-1 bg-white/5 rounded-xl border border-white/10 backdrop-blur-sm">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    className={cn(
                      "flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all duration-300",
                      isActive
                        ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-[0_0_20px_rgba(16,185,129,0.1)]"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <item.icon className={cn("h-4 w-4", isActive ? "text-emerald-400" : "text-zinc-500 group-hover:text-zinc-300")} />
                    {item.name}
                  </Link>
                )
              })}
            </nav>

            {/* User Menu */}
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 hover:border-emerald-500/30 transition-colors">
                <Avatar name={user.nome} size="sm" />
                <div className="text-right">
                  <p className="text-sm font-bold text-white leading-none mb-0.5">{user.nome}</p>
                  <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-tighter">{user.cro}</p>
                </div>
              </div>
              <PortalNotifications />
              <button
                onClick={() => { setWhatsNewOpen(true); setHasNew(false) }}
                className="relative hidden items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-zinc-400 transition-all duration-300 hover:bg-white/5 hover:text-white sm:flex"
                title="Novidades"
              >
                <Sparkles className="h-4 w-4" />
                <span className="hidden lg:inline">Novidades</span>
                {hasNew && <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />}
              </button>
              <button
                onClick={() => logout()}
                className="hidden rounded-xl p-2.5 text-zinc-400 transition-all hover:bg-red-500/10 hover:text-red-400 sm:block"
                title="Sair"
              >
                <LogOut className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>

      </header>

      {/* Main Content */}
      <main className="pt-16 md:pt-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 md:py-8 animate-in">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-white/5 bg-black/20 mt-12 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <p className="text-xs font-bold uppercase tracking-widest text-center text-zinc-600">
            © 2026 LabGest Premium Lab Management.
          </p>
        </div>
      </footer>
      <WhatsNewPortal
        forceOpen={whatsNewOpen}
        onClose={() => setWhatsNewOpen(false)}
      />

      <nav className="fixed inset-x-0 bottom-0 z-50 grid h-16 grid-cols-5 border-t border-white/10 bg-zinc-950/95 px-1 backdrop-blur-xl md:hidden" aria-label="Atalhos principais">
        {[
          { name: 'Início', href: '/dashboard', icon: LayoutDashboard },
          { name: 'Pedidos', href: '/pedidos', icon: ClipboardList },
          { name: 'Novo', href: '/novo-pedido', icon: PlusCircle },
          { name: 'Financeiro', href: '/financeiro', icon: DollarSign },
          { name: 'Perfil', href: '/perfil', icon: User },
        ].map((item) => {
          const isActive = pathname === item.href
          return (
            <Link key={item.href} href={item.href} className={cn(
              'flex min-w-0 flex-col items-center justify-center gap-1 rounded-xl text-[11px] font-bold transition-colors',
              isActive ? 'text-emerald-400' : 'text-zinc-500 hover:text-white'
            )}>
              <item.icon className={cn('h-5 w-5', item.href === '/novo-pedido' && 'h-6 w-6')} />
              <span className="truncate">{item.name}</span>
            </Link>
          )
        })}
      </nav>
    </div>
  )
}
