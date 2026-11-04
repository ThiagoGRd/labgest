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
  FlaskConical,
  Route,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useState, useEffect, useRef } from 'react'
import * as Dialog from '@radix-ui/react-dialog'
import { Avatar } from '@/components/ui/avatar'
import { logout } from '@/actions/auth'
import { useSidebar } from '@/components/providers/sidebar-provider'
import { WhatsNewModal } from '@/components/ui/whats-new-modal'
import { MensagensBadge } from '@/components/ui/mensagens-badge'
import { VERSAO_ATUAL } from '@/lib/release-notes'

interface NavigationItem {
  name: string
  href: string
  icon: LucideIcon
  hasBadge?: boolean
  hasAI?: boolean
}

const navigation: NavigationItem[] = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Prioridades', href: '/prioridades', icon: Clock },
  { name: 'Ordens', href: '/ordens', icon: ClipboardList, hasBadge: true },
  { name: 'Produção', href: '/producao', icon: Kanban, hasBadge: true },
  { name: 'Recepção', href: '/recepcao', icon: Route },
  { name: 'Clientes', href: '/clientes', icon: Users },
  { name: 'Serviços', href: '/servicos', icon: Package },
  { name: 'Estoque', href: '/estoque', icon: Boxes },
  { name: 'Financeiro', href: '/financeiro', icon: DollarSign },
  { name: 'Lab Interno', href: '/lab-interno', icon: FlaskConical },
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

