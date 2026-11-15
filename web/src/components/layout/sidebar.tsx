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
  Activity,
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
  { name: 'Bancada Lab', href: '/lab-interno', icon: FlaskConical, hasBadge: true },
  { name: 'Recepção', href: '/recepcao', icon: Route },
  { name: 'Tratamentos', href: '/tratamentos', icon: Activity },
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

const groups = [
  { name: 'Visão geral', hrefs: ['/dashboard', '/prioridades'] },
  { name: 'Operação', hrefs: ['/ordens', '/lab-interno', '/recepcao', '/labs-externos'] },
  { name: 'Cadastros e materiais', hrefs: ['/clientes', '/servicos', '/estoque'] },
  { name: 'Gestão', hrefs: ['/tratamentos', '/financeiro', '/relatorios'] },
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
        className={cn('flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold transition-all group relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600',
          active
            ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-600/20'
            : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/70 hover:text-slate-900 dark:hover:text-slate-100',
          collapsed && 'justify-center px-0')}>
        <item.icon aria-hidden="true" className={cn('h-[18px] w-[18px] flex-shrink-0', active ? 'text-white' : 'text-slate-400 group-hover:text-indigo-600 dark:group-hover:text-indigo-400')} />
        {!collapsed && <span className="flex-1 tracking-tight">{item.name}</span>}
        {!collapsed && item.hasAI && <Sparkles aria-hidden="true" className="h-3.5 w-3.5 text-emerald-500" />}
        {!collapsed && item.hasBadge && <MensagensBadge />}
      </Link>
    )
  }
  const content = (
    <aside data-admin-sidebar className={cn('fixed left-0 top-0 z-50 h-dvh flex flex-col bg-white dark:bg-slate-950 border-r border-slate-200 dark:border-slate-800', collapsed ? 'w-20' : 'w-64', !isMobile && 'hidden md:flex')}>
      {isMobile && <Dialog.Title className="sr-only">Menu administrativo</Dialog.Title>}
      <div className="flex h-16 shrink-0 items-center justify-between px-5 border-b border-slate-200/80 dark:border-slate-800">
        {!collapsed ? <Link href="/dashboard" onClick={() => setIsOpenMobile(false)} className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center shadow-xs"><span className="text-white font-black text-xs tracking-tighter">LG</span></div>
          <div>
            <span className="text-slate-900 dark:text-white font-bold text-lg tracking-tight leading-none block">LabGest</span>
            <span className="text-[10px] font-semibold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">Prótese & Fluxo</span>
          </div>
        </Link> : <div className="h-8 w-8 mx-auto rounded-lg bg-indigo-600 flex items-center justify-center"><span className="text-white font-black text-xs">LG</span></div>}
        {isMobile && <Dialog.Close asChild><button aria-label="Fechar menu" className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 focus-visible:ring-2 focus-visible:ring-indigo-600"><X aria-hidden="true" className="h-5 w-5" /></button></Dialog.Close>}
      </div>
      <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar px-3 py-4 space-y-5">
        {groups.map(group => {
          const items = group.hrefs.flatMap(href => visible.filter(item => item.href === href))
          if (!items.length) return null
          return <nav key={group.name} aria-label={group.name} className="space-y-1">
            <h2 className={cn('px-3 mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500', collapsed && 'sr-only')}>{group.name}</h2>
            {items.map(renderLink)}
          </nav>
        })}
      </div>
      <div className="shrink-0 border-t border-slate-200/80 dark:border-slate-800 p-3 space-y-1.5">
        {visible.some(item => item.href === '/configuracoes') && <nav aria-label="Conta e configurações">{visible.filter(item => item.href === '/configuracoes').map(renderLink)}</nav>}
        <div className={cn('flex items-center gap-2.5 rounded-xl', !collapsed && 'px-2.5 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800')}>
          {!collapsed && <><Avatar name={user.nome} size="sm" /><div className="flex-1 min-w-0"><p className="text-xs font-semibold text-slate-900 dark:text-slate-100 truncate">{user.nome}</p><p className="text-[10px] uppercase font-bold text-slate-400 truncate">{user.tipo}</p></div></>}
          <button onClick={() => logout()} aria-label="Sair" title="Sair" className={cn('p-1.5 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-500/10 dark:hover:text-red-400 focus-visible:ring-2 focus-visible:ring-indigo-600', collapsed && 'mx-auto')}><LogOut aria-hidden="true" className="h-4 w-4" /></button>
        </div>
        <button ref={newsButton} onClick={() => { setWhatsNewOpen(true); setHasNew(false) }} aria-label="Novidades do sistema" title="Novidades do sistema"
          className={cn('flex items-center gap-2 w-full py-2 px-3 rounded-xl text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 dark:text-slate-400 dark:hover:bg-indigo-500/10 dark:hover:text-indigo-400 relative focus-visible:ring-2 focus-visible:ring-indigo-600', collapsed && 'justify-center px-0')}>
          <Sparkles aria-hidden="true" className="h-4 w-4 flex-shrink-0" />{!collapsed && <span className="text-[11px] font-bold uppercase tracking-wider">Novidades</span>}
          {hasNew && <span className={cn('h-2 w-2 rounded-full bg-indigo-500 animate-pulse', collapsed ? 'absolute top-1.5 right-1.5' : 'ml-auto')} />}
        </button>
        {!isMobile && <button onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? 'Expandir menu' : 'Recolher menu'} title={collapsed ? 'Expandir menu' : 'Recolher menu'}
          className="flex items-center justify-center gap-2 w-full py-2 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200 focus-visible:ring-2 focus-visible:ring-indigo-600">
          {collapsed ? <ChevronRight aria-hidden="true" className="h-4 w-4" /> : <><ChevronLeft aria-hidden="true" className="h-4 w-4" /><span className="text-[11px] font-bold uppercase tracking-wider">Recolher</span></>}
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
