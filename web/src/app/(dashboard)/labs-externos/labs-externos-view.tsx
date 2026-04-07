'use client'

import { useState, useTransition } from 'react'
import {
  Building2, Clock, AlertTriangle, RefreshCw, CheckCircle2,
  PackageCheck, Send, Plus, ChevronRight, Search, X, Loader2,
  Calendar, User, Stethoscope, FileText, ArrowRightLeft
} from 'lucide-react'
import {
  criarPedido, atualizarSituacao, marcarRetrabalho, excluirPedido,
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

const SITUACAO_CONFIG: Record<SituacaoPedido, { label: string; color: string; bg: string; next?: SituacaoPedido }> = {
  Enviado:  { label: 'Enviado',  color: 'text-blue-400',   bg: 'bg-blue-500/20',   next: 'Provando' },
  Provando: { label: 'Provando', color: 'text-purple-400', bg: 'bg-purple-500/20', next: 'Pronto'   },
  Pronto:   { label: 'Pronto',   color: 'text-green-400',  bg: 'bg-green-500/20',  next: 'Entregue' },
  Entregue: { label: 'Entregue', color: 'text-gray-400',   bg: 'bg-gray-500/20'                     },
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
  pedido, onAvancar, onRetrabalho, onExcluir, isPending
}: {
  pedido: LabExternoPedido
  onAvancar: (id: number, next: SituacaoPedido) => void
  onRetrabalho: (id: number) => void
  onExcluir: (id: number) => void
  isPending: boolean
}) {
  const cfg     = SITUACAO_CONFIG[pedido.situacao]
  const overdue = isOverdue(pedido)

  return (
    <div className={`glass-card rounded-xl p-4 border transition-all ${
      overdue ? 'border-red-500/40 bg-red-500/5' : 'border-white/10'
    }`}>
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-semibold text-white truncate">{pedido.paciente}</h3>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cfg.color} ${cfg.bg}`}>
              {cfg.label}
            </span>
            {pedido.isRetrabalho && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium text-orange-400 bg-orange-500/20">
                Retrabalho
              </span>
            )}
            {overdue && (
              <span className="text-xs px-2 py-0.5 rounded-full font-medium text-red-400 bg-red-500/20">
                {pedido.diasAtraso}d atraso
              </span>
            )}
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-400">
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
              <div className={`flex items-center gap-1 ${overdue ? 'text-red-400' : ''}`}>
                <Calendar className="w-3 h-3" />
                <span>Prazo: {formatDate(pedido.prazo)}</span>
              </div>
            )}
          </div>

          {pedido.servico && (
            <p className="mt-2 text-xs text-gray-300 leading-relaxed line-clamp-2">
              {pedido.servico}
            </p>
          )}
        </div>

        {pedido.situacao !== 'Entregue' && (
          <div className="flex flex-col gap-1 shrink-0">
            {cfg.next && (
              <button
                onClick={() => onAvancar(pedido.id, cfg.next!)}
                disabled={isPending}
                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors disabled:opacity-50"
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
                className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 transition-colors disabled:opacity-50"
              >
                <RefreshCw className="w-3 h-3" />
                Retrab.
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ModalNovoPedido({ labs, onClose, onSave }: {
  labs: LabExterno[]
  onClose: () => void
  onSave: (data: any) => void
}) {
  const [form, setForm] = useState({
    labId:     String(labs[0]?.id ?? ''),
    paciente:  '',
    dentista:  '',
    dataEnvio: '',
    prazo:     '',
    servico:   '',
  })

  const lab = labs.find(l => l.id === Number(form.labId))

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.paciente.trim()) return
    onSave({ ...form, labId: Number(form.labId), labNome: lab?.nome ?? '' })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="glass-card rounded-2xl border border-white/20 w-full max-w-lg shadow-2xl">
        <div className="flex items-center justify-between p-5 border-b border-white/10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-400" />
            Novo Pedido — Lab Externo
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="text-xs font-medium text-gray-400 mb-1 block">Laboratório *</label>
            <select
              value={form.labId}
              onChange={e => setForm(f => ({ ...f, labId: e.target.value }))}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
            >
              {labs.map(l => (
                <option key={l.id} value={l.id} className="bg-gray-900">{l.nome} — {l.cidade}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 mb-1 block">Paciente *</label>
            <input
              required
              value={form.paciente}
              onChange={e => setForm(f => ({ ...f, paciente: e.target.value }))}
              placeholder="Nome completo do paciente"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-400"
            />
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 mb-1 block">Dentista</label>
            <input
              value={form.dentista}
              onChange={e => setForm(f => ({ ...f, dentista: e.target.value }))}
              placeholder="Dr(a). Nome"
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1 block">Data de Envio</label>
              <input
                type="date"
                value={form.dataEnvio}
                onChange={e => setForm(f => ({ ...f, dataEnvio: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-400 mb-1 block">Prazo</label>
              <input
                type="date"
                value={form.prazo}
                onChange={e => setForm(f => ({ ...f, prazo: e.target.value }))}
                className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-gray-400 mb-1 block">Serviço / Descrição</label>
            <textarea
              value={form.servico}
              onChange={e => setForm(f => ({ ...f, servico: e.target.value }))}
              placeholder="Ex: Coroa sob implante do elemento 36, cor A2 VITA"
              rows={3}
              className="w-full bg-white/10 border border-white/20 rounded-lg px-3 py-2 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl border border-white/20 text-gray-400 hover:text-white hover:border-white/40 transition-colors text-sm"
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

  function handleRetrabalho(id: number) {
    const motivo = prompt('Motivo do retrabalho:')
    if (motivo === null) return
    startTransition(() => marcarRetrabalho(id, motivo))
  }

  function handleNovoPedido(data: any) {
    startTransition(async () => {
      await criarPedido(data)
      setShowModal(false)
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
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-7 h-7 text-blue-400" />
            Laboratórios Externos
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Controle de peças enviadas para labs terceirizados
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold transition-colors text-sm"
        >
          <Plus className="w-4 h-4" />
          Novo Pedido
        </button>
      </div>

      {(stats.total_atrasados > 0 || stats.total_retrabalhos > 0) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {stats.total_atrasados > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30">
              <AlertTriangle className="w-5 h-5 text-red-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-400">{stats.total_atrasados} caso(s) em atraso</p>
                <p className="text-xs text-gray-400">Prazo vencido aguardando retorno</p>
              </div>
            </div>
          )}
          {stats.total_retrabalhos > 0 && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-orange-500/10 border border-orange-500/30">
              <RefreshCw className="w-5 h-5 text-orange-400 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-orange-400">{stats.total_retrabalhos} retrabalho(s) ativo(s)</p>
                <p className="text-xs text-gray-400">Peças que voltaram para ajuste</p>
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
                ? 'bg-blue-600 text-white'
                : a.alert
                  ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30'
                  : 'bg-white/10 text-gray-400 hover:bg-white/15 hover:text-white'
            }`}
          >
            {a.icon}
            {a.label}
            <span className={`text-xs px-1.5 py-0.5 rounded-full ${aba === a.id ? 'bg-white/20' : 'bg-white/10'}`}>
              {a.count}
            </span>
          </button>
        ))}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          value={busca}
          onChange={e => setBusca(e.target.value)}
          placeholder="Buscar por paciente, dentista ou serviço..."
          className="w-full bg-white/10 border border-white/20 rounded-xl pl-10 pr-4 py-2.5 text-white text-sm placeholder-gray-500 focus:outline-none focus:border-blue-400"
        />
        {busca && (
          <button onClick={() => setBusca('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center py-16 text-gray-500">
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
              onRetrabalho={handleRetrabalho}
              onExcluir={(id) => startTransition(() => excluirPedido(id))}
              isPending={isPending}
            />
          ))}
        </div>
      )}

      {showModal && (
        <ModalNovoPedido
          labs={labs}
          onClose={() => setShowModal(false)}
          onSave={handleNovoPedido}
        />
      )}
    </div>
  )
}