const groups = [
  { name: 'Visão geral', hrefs: ['/dashboard', '/prioridades'] },
  { name: 'Operação', hrefs: ['/ordens', '/producao', '/recepcao', '/lab-interno', '/labs-externos'] },
  { name: 'Cadastros e materiais', hrefs: ['/clientes', '/servicos', '/estoque'] },
  { name: 'Gestão', hrefs: ['/financeiro', '/relatorios'] },
]

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const { collapsed: desktopCollapsed, setCollapsed, isMobile, setIsOpenMobile } = useSidebar()
  const collapsed = !isMobile && desktopCollapsed
  const [whatsNewOpen, setWhatsNewOpen] = useState(false)
  const [hasNew, setHasNew] = useState(false)
  const newsButton = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setHasNew(localStorage.getItem('labgest_seen_version') !== VERSAO_ATUAL)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  useEffect(() => { setIsOpenMobile(false) }, [pathname, setIsOpenMobile])

  const visible = navigation.filter(item => user.tipo !== 'recepcao' || item.href === '/recepcao')
  const renderLink = (item: NavigationItem) => {
    const active = pathname === item.href || pathname?.startsWith(item.href + '/')
    return (
      <Link key={item.href} href={item.href} aria-label={collapsed ? item.name : undefined} aria-current={active ? 'page' : undefined}
        onClick={() => setIsOpenMobile(false)} title={collapsed ? item.name : undefined}
        className={cn('flex items-center gap-3 px-3.5 py-2 rounded-2xl text-sm font-medium transition-colors group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
          active ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'text-muted-foreground hover:bg-white/50 dark:hover:bg-white/10 hover:text-foreground',
          collapsed && 'justify-center px-0')}>
        <item.icon aria-hidden="true" className={cn('h-5 w-5 flex-shrink-0', active ? 'text-primary-foreground' : 'text-muted-foreground group-hover:text-primary')} />
        {!collapsed && <span className="flex-1 tracking-tight">{item.name}</span>}
        {!collapsed && item.hasAI && <Sparkles aria-hidden="true" className="h-4 w-4 text-amber-400 animate-pulse" />}
        {!collapsed && item.hasBadge && <MensagensBadge />}
      </Link>
    )
  }
  const content = (
    <aside data-admin-sidebar className={cn('fixed left-0 top-0 z-50 h-dvh flex flex-col glass-panel border-r border-white/20 dark:border-white/10', collapsed ? 'w-20' : 'w-64', !isMobile && 'hidden md:flex')}>
      {isMobile && <Dialog.Title className="sr-only">Menu administrativo</Dialog.Title>}
      <div className="flex h-20 shrink-0 items-center justify-between px-6 border-b border-white/10 dark:border-white/5">
        {!collapsed ? <Link href="/dashboard" onClick={() => setIsOpenMobile(false)} className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/30"><span className="text-white font-black text-sm tracking-tighter">LG</span></div>
          <span className="text-foreground font-bold text-xl tracking-tight">LabGest</span>
        </Link> : <div className="h-9 w-9 mx-auto rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center"><span className="text-white font-black text-sm">LG</span></div>}
        {isMobile && <Dialog.Close asChild><button aria-label="Fechar menu" className="rounded-xl p-2 hover:bg-black/5 focus-visible:ring-2 focus-visible:ring-primary"><X aria-hidden="true" className="h-5 w-5" /></button></Dialog.Close>}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-4 py-4 space-y-4">
        {groups.map(group => {
          const items = group.hrefs.flatMap(href => visible.filter(item => item.href === href))
          if (!items.length) return null
          return <nav key={group.name} aria-label={group.name} className="space-y-1">
            <h2 className={cn('px-3.5 mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground', collapsed && 'sr-only')}>{group.name}</h2>
            {items.map(renderLink)}
          </nav>
        })}
      </div>
      <div className="shrink-0 border-t border-white/10 dark:border-white/5 p-3 mx-2 space-y-2">
        {visible.some(item => item.href === '/configuracoes') && <nav aria-label="Conta e configurações">{visible.filter(item => item.href === '/configuracoes').map(renderLink)}</nav>}
        <div className={cn('flex items-center gap-3 rounded-2xl', !collapsed && 'px-3 py-2 bg-white/50 dark:bg-black/20 border border-white/20')}>
          {!collapsed && <><Avatar name={user.nome} size="sm" /><div className="flex-1 min-w-0"><p className="text-sm font-semibold text-foreground truncate">{user.nome}</p><p className="text-[10px] uppercase font-bold text-muted-foreground truncate">{user.tipo}</p></div></>}
          <button onClick={() => logout()} aria-label="Sair" title="Sair" className={cn('p-2 rounded-xl text-muted-foreground hover:bg-destructive/10 hover:text-destructive focus-visible:ring-2 focus-visible:ring-primary', collapsed && 'mx-auto')}><LogOut aria-hidden="true" className="h-4 w-4" /></button>
        </div>
        <button ref={newsButton} onClick={() => { setWhatsNewOpen(true); setHasNew(false) }} aria-label="Novidades do sistema" title="Novidades do sistema"
          className={cn('flex items-center gap-2 w-full py-2.5 px-3 rounded-xl text-muted-foreground hover:bg-indigo-500/10 hover:text-indigo-400 relative focus-visible:ring-2 focus-visible:ring-primary', collapsed && 'justify-center px-0')}>
          <Sparkles aria-hidden="true" className="h-4 w-4 flex-shrink-0" />{!collapsed && <span className="text-xs font-bold uppercase tracking-widest">Novidades</span>}
          {hasNew && <span className={cn('h-2 w-2 rounded-full bg-indigo-500 animate-pulse', collapsed ? 'absolute top-1.5 right-1.5' : 'ml-auto')} />}
        </button>
        {!isMobile && <button onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="flex items-center justify-center gap-2 w-full py-2.5 rounded-xl text-muted-foreground hover:bg-white/50 dark:hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-primary">
          {collapsed ? <ChevronRight aria-hidden="true" className="h-5 w-5" /> : <><ChevronLeft aria-hidden="true" className="h-5 w-5" /><span className="text-xs font-bold uppercase tracking-widest">Recolher</span></>}
        </button>}
      </div>
    </aside>
  )
  return <>
    {isMobile ? <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm" />
      <Dialog.Content asChild aria-describedby={undefined} onCloseAutoFocus={event => {
        if (!window.matchMedia('(max-width: 767px)').matches) {
          event.preventDefault()
          requestAnimationFrame(() => (document.querySelector<HTMLElement>('[data-admin-sidebar] a[aria-current="page"]') ?? document.querySelector<HTMLElement>('[data-admin-sidebar] a'))?.focus())
        }
      }}>
        {content}
      </Dialog.Content>
    </Dialog.Portal> : content}
    <WhatsNewModal forceOpen={whatsNewOpen} onClose={() => {
      setWhatsNewOpen(false)
      requestAnimationFrame(() => (newsButton.current ?? document.getElementById('admin-menu-trigger'))?.focus())
    }} />
  </>
}
