'use client'

import { useState, useTransition } from 'react'
import {
  Building2, Clock, AlertTriangle, RefreshCw, CheckCircle2,
  PackageCheck, Send, Plus, ChevronRight, Search, X, Loader2,
  Calendar, User, Stethoscope, FileText, ArrowRightLeft, Undo2, Pencil
} from 'lucide-react'
import {
  criarPedido, atualizarSituacao, marcarRetrabalho, excluirPedido, atualizarPedido,
  type LabExternoPedido, type LabExterno, type SituacaoPedido
} from '@/actions/labs-externos'

interface Stats {
  total_enviados: number
  total_provando: number
  total_prontos: number
  total_entregues: number
  total_atrasados: number
  total_retrabalhos: number
}

interface Props {
  pedidos:     LabExternoPedido[]
  atrasados:   LabExternoPedido[]
  retrabalhos: LabExternoPedido[]
  stats:       Stats
  labs:        LabExterno[]
}

type Aba = 'todos' | 'enviados' | 'provando' | 'prontos' | 'entregues' | 'atrasados' | 'retrabalhos'

const SITUACAO_CONFIG: Record<SituacaoPedido, { label: string; color: string; bg: string; next?: SituacaoPedido; prev?: SituacaoPedido }> = {
  Enviado:  { label: 'Enviado',  color: 'text-blue-400',   bg: 'bg-blue-500/20',   next: 'Provando' },
  Provando: { label: 'Provando', color: 'text-purple-400', bg: 'bg-purple-500/20', next: 'Pronto',   prev: 'Enviado' },
  Pronto:   { label: 'Pronto',   color: 'text-green-400',  bg: 'bg-green-500/20',  next: 'Entregue', prev: 'Provando' },
  Entregue: { label: 'Entregue', color: 'text-gray-400',   bg: 'bg-gray-500/20',                     prev: 'Pronto' },
}

function formatDate(date: Date | null | undefined): string {
  if (!date) return '—'
  return new Date(date).toLocaleDateString('pt-BR')
}

function isOverdue(pedido: LabExternoPedido): boolean {
  if (!pedido.prazo || pedido.situacao === 'Entregue') return false
  return new Date(pedido.prazo) < new Date()
}

