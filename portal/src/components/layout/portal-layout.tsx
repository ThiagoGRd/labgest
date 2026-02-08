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
  Menu,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { Avatar } from '@/components/ui/avatar'
import { logout } from '@/actions/auth'

const navigation = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Meus Pedidos', href: '/pedidos', icon: ClipboardList },
  { name: 'Novo Pedido', href: '/novo-pedido', icon: PlusCircle },
  { name: 'Histórico', href: '/historico', icon: History },
  { name: 'Meu Perfil', href: '/perfil', icon: User },
]

interface PortalLayoutProps {
  children: React.ReactNode
  user: {
    nome: string
    email: string
    cro: string
  }
}

export function PortalLayout({ children, user }: PortalLayoutProps) {
  const pathname = usePathname()
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen mesh-bg selection:bg-emerald-500/30 selection:text-emerald-400">
      {/* Header */}
      <header className="fixed top-4 left-4 right-4 z-50 glass rounded-2xl mx-auto max-w-7xl">
        <div className="px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-20">
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
              <button
                onClick={() => logout()}
                className="p-2.5 text-zinc-400 hover:text-red-400 hover:bg-red-500/10 rounded-xl transition-all"
                title="Sair"
              >
                <LogOut className="h-5 w-5" />
              </button>
              <button
                className="md:hidden p-2.5 text-zinc-400 hover:text-white hover:bg-white/10 rounded-xl"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              >
                {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
              </button>
            </div>
          </div>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-t border-white/10 bg-zinc-950/95 backdrop-blur-xl rounded-b-2xl animate-in p-2">
            <nav className="space-y-1">
              {navigation.map((item) => {
                const isActive = pathname === item.href
                return (
                  <Link
                    key={item.name}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all",
                      isActive
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "text-zinc-400 hover:bg-white/5 hover:text-white"
                    )}
                  >
                    <item.icon className={cn("h-5 w-5", isActive ? "text-emerald-400" : "text-zinc-500")} />
                    {item.name}
                  </Link>
                )
              })}
            </nav>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="pt-28">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in">
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
    </div>
  )
}