function PedidoCard({
  pedido, onAvancar, onVoltar, onRetrabalho, onExcluir, onEdit, isPending
}: {
  pedido: LabExternoPedido
  onAvancar: (id: number, next: SituacaoPedido) => void
  onVoltar: (id: number, prev: SituacaoPedido) => void
  onRetrabalho: (id: number) => void
  onExcluir: (id: number) => void
  onEdit: (pedido: LabExternoPedido) => void
  isPending: boolean
}) {
  const cfg     = SITUACAO_CONFIG[pedido.situacao]
  const overdue = isOverdue(pedido)

  return (
    <div className={`glass-card rounded-xl p-4 border transition-all ${
      overdue ? 'border-red-500/40 bg-red-500/5' : 'border-slate-200 dark:border-white/10'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-slate-900 dark:text-white truncate">{pedido.paciente}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color} ${cfg.bg}`}>
              {cfg.label}
            </span>
            {pedido.isRetrabalho && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium text-orange-600 dark:text-orange-400 bg-orange-500/20">
                Retrabalho
              </span>
            )}
            {overdue && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium text-red-600 dark:text-red-400 bg-red-500/20">
                {pedido.diasAtraso}d atraso
              </span>
            )}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 dark:text-gray-400">
            {pedido.dentista && (
              <div className="flex items-center gap-1">
                <Stethoscope className="w-3 h-3" />
                <span className="truncate">{pedido.dentista}</span>
              </div>
            )}
            {pedido.labNome && (
              <div className="flex items-center gap-1">
                <Building2 className="w-3 h-3" />
                <span>{pedido.labNome}</span>
              </div>
            )}
            {pedido.dataEnvio && (
              <div className="flex items-center gap-1">
                <Send className="w-3 h-3" />
                <span>Enviado: {formatDate(pedido.dataEnvio)}</span>
              </div>
            )}
            {pedido.prazo && (
              <div className={`flex items-center gap-1 ${overdue ? 'text-red-600 dark:text-red-400' : ''}`}>
                <Calendar className="w-3 h-3" />
                <span>Prazo: {formatDate(pedido.prazo)}</span>
              </div>
            )}
          </div>

          {pedido.servico && (
            <p className="mt-2 text-xs text-slate-600 dark:text-gray-300 leading-relaxed line-clamp-2">
              {pedido.servico}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1 shrink-0">
          <button
            onClick={() => onEdit(pedido)}
            disabled={isPending}
            className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white transition-colors disabled:opacity-50"
            title="Editar pedido"
          >
            <Pencil className="w-3 h-3" />
            Editar
          </button>
          
          {pedido.situacao !== 'Entregue' ? (
            <>
              {cfg.next && (
                <button
                  onClick={() => onAvancar(pedido.id, cfg.next!)}
                  disabled={isPending}
                  className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 dark:bg-white/10 dark:hover:bg-white/20 dark:text-white transition-colors disabled:opacity-50"
                  title={`Avançar para ${cfg.next}`}
                >
                  {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                  {cfg.next}
                </button>
              )}
              {!pedido.isRetrabalho && (
                <button
                  onClick={() => onRetrabalho(pedido.id)}
                  disabled={isPending}
                  className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 text-orange-600 dark:bg-orange-500/20 dark:hover:bg-orange-500/30 dark:text-orange-400 transition-colors disabled:opacity-50"
                >
                  <RefreshCw className="w-3 h-3" />
                  Retrab.
                </button>
              )}
              {cfg.prev && (
                <button
                  onClick={() => onVoltar(pedido.id, cfg.prev!)}
                  disabled={isPending}
                  className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-white/10 dark:hover:bg-white/20 dark:text-gray-400 transition-colors disabled:opacity-50"
                  title={`Voltar para ${cfg.prev}`}
                >
                  <Undo2 className="w-3 h-3" />
                  Voltar
                </button>
              )}
            </>
          ) : (
            <button
              onClick={() => onVoltar(pedido.id, 'Pronto')}
              disabled={isPending}
              className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 dark:bg-white/10 dark:hover:bg-white/20 dark:text-gray-400 transition-colors disabled:opacity-50"
              title="Desfazer entrega"
            >
              {isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Undo2 className="w-3 h-3" />}
              Desfazer
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

function ModalPedido({ labs, pedidoEdicao, onClose, onSave }: {
  labs: LabExterno[]
  pedidoEdicao?: LabExternoPedido
  onClose: () => void
  onSave: (data: any) => void
}) {
  const [form, setForm] = useState({
    labId:     pedidoEdicao?.labId ? String(pedidoEdicao.labId) : String(labs[0]?.id ?? ''),
    paciente:  pedidoEdicao?.paciente ?? '',
    dentista:  pedidoEdicao?.dentista ?? '',
    dataEnvio: pedidoEdicao?.dataEnvio ? new Date(pedidoEdicao.dataEnvio).toISOString().split('T')[0] : '',
    prazo:     pedidoEdicao?.prazo ? new Date(pedidoEdicao.prazo).toISOString().split('T')[0] : '',
    servico:   pedidoEdicao?.servico ?? '',
    situacao:  pedidoEdicao?.situacao ?? 'Enviado',
  })

  const lab = labs.find(l => l.id === Number(form.labId))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.paciente.trim()) return
    onSave({ ...form, labId: Number(form.labId), labNome: lab?.nome ?? '' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl border border-slate-200 dark:border-white/20 bg-white dark:bg-gray-900 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-white/10">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
            {pedidoEdicao ? <Pencil className="w-5 h-5 text-blue-500 dark:text-blue-400" /> : <Plus className="w-5 h-5 text-blue-500 dark:text-blue-400" />}
            {pedidoEdicao ? 'Editar Pedido' : 'Novo Pedido — Lab Externo'}
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:text-gray-400 dark:hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1 block">Laboratório *</label>
              <select
                value={form.labId}
                onChange={e => setForm(f => ({ ...f, labId: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/20 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-400"
              >
                {labs.map(l => (
                  <option key={l.id} value={l.id} className="bg-white text-slate-900 dark:bg-gray-900 dark:text-white">{l.nome} — {l.cidade}</option>
                ))}
              </select>
            </div>
            
            {pedidoEdicao && (
              <div>
                <label className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1 block">Situação</label>
                <select
                  value={form.situacao}
                  onChange={e => setForm(f => ({ ...f, situacao: e.target.value as SituacaoPedido }))}
                  className="w-full bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/20 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-400"
                >
                  <option value="Enviado" className="bg-white text-slate-900 dark:bg-gray-900 dark:text-white">Enviado</option>
                  <option value="Provando" className="bg-white text-slate-900 dark:bg-gray-900 dark:text-white">Provando</option>
                  <option value="Pronto" className="bg-white text-slate-900 dark:bg-gray-900 dark:text-white">Pronto</option>
                  <option value="Entregue" className="bg-white text-slate-900 dark:bg-gray-900 dark:text-white">Entregue</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1 block">Paciente *</label>
            <input
              required
              value={form.paciente}
              onChange={e => setForm(f => ({ ...f, paciente: e.target.value }))}
              placeholder="Nome completo do paciente"
              className="w-full bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/20 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1 block">Dentista</label>
            <input
              value={form.dentista}
              onChange={e => setForm(f => ({ ...f, dentista: e.target.value }))}
              placeholder="Dr(a). Nome"
              className="w-full bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/20 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1 block">Data de Envio</label>
              <input
                type="date"
                value={form.dataEnvio}
                onChange={e => setForm(f => ({ ...f, dataEnvio: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/20 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1 block">Prazo</label>
              <input
                type="date"
                value={form.prazo}
                onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))}
                className="w-full bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/20 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-slate-500 dark:text-gray-400 mb-1 block">Serviço / Descrição</label>
            <textarea
              value={form.servico}
              onChange={e => setForm(f => ({ ...f, servico: e.target.value }))}
              placeholder="Ex: Coroa sob implante do elemento 36, cor A2 VITA"
              rows={3}
              className="w-full bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/20 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-slate-200 dark:border-white/20 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white hover:border-slate-300 dark:hover:border-white/40 transition-colors text-sm"
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors text-sm"
            >
              Cadastrar
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export function LabsExternosView({ pedidos, atrasados, retrabalhos, stats, labs }: Props) {
  const [aba, setAba]               = useState<Aba>('todos')
  const [busca, setBusca]           = useState('')
  const [showModal, setShowModal]   = useState(false)
  const [pedidoEditando, setPedidoEditando] = useState<LabExternoPedido | undefined>(undefined)
  const [isPending, startTransition] = useTransition()

  function getPedidosFiltrados(): LabExternoPedido[] {
    let lista: LabExternoPedido[]
    switch (aba) {
      case 'enviados':    lista = pedidos.filter(p => p.situacao === 'Enviado');  break
      case 'provando':    lista = pedidos.filter(p => p.situacao === 'Provando'); break
      case 'prontos':     lista = pedidos.filter(p => p.situacao === 'Pronto');   break
      case 'entregues':   lista = pedidos.filter(p => p.situacao === 'Entregue'); break
      case 'atrasados':   lista = atrasados;   break
      case 'retrabalhos': lista = retrabalhos; break
      default:            lista = pedidos.filter(p => p.situacao !== 'Entregue')
    }
    if (!busca.trim()) return lista
    const q = busca.toLowerCase()
    return lista.filter(p =>
      p.paciente.toLowerCase().includes(q) ||
      p.dentista?.toLowerCase().includes(q) ||
      p.servico?.toLowerCase().includes(q)
    )
  }

  function handleAvancar(id: number, next: SituacaoPedido) {
    startTransition(() => atualizarSituacao(id, next))
  }

  function handleVoltar(id: number, prev: SituacaoPedido) {
    startTransition(() => atualizarSituacao(id, prev))
  }

  function handleRetrabalho(id: number) {
    const motivo = prompt('Motivo do retrabalho:')
    if (motivo === null) return
    startTransition(() => marcarRetrabalho(id, motivo))
  }

  function handleSalvarPedido(data: any) {
    startTransition(async () => {
      if (pedidoEditando) {
        await atualizarPedido(pedidoEditando.id, data)
      } else {
        await criarPedido(data)
      }
      setShowModal(false)
      setPedidoEditando(undefined)
    })
  }

  const filtrados = getPedidosFiltrados()

  const abas: { id: Aba; label: string; count: number; icon: React.ReactNode; alert?: boolean }[] = [
    { id: 'todos',       label: 'Ativos',    count: pedidos.filter(p => p.situacao !== 'Entregue').length, icon: <Building2 className="w-4 h-4" /> },
    { id: 'enviados',    label: 'Enviados',  count: stats.total_enviados,    icon: <Send className="w-4 h-4" /> },
    { id: 'provando',    label: 'Provando',  count: stats.total_provando,    icon: <User className="w-4 h-4" /> },
    { id: 'prontos',     label: 'Prontos',   count: stats.total_prontos,     icon: <PackageCheck className="w-4 h-4" /> },
    { id: 'entregues',   label: 'Entregues', count: stats.total_entregues,   icon: <CheckCircle2 className="w-4 h-4" /> },
    { id: 'atrasados',   label: 'Atrasados', count: stats.total_atrasados,   icon: <AlertTriangle className="w-4 h-4" />, alert: stats.total_atrasados > 0 },
    { id: 'retrabalhos', label: 'Retrab.',   count: stats.total_retrabalhos, icon: <RefreshCw className="w-4 h-4" />,    alert: stats.total_retrabalhos > 0 },
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Building2 className="w-7 h-7 text-blue-500 dark:text-blue-400" />
            Laboratórios Externos
          </h1>
          <p className="text-slate-500 dark:text-gray-400 text-sm mt-1">
            Controle de peças enviadas para labs terceirizados
          </p>
        </div>
        <button
          onClick={() => { setPedidoEditando(undefined); setShowModal(true) }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors text-sm shadow-sm"
        >
          <Plus className="w-4 h-4" />
          Novo Pedido
        </button>
      </div>

      {(stats.total_atrasados > 0 || stats.total_retrabalhos > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.total_atrasados > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="w-5 h-5 text-red-500 dark:text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-600 dark:text-red-400">{stats.total_atrasados} caso(s) em atraso</p>
                <p className="text-xs text-slate-500 dark:text-gray-400">Prazo vencido aguardando retorno</p>
              </div>
            </div>
          )}
          {stats.total_retrabalhos > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-50 dark:bg-orange-500/10 border border-orange-200 dark:border-orange-500/30">
              <RefreshCw className="w-5 h-5 text-orange-500 dark:text-orange-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-600 dark:text-orange-400">{stats.total_retrabalhos} retrabalho(s) ativo(s)</p>
                <p className="text-xs text-slate-500 dark:text-gray-400">Peças que voltaram para ajuste</p>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex gap-1 flex-wrap">
        {abas.map(a => (
          <button
            key={a.id}
            onClick={() => setAba(a.id)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              aba === a.id
                ? 'bg-blue-600 text-white shadow-sm'
                : a.alert
                  ? 'bg-red-50 text-red-600 hover:bg-red-100 dark:bg-red-500/20 dark:text-red-300 dark:hover:bg-red-500/30'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900 dark:bg-white/10 dark:text-gray-400 dark:hover:bg-white/15 dark:hover:text-white'
            }`}
          >
            {a.icon}
            {a.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${aba === a.id ? 'bg-white/20' : 'bg-slate-200 dark:bg-white/10'}`}>
              {a.count}
            </span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por paciente, dentista ou serviço..."
          className="w-full bg-white dark:bg-white/10 border border-slate-200 dark:border-white/20 rounded-xl pl-10 pr-4 py-2.5 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-500 shadow-sm"
        />
        {busca && (
          <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center py-16 text-slate-500 dark:text-gray-500">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">Nenhum pedido encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {filtrados.map(pedido => (
            <PedidoCard
              key={pedido.id}
              pedido={pedido}
              onAvancar={handleAvancar}
              onVoltar={handleVoltar}
              onRetrabalho={handleRetrabalho}
              onExcluir={(id) => startTransition(() => excluirPedido(id))}
              onEdit={(p) => { setPedidoEditando(p); setShowModal(true) }}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {showModal && (
        <ModalPedido
          labs={labs}
          pedidoEdicao={pedidoEditando}
          onClose={() => { setShowModal(false); setPedidoEditando(undefined) }}
          onSave={handleSalvarPedido}
        />
      )}
    </div>
  )
}
