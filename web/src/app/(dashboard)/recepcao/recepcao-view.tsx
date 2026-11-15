'use client'

import { movimentarRecepcaoExterna, registrarEntregaExternaRecepcao, registrarAgendamentoExternoRecepcao } from '@/actions/recepcao-externa'
import { chaveRecepcao, type MovimentoExterno } from '@/lib/recepcao-externa'
import { correspondeBusca, dataHoraMaceio, instanteMaceio } from '@/lib/recepcao-agenda-view'
import {
  dataHoraInputClinicorp,
  instanteConsultaClinicorp,
  ordenarItensRecepcao,
  SITUACOES_GARGALO_24H,
  situacaoVisualItem,
  temCompromissoProximo,
  type OrdenacaoRecepcao,
} from '@/lib/recepcao-clinicorp'
import { filtrarOrigem, type FiltroOrigem } from '@/lib/recepcao-filtros'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  Clock3,
  ExternalLink,
  MapPin,
  PackageCheck,
  PauseCircle,
  RefreshCw,
  Search,
  Send,
  Stethoscope,
  Undo2,
  UserRoundCheck,
} from 'lucide-react'
import { toast } from 'sonner'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import {
  confirmarRecebimentoLaboratorio,
  confirmarRecebimentoRecepcao,
  distribuirParaDentista,
  enviarParaRecepcao,
  enviarRetornoLaboratorio,
  receberDoDentista,
  registrarNoLaboratorio,
  registrarEntregaInternaRecepcao,
  registrarAgendamentoInternoRecepcao,
  retornarAgendadoDaRecepcao,
  sincronizarClinicorpRecepcao,
  type FinalidadeClinica,
  type OrdemRecepcao,
  type SituacaoLogistica,
} from '@/actions/recepcao'

interface RecepcaoViewProps {
  externosDisponiveis: boolean
  itens: OrdemRecepcao[]
  dentistas: string[]
  clinicas?: string[]
  hoje?: string
  clinicorpConfigurado?: boolean
  ultimaSincronizacao?: { em: string; sucesso: boolean; erro: string | null; consultas: number } | null
  emitidoEm: string
  usuario: { nome: string; email: string; tipo: string }
}

type Filtro =
  | 'todos'
  | 'para_hoje'
  | 'receber'
  | 'recepcao'
  | 'dentista'
  | 'sem_agenda'
  | 'retorno'
  | 'laboratorio'

const SITUACOES: Record<SituacaoLogistica, { label: string; descricao: string; tone: string }> = {
  conferir_recebimento: { label: 'Conferir recebimento', descricao: 'A chegada física ainda não foi confirmada', tone: 'bg-amber-100 text-amber-800' },
  no_laboratorio: { label: 'No laboratório', descricao: 'Localização física: laboratório', tone: 'bg-slate-100 text-slate-700' },
  aguardando_recepcao: { label: 'Aguardando recepção', descricao: 'Enviado pelo laboratório', tone: 'bg-blue-100 text-blue-700' },
  aguardando_distribuicao: { label: 'Na recepção', descricao: 'Aguardando distribuição', tone: 'bg-amber-100 text-amber-800' },
  com_dentista: { label: 'Com dentista', descricao: 'Aguardando atendimento', tone: 'bg-violet-100 text-violet-700' },
  aguardando_resultado_dentista: { label: 'Resposta pendente', descricao: 'Dentista ainda não registrou o resultado', tone: 'bg-red-100 text-red-700' },
  aguardando_envio_laboratorio: { label: 'Retorno disponível', descricao: 'Pode ser enviado ao laboratório', tone: 'bg-emerald-100 text-emerald-700' },
  em_transito_laboratorio: { label: 'Retornando ao lab', descricao: 'Aguardando confirmação do laboratório', tone: 'bg-cyan-100 text-cyan-800' },
}

const FINALIDADES: Record<FinalidadeClinica, string> = {
  prova: 'Prova clínica',
  instalacao: 'Instalação',
  entrega: 'Entrega ao paciente',
}

function pertenceFiltro(item: OrdemRecepcao, filtro: Filtro, hoje = '') {
  const situacaoVisual = situacaoVisualItem(item.situacao, item.decisaoDentista)
  if (filtro === 'para_hoje') return temCompromissoProximo(item, hoje)
  if (filtro === 'receber') return ['aguardando_recepcao', 'conferir_recebimento'].includes(situacaoVisual)
  if (filtro === 'recepcao') return !item.agendamentoConfirmado && ['aguardando_distribuicao', 'aguardando_resultado_dentista', 'aguardando_envio_laboratorio'].includes(situacaoVisual)
  if (filtro === 'dentista') return item.agendamentoConfirmado
  if (filtro === 'sem_agenda') return item.situacao === 'com_dentista' && !item.agendamentoConfirmado
  if (filtro === 'retorno') return situacaoVisual === 'em_transito_laboratorio'
  if (filtro === 'laboratorio') return situacaoVisual === 'no_laboratorio'
  return true
}

function formatarData(valor: string | null, comHora = false) {
  if (!valor) return 'Não informado'
  return new Date(valor).toLocaleString('pt-BR', comHora
    ? { timeZone: 'America/Maceio', dateStyle: 'short', timeStyle: 'short' }
    : { timeZone: 'UTC', dateStyle: 'short' })
}

function formatarDataDiaClinicorp(dataIso: string, hoje: string) {
  const [ano, mes, dia] = dataIso.slice(0, 10).split('-')
  const base = dia && mes && ano ? `${dia}/${mes}` : dataIso
  if (!hoje) return base
  if (dataIso === hoje) return `Hoje (${base})`
  const dtHoje = new Date(`${hoje}T00:00:00Z`)
  dtHoje.setUTCDate(dtHoje.getUTCDate() + 1)
  if (dataIso === dtHoje.toISOString().slice(0, 10)) return `Amanhã (${base})`
  return base
}

function horasParado(item: OrdemRecepcao, emitidoEm: string) {
  if (!item.movimentadoEm) return 0
  return Math.max(0, (new Date(emitidoEm).getTime() - new Date(item.movimentadoEm).getTime()) / 3_600_000)
}

export function RecepcaoView({
  itens,
  dentistas,
  clinicas,
  hoje,
  clinicorpConfigurado,
  ultimaSincronizacao,
  emitidoEm,
  usuario,
  externosDisponiveis,
}: RecepcaoViewProps) {
  const router = useRouter()
  const [origem, setOrigem] = useState<FiltroOrigem>('todos')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const [filtroClinica, setFiltroClinica] = useState('todas')
  const [filtroDentista, setFiltroDentista] = useState('todos')
  const [ordenacao, setOrdenacao] = useState<OrdenacaoRecepcao>('urgencia')
  const [agendando, setAgendando] = useState<OrdemRecepcao | null>(null)
  const agendamentoEmCurso = useRef(false)
  const [distribuindo, setDistribuindo] = useState<OrdemRecepcao | null>(null)
  const [isPending, startTransition] = useTransition()
  const [sincronizando, startSyncTransition] = useTransition()

  const diaReferencia = hoje || emitidoEm.slice(0, 10)
  const recepcaoSomente = usuario.tipo === 'recepcao'
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const itensOrigem = filtrarOrigem(itens, origem)

  const clinicasOpcoes = clinicas ?? [...new Set(itens.map((i) => i.clinica).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR'))
  const dentistasOpcoes = [...new Set([
    ...dentistas,
    ...itens.map((i) => i.dentista),
    ...itens.map((i) => i.agendamentoDentista),
    ...itens.map((i) => i.clinicorp?.proximaConsulta?.dentistaNome),
  ].filter((d): d is string => Boolean(d?.trim())).map((d) => d.trim()))].sort((a, b) => a.localeCompare(b, 'pt-BR'))

  const origens: Array<{ id: FiltroOrigem; label: string; quantidade: number }> = [
    { id: 'todos', label: 'Todos', quantidade: itens.length },
    { id: 'interno', label: 'Lab interno', quantidade: filtrarOrigem(itens, 'interno').length },
    { id: 'externo', label: 'Labs externos', quantidade: filtrarOrigem(itens, 'externo').length },
  ]

  const filtradosBrutos = itensOrigem.filter((item) => {
    if (!pertenceFiltro(item, filtro, diaReferencia)) return false
    if (filtroClinica !== 'todas' && item.clinica !== filtroClinica) return false
    if (filtroDentista !== 'todos') {
      const dentistaMatch = [item.dentista, item.agendamentoDentista, item.clinicorp?.proximaConsulta?.dentistaNome]
        .some((nome) => nome?.trim() === filtroDentista)
      if (!dentistaMatch) return false
    }
    if (termo && !correspondeBusca(item, termo)) return false
    return true
  })

  const filtrados = ordenarItensRecepcao(filtradosBrutos, ordenacao)
  const parados = itensOrigem.filter((item) => {
    const sit = situacaoVisualItem(item.situacao, item.decisaoDentista)
    return SITUACOES_GARGALO_24H.has(sit) && horasParado(item, emitidoEm) >= 24
  }).length
  const emRiscoClinicorp = itensOrigem.filter((item) => Boolean(item.clinicorp?.risco)).length

  const filtros: Array<{ id: Filtro; label: string; quantidade: number }> = [
    { id: 'todos', label: 'Todos', quantidade: itensOrigem.length },
    { id: 'para_hoje', label: 'Hoje / Clinicorp', quantidade: itensOrigem.filter((item) => pertenceFiltro(item, 'para_hoje', diaReferencia)).length },
    { id: 'receber', label: 'Receber', quantidade: itensOrigem.filter((item) => pertenceFiltro(item, 'receber', diaReferencia)).length },
    { id: 'recepcao', label: 'Na recepção', quantidade: itensOrigem.filter((item) => pertenceFiltro(item, 'recepcao', diaReferencia)).length },
    { id: 'dentista', label: 'Agendamento realizado', quantidade: itensOrigem.filter((item) => pertenceFiltro(item, 'dentista', diaReferencia)).length },
    { id: 'sem_agenda', label: 'Com dentista (sem agenda)', quantidade: itensOrigem.filter((item) => pertenceFiltro(item, 'sem_agenda', diaReferencia)).length },
    { id: 'retorno', label: 'Retorno ao lab', quantidade: itensOrigem.filter((item) => pertenceFiltro(item, 'retorno', diaReferencia)).length },
    { id: 'laboratorio', label: 'No laboratório', quantidade: itensOrigem.filter((item) => pertenceFiltro(item, 'laboratorio', diaReferencia)).length },
  ]

  function executar(acao: () => Promise<{ success: boolean; error?: string }>, sucesso: string) {
    startTransition(async () => {
      try {
        const resultado = await acao()
        if (!resultado.success) {
          toast.error(resultado.error || 'Não foi possível registrar a movimentação.')
          router.refresh()
          return
        }
        toast.success(sucesso)
        router.refresh()
      } catch {
        toast.error('Não foi possível registrar a movimentação. Tente novamente.')
      }
    })
  }

  function sincronizarClinicorp() {
    startSyncTransition(async () => {
      try {
        const res = await sincronizarClinicorpRecepcao()
        if (!res.success) {
          toast.error(res.error || 'Falha ao sincronizar com o Clinicorp.')
          return
        }
        toast.success(res.mensagem || 'Agenda sincronizada com o Clinicorp.')
        router.refresh()
      } catch {
        toast.error('Não foi possível sincronizar com o Clinicorp.')
      }
    })
  }

  return (
    <DashboardLayout user={{ nome: usuario.nome, email: usuario.email, tipo: usuario.tipo }}>
      <Header title="Recepção e distribuição" subtitle="Custódia dos trabalhos entre laboratório, recepção, dentistas e agenda Clinicorp" />
      <main className="mx-auto max-w-[1500px] space-y-5 p-1 sm:p-6">
        {!externosDisponiveis ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Fluxo dos laboratórios externos indisponível ou ainda não ativado. Esta lista mostra somente os trabalhos internos.</p> : null}

        {clinicorpConfigurado !== undefined ? (
          <section aria-label="Integração com Clinicorp" className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border bg-white px-4 py-3 shadow-sm dark:border-white/10 dark:bg-slate-900">
            <div className="flex items-center gap-3 text-xs sm:text-sm">
              <div className={`rounded-xl p-2 ${clinicorpConfigurado ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-100 text-slate-500'}`}>
                <CalendarClock className="h-4 w-4" />
              </div>
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">
                  {clinicorpConfigurado ? 'Agenda Clinicorp integrada à recepção' : 'Clinicorp não configurado neste ambiente'}
                </p>
                <p className="text-xs text-slate-500">
                  {clinicorpConfigurado
                    ? ultimaSincronizacao
                      ? `Última sincronização: ${formatarData(ultimaSincronizacao.em, true)} (${ultimaSincronizacao.sucesso ? `${ultimaSincronizacao.consultas} consulta(s)` : `erro: ${ultimaSincronizacao.erro || 'falha'}`})`
                      : 'Nenhuma sincronização executada ainda.'
                    : 'Defina CLINICORP_URL, CLINICORP_SUBSCRIBER e CLINICORP_AUTH para cruzar os atendimentos automaticamente.'}
                </p>
              </div>
            </div>
            {clinicorpConfigurado ? (
              <Button size="sm" variant="outline" disabled={sincronizando || isPending} onClick={sincronizarClinicorp}>
                <RefreshCw className={`h-3.5 w-3.5 ${sincronizando ? 'animate-spin' : ''}`} />
                {sincronizando ? 'Sincronizando...' : 'Sincronizar Clinicorp'}
              </Button>
            ) : null}
          </section>
        ) : null}

        <section aria-label="Origem dos trabalhos" className="rounded-2xl border bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">Origem dos trabalhos</p>
          <div className="grid grid-cols-3 gap-2" role="group" aria-label="Filtrar por origem">
            {origens.map((item) => (
              <button key={item.id} type="button" aria-pressed={origem === item.id} onClick={() => setOrigem(item.id)} className={`min-w-0 rounded-xl px-2 py-3 text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-600 sm:px-4 ${origem === item.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300'}`}>
                <span className="block">{item.label}</span>
                <span className="mt-1 block text-lg opacity-80">{item.id === 'externo' && !externosDisponiveis ? 'Indisponível' : item.quantidade}</span>
              </button>
            ))}
          </div>
        </section>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Resumo icon={PackageCheck} label="Receber ou conferir" valor={itensOrigem.filter((item) => pertenceFiltro(item, 'receber', diaReferencia)).length} tone="blue" />
          <Resumo icon={MapPin} label="Na recepção" valor={itensOrigem.filter((item) => pertenceFiltro(item, 'recepcao', diaReferencia)).length} tone="amber" />
          <Resumo icon={Stethoscope} label="Agendamento realizado" valor={itensOrigem.filter((item) => item.agendamentoConfirmado).length} tone="violet" detalhe={itensOrigem.filter((item) => pertenceFiltro(item, 'sem_agenda', diaReferencia)).length > 0 ? `${itensOrigem.filter((item) => pertenceFiltro(item, 'sem_agenda', diaReferencia)).length} com dentista sem agenda` : undefined} />
          <Resumo icon={Clock3} label="Parados há mais de 24h" valor={parados} tone={parados || emRiscoClinicorp ? 'red' : 'slate'} detalhe={emRiscoClinicorp > 0 ? `${emRiscoClinicorp} com risco Clinicorp` : undefined} />
        </section>

        <section className="rounded-2xl border bg-white p-3 shadow-sm dark:border-white/10 dark:bg-slate-900 sm:p-4 space-y-3">
          <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filtrar movimentações da recepção">
            {filtros.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={filtro === item.id} onClick={() => setFiltro(item.id)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${filtro === item.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300'}`}>
                {item.label} <span className="ml-1 opacity-70">{item.quantidade}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-2 md:grid-cols-4">
            <div className="relative md:col-span-2">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar paciente, dentista, clínica, serviço ou OS" className="pl-9" aria-label="Buscar trabalhos na recepção" />
            </div>
            <select aria-label="Filtrar por clínica ou laboratório" value={filtroClinica} onChange={(e) => setFiltroClinica(e.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
              <option value="todas">Todas as clínicas/labs</option>
              {clinicasOpcoes.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
            </select>
            <div className="grid grid-cols-2 gap-2">
              <select aria-label="Filtrar por dentista" value={filtroDentista} onChange={(e) => setFiltroDentista(e.target.value)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                <option value="todos">Todos dentistas</option>
                {dentistasOpcoes.map((nome) => <option key={nome} value={nome}>{nome}</option>)}
              </select>
              <select aria-label="Ordenar fila" value={ordenacao} onChange={(e) => setOrdenacao(e.target.value as OrdenacaoRecepcao)} className="h-10 rounded-md border border-input bg-background px-2 text-sm">
                <option value="urgencia">Urgência / Agenda</option>
                <option value="parados">Mais tempo parado</option>
                <option value="entrega">Entrega prevista</option>
              </select>
            </div>
          </div>
        </section>

        {filtrados.length === 0 ? (
          <section className="rounded-2xl border border-dashed p-12 text-center text-slate-500 dark:border-white/10">
            <CheckCircle2 className="mx-auto mb-3 h-10 w-10 text-emerald-500" />
            <p className="font-semibold">{origem === 'externo' && !externosDisponiveis ? 'Não foi possível consultar os trabalhos externos.' : 'Nenhum trabalho nesta fila.'}</p>
          </section>
        ) : (
          <section className="grid items-start gap-3 lg:grid-cols-2">
            {filtrados.map((item) => (
              <TrabalhoCard
                key={chaveRecepcao(item.origem, item.id)}
                item={item}
                hoje={diaReferencia}
                emitidoEm={emitidoEm}
                recepcaoSomente={recepcaoSomente}
                disabled={isPending}
                onDistribuir={() => setDistribuindo(item)}
                onAgendar={() => setAgendando(item)}
                onExecutar={executar}
              />
            ))}
          </section>
        )}
      </main>

      {agendando ? <AgendamentoModal item={agendando} dentistas={dentistasOpcoes} hoje={diaReferencia} disabled={isPending} onClose={() => setAgendando(null)} onConfirm={(agendado, dentista, agendamento) => {
        if (agendamentoEmCurso.current) return
        agendamentoEmCurso.current = true
        executar(async () => {
          try {
            const resultado = agendando.origem === 'externo' && agendando.externo
              ? await registrarAgendamentoExternoRecepcao({ origem: 'externo', id: agendando.id, expectedRevision: agendando.externo.revisao, expectedVersion: agendando.externo.version, agendado, dentista, agendamento })
              : await registrarAgendamentoInternoRecepcao({ ordemId: agendando.id, expectedUpdatedAt: agendando.interno?.atualizadoEm ?? null, agendado, dentista, agendamento })
            if (resultado.success || ('code' in resultado && resultado.code === 'CONFLICT')) setAgendando(null)
            return resultado
          } finally {
            agendamentoEmCurso.current = false
          }
        }, agendado ? 'Agendamento salvo.' : 'Agendamento cancelado.')
      }} /> : null}
      {distribuindo ? (
        <DistribuirModal
          item={distribuindo}
          dentistas={dentistasOpcoes}
          disabled={isPending}
          onClose={() => setDistribuindo(null)}
          onConfirm={(dados) => executar(async () => {
            const resultado = distribuindo.origem === 'externo'
              ? await executarExterno(distribuindo, { acao: 'distribuir', dentista: dados.dentista, finalidade: dados.finalidade, motivo: dados.observacao })
              : await distribuirParaDentista({ ordemId: distribuindo.id, ...dados })
            if (resultado.success || ('code' in resultado && resultado.code === 'CONFLICT')) setDistribuindo(null)
            return resultado
          }, 'Trabalho entregue ao dentista.')}
        />
      ) : null}
    </DashboardLayout>
  )
}

function Resumo({ icon: Icon, label, valor, tone, detalhe }: { icon: typeof PackageCheck; label: string; valor: number; tone: string; detalhe?: string }) {
  const cores: Record<string, string> = { blue: 'text-blue-600 bg-blue-50', amber: 'text-amber-700 bg-amber-50', violet: 'text-violet-600 bg-violet-50', red: 'text-red-600 bg-red-50', slate: 'text-slate-600 bg-slate-50' }
  return (
    <div className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900">
      <div className={`rounded-xl p-2.5 ${cores[tone]}`}><Icon className="h-5 w-5" /></div>
      <div className="min-w-0">
        <p className="text-2xl font-bold">{valor}</p>
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        {detalhe ? <p className="mt-0.5 text-[11px] font-medium text-amber-700 dark:text-amber-400">{detalhe}</p> : null}
      </div>
    </div>
  )
}

function TrabalhoCard({ item, hoje, emitidoEm, recepcaoSomente, disabled, onDistribuir, onAgendar, onExecutar }: {
  item: OrdemRecepcao
  hoje: string
  emitidoEm: string
  recepcaoSomente: boolean
  disabled: boolean
  onDistribuir: () => void
  onAgendar: () => void
  onExecutar: (acao: () => Promise<{ success: boolean; error?: string }>, sucesso: string) => void
}) {
  const situacaoVisual = situacaoVisualItem(item.situacao, item.decisaoDentista) as SituacaoLogistica
  const config = SITUACOES[situacaoVisual]
  const horas = horasParado(item, emitidoEm)
  const pausado = item.status === 'Pausado'
  const consultaClinicorp = item.clinicorp?.proximaConsulta ?? null
  const riscoClinicorp = item.clinicorp?.risco ?? null
  const atrasado24h = horas >= 24 && SITUACOES_GARGALO_24H.has(situacaoVisual)
  const custodiaForaRecepcaoParaEntrega = ['no_laboratorio', 'em_transito_laboratorio', 'conferir_recebimento', 'aguardando_recepcao'].includes(situacaoVisual)
  const idLabel = `${item.origem === 'externo' ? 'Externo' : 'Interno · OS'} #${item.id}`

  function confirmarComClinicorp() {
    if (!consultaClinicorp) return
    const agendamento = instanteConsultaClinicorp(consultaClinicorp.data, consultaClinicorp.horaInicio)
    const dentista = consultaClinicorp.dentistaNome || item.dentista || ''
    onExecutar(async () => (
      item.origem === 'externo' && item.externo
        ? registrarAgendamentoExternoRecepcao({ origem: 'externo', id: item.id, expectedRevision: item.externo.revisao, expectedVersion: item.externo.version, agendado: true, dentista, agendamento })
        : registrarAgendamentoInternoRecepcao({ ordemId: item.id, expectedUpdatedAt: item.interno?.atualizadoEm ?? null, agendado: true, dentista, agendamento })
    ), 'Agendamento importado do Clinicorp.')
  }

  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm dark:border-white/10 dark:bg-slate-900 ${riscoClinicorp === 'hoje_sem_peca' || riscoClinicorp === 'resposta_pendente_com_consulta' || atrasado24h ? 'border-red-300 dark:border-red-800' : riscoClinicorp === 'amanha_sem_peca' ? 'border-amber-300 dark:border-amber-700' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          {recepcaoSomente ? (
            <p className="text-xs font-bold text-indigo-600">{idLabel}</p>
          ) : (
            <a href={item.origem === 'externo' ? '/labs-externos' : `/ordens?busca=${item.id}&status=todos`} className="inline-flex items-center gap-1 text-xs font-bold text-indigo-600 hover:underline">
              {idLabel}
              <ExternalLink className="h-3 w-3" />
            </a>
          )}
          <h2 className="break-words text-lg font-bold">{item.paciente}</h2>
          <p className="whitespace-pre-wrap break-words text-sm text-slate-500">{item.servico} · {item.clinica}</p>
        </div>
        <div className="flex flex-wrap justify-end gap-1.5">
          {pausado ? <Badge className="bg-amber-100 text-amber-800"><PauseCircle className="mr-1 h-3 w-3" />Pausado</Badge> : null}
          <Badge className={config.tone}>{config.label}</Badge>
        </div>
      </div>

      {consultaClinicorp ? (
        <div className={`mt-3 rounded-xl border p-2.5 text-xs ${riscoClinicorp === 'hoje_sem_peca' || riscoClinicorp === 'resposta_pendente_com_consulta' ? 'border-red-200 bg-red-50 text-red-800' : riscoClinicorp === 'amanha_sem_peca' ? 'border-amber-200 bg-amber-50 text-amber-900' : 'border-indigo-100 bg-indigo-50/70 text-indigo-900'}`}>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="flex items-center gap-1.5 font-semibold">
              <CalendarClock className="h-3.5 w-3.5 shrink-0" />
              Clinicorp: {formatarDataDiaClinicorp(consultaClinicorp.data, hoje)}{consultaClinicorp.horaInicio ? ` às ${consultaClinicorp.horaInicio}` : ''} · {consultaClinicorp.dentistaNome || 'Profissional não informado'}
              {consultaClinicorp.categoria ? ` · ${consultaClinicorp.categoria}` : ''}
            </p>
            {!item.agendamentoConfirmado && ['aguardando_distribuicao', 'com_dentista'].includes(situacaoVisual) ? (
              <Button size="sm" variant="outline" className="h-7 bg-white px-2 text-xs" disabled={disabled} onClick={confirmarComClinicorp}>
                Confirmar agenda do Clinicorp
              </Button>
            ) : null}
          </div>
          {riscoClinicorp === 'hoje_sem_peca' ? <p className="mt-1 flex items-center gap-1 font-semibold"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />Atenção: paciente agendado hoje no Clinicorp e o trabalho ainda não está pronto na recepção.</p> : null}
          {riscoClinicorp === 'amanha_sem_peca' ? <p className="mt-1 flex items-center gap-1 font-semibold"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />Atenção: paciente agendado amanhã no Clinicorp e o trabalho ainda não foi conferido na recepção.</p> : null}
          {riscoClinicorp === 'resposta_pendente_com_consulta' ? <p className="mt-1 flex items-center gap-1 font-semibold"><AlertTriangle className="h-3.5 w-3.5 shrink-0" />Atenção: paciente com consulta próxima no Clinicorp e resposta clínica pendente no portal.</p> : null}
        </div>
      ) : null}

      <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-white/5 sm:grid-cols-2">
        <p><span className="font-semibold text-slate-500">Etapa:</span> {item.etapa}</p>
        <p><span className="font-semibold text-slate-500">Finalidade:</span> {item.finalidade ? FINALIDADES[item.finalidade] : 'A definir na distribuição'}</p>
        <p><span className="font-semibold text-slate-500">Dentista:</span> {item.dentista || 'Ainda não definido'}</p>
        <p><span className="font-semibold text-slate-500">Agendamento:</span> {item.agendamentoConfirmado ? `Confirmado · ${formatarData(item.agendamento, true)} · ${item.agendamentoDentista || 'Dentista não informado'}` : item.agendamento ? `Histórico não confirmado · ${formatarData(item.agendamento, true)}` : 'Não confirmado'}</p>
        <p><span className="font-semibold text-slate-500">Entrega prevista:</span> {formatarData(item.entregaPrevista)}</p>
        <p className={atrasado24h ? 'font-semibold text-red-600' : ''}><span className="font-semibold text-slate-500">Nesta situação:</span> {item.movimentadoEm ? `${Math.floor(horas)}h` : 'Histórico anterior'}</p>
      </div>
      {item.situacao === 'com_dentista' && !item.agendamentoConfirmado ? <p className="mt-3 text-xs text-amber-700">Custódia registrada com dentista; agendamento não confirmado. Confira antes de agendar.</p> : null}
      {(item.agendamentoConfirmado || ['aguardando_distribuicao', 'com_dentista'].includes(situacaoVisual)) ? <div className="mt-3 flex justify-end"><Button size="sm" variant="outline" disabled={disabled} onClick={onAgendar}>{item.agendamentoConfirmado ? 'Editar ou cancelar agendamento' : 'Registrar agendamento'}</Button></div> : null}
      {situacaoVisual === 'aguardando_resultado_dentista' ? <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">O trabalho voltou fisicamente, mas o dentista ainda precisa registrar no portal se foi aprovado ou se precisa de ajuste.</p> : null}
      {item.decisaoDentista ? <p className={`mt-3 rounded-lg p-2 text-xs font-semibold ${item.decisaoDentista === 'aprovado' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{item.decisaoDentista === 'aprovado' ? 'Prova aprovada pelo dentista' : `Ajuste solicitado: ${item.observacaoDentista || 'sem observação'}`}</p> : null}
      {((item.origem === 'externo' && item.status === 'Pronto') || (item.origem === 'interno' && item.status === 'Finalizado')) && custodiaForaRecepcaoParaEntrega ? (
        <p className="mt-2 text-xs text-amber-700">Atenção: custódia física ainda não foi confirmada na recepção.</p>
      ) : null}
      {item.origem === 'externo' ? <AcoesExternas item={item} disabled={disabled} onDistribuir={onDistribuir} onExecutar={onExecutar} /> :
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {item.status === 'Finalizado' ? <Button size="sm" disabled={disabled} onClick={() => {
          if (window.confirm(`Confirma que este trabalho já foi entregue ao paciente?\nOS #${item.id} · ${item.paciente}\nA OS será marcada como Entregue e sairá da fila. A cobrança existente e os pagamentos serão preservados. Se a cobrança estiver ausente ou inconsistente, a entrega não será registrada e será necessário pedir à administração para conferir. Isso não registra pagamento.`)) {
            onExecutar(() => registrarEntregaInternaRecepcao({ ordemId: item.id, expectedUpdatedAt: item.interno?.atualizadoEm ?? null }), 'Entrega ao paciente registrada. Cobrança conferida, sem registrar pagamento.')
          }
        }}><PackageCheck className="h-4 w-4" />Registrar entrega ao paciente</Button> : null}
        {situacaoVisual === 'no_laboratorio' && !recepcaoSomente ? <Button size="sm" onClick={() => onExecutar(() => enviarParaRecepcao(item.id), 'Envio para a recepção registrado.')} disabled={disabled}><Send className="h-4 w-4" />Enviar à recepção</Button> : null}
        {['aguardando_recepcao', 'no_laboratorio'].includes(situacaoVisual) ? <Button size="sm" onClick={() => onExecutar(() => confirmarRecebimentoRecepcao(item.id), 'Recebimento confirmado.')} disabled={disabled}><PackageCheck className="h-4 w-4" />Confirmar recebimento</Button> : null}
        {situacaoVisual === 'aguardando_distribuicao' && item.agendamentoConfirmado ? <Button size="sm" variant="outline" disabled={disabled} onClick={() => { if (window.confirm('Enviar fisicamente ao laboratório sem registrar decisão clínica? O agendamento será encerrado.')) onExecutar(() => retornarAgendadoDaRecepcao({ ordemId: item.id, expectedUpdatedAt: item.interno?.atualizadoEm ?? null }), 'Retorno físico registrado.') }}>Retornar ao laboratório</Button> : null}
        {situacaoVisual === 'aguardando_distribuicao' ? <Button size="sm" onClick={onDistribuir} disabled={disabled}><UserRoundCheck className="h-4 w-4" />Entregar ao dentista</Button> : null}
        {situacaoVisual === 'com_dentista' ? <><Button size="sm" variant="outline" onClick={onDistribuir} disabled={disabled}><RefreshCw className="h-4 w-4" />Corrigir</Button><Button size="sm" onClick={() => onExecutar(() => receberDoDentista(item.id), 'Devolução do dentista registrada.')} disabled={disabled}><Undo2 className="h-4 w-4" />Receber do dentista</Button></> : null}
        {situacaoVisual === 'aguardando_resultado_dentista' ? <Button size="sm" variant="outline" onClick={() => onExecutar(() => enviarRetornoLaboratorio(item.id), 'Retorno enviado ao laboratório.')} disabled={disabled}><RefreshCw className="h-4 w-4" />Verificar resposta</Button> : null}
        {situacaoVisual === 'aguardando_envio_laboratorio' ? <Button size="sm" onClick={() => onExecutar(() => enviarRetornoLaboratorio(item.id), 'Retorno enviado ao laboratório.')} disabled={disabled}><Send className="h-4 w-4" />Enviar ao laboratório</Button> : null}
        {situacaoVisual === 'em_transito_laboratorio' && !recepcaoSomente ? <Button size="sm" onClick={() => onExecutar(() => confirmarRecebimentoLaboratorio(item.id), 'Recebimento no laboratório confirmado.')} disabled={disabled}><Building2 className="h-4 w-4" />Confirmar no laboratório</Button> : null}
      </div>}
      {(item.origem === 'externo'
        ? ['conferir_recebimento', 'aguardando_distribuicao', 'em_transito_laboratorio']
        : ['aguardando_recepcao', 'aguardando_distribuicao']).includes(situacaoVisual) ? (
        <div className="mt-2 flex justify-end"><Button size="sm" variant="outline" disabled={disabled} onClick={() => {
          if (window.confirm(`Você conferiu que este trabalho está no laboratório, e não na recepção?\n${item.origem === 'externo' ? 'Externo' : 'OS'} #${item.id}\nIsso registra somente a localização física, sem alterar a etapa clínica ou marcar entrega.`)) {
            onExecutar(() => item.origem === 'externo'
              ? executarExterno(item, { acao: 'registrar_no_laboratorio' })
              : registrarNoLaboratorio({ ordemId: item.id, situacao: item.situacao, movimentadoEm: item.movimentadoEm }), 'Localização registrada: no laboratório.')
          }
        }}><Building2 className="h-4 w-4" />Está no laboratório</Button></div>
      ) : null}
      <p className="mt-2 text-right text-[11px] text-slate-400">{config.descricao}</p>
    </article>
  )
}

function DistribuirModal({ item, dentistas, disabled, onClose, onConfirm }: {
  item: OrdemRecepcao
  dentistas: string[]
  disabled: boolean
  onClose: () => void
  onConfirm: (dados: { dentista: string; finalidade: FinalidadeClinica; agendamento?: string; observacao?: string }) => void
}) {
  const corrigindo = item.situacao === 'com_dentista'
  const [dentista, setDentista] = useState(item.dentista)
  const [finalidade, setFinalidade] = useState<FinalidadeClinica>(item.finalidade || 'prova')
  const [observacao, setObservacao] = useState('')
  const motivoMinimo = corrigindo && item.origem === 'externo' ? 5 : undefined
  return (
    <Modal isOpen onClose={onClose} title={corrigindo ? 'Corrigir distribuição' : 'Entregar ao dentista'} description={`${item.origem === 'externo' ? 'Externo' : 'OS'} #${item.id} · ${item.paciente}`} size="md" mobileFullscreen dismissible={!disabled}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onConfirm({ dentista, finalidade, observacao: observacao || undefined }) }}>
        <div><label htmlFor="dentista-recepcao" className="mb-1 block text-sm font-semibold">Dentista responsável *</label><Input id="dentista-recepcao" list="dentistas-recepcao" value={dentista} onChange={(event) => setDentista(event.target.value)} placeholder="Nome do dentista" required maxLength={255} /><datalist id="dentistas-recepcao">{dentistas.map((nome) => <option key={nome} value={nome} />)}</datalist></div>
        <div><label htmlFor="finalidade-recepcao" className="mb-1 block text-sm font-semibold">Finalidade *</label><select id="finalidade-recepcao" value={finalidade} onChange={(event) => setFinalidade(event.target.value as FinalidadeClinica)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="prova">Prova clínica</option><option value="instalacao">Instalação</option><option value="entrega">Entrega ao paciente</option></select></div>
        {corrigindo ? <div><label htmlFor="motivo-correcao" className="mb-1 block text-sm font-semibold">Motivo da correção *</label><textarea id="motivo-correcao" value={observacao} onChange={(event) => setObservacao(event.target.value)} required minLength={motivoMinimo} rows={3} maxLength={500} className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder={motivoMinimo ? 'Explique por que a distribuição está sendo alterada (mínimo 5 caracteres).' : 'Explique por que a distribuição está sendo alterada.'} /></div> : null}
        <div className="flex justify-end gap-2 border-t pt-4"><Button type="button" variant="outline" onClick={onClose} disabled={disabled}>Cancelar</Button><Button type="submit" disabled={disabled || !dentista.trim()}>{disabled ? 'Salvando...' : corrigindo ? 'Salvar correção' : <><ChevronRight className="h-4 w-4" />Confirmar entrega</>}</Button></div>
      </form>
    </Modal>
  )
}

async function executarExterno(item: OrdemRecepcao, movimento: Omit<MovimentoExterno, 'expectedVersion'>) {
  if (item.origem !== 'externo' || !item.externo) return { success: false, error: 'Referência externa inválida. Atualize a página.' }
  return movimentarRecepcaoExterna({ ...movimento, origem: 'externo', id: item.id,
    expectedRevision: item.externo.revisao, expectedVersion: item.externo.version })
}
function AcoesExternas({ item, disabled, onDistribuir, onExecutar }: {
  item: OrdemRecepcao; disabled: boolean; onDistribuir: () => void
  onExecutar: (acao: () => Promise<{ success: boolean; error?: string }>, sucesso: string) => void
}) {
  return <div className="mt-4 space-y-3">
    <p className="text-xs text-slate-500">Controle físico do trabalho externo. Não registra aprovação clínica nem altera o financeiro.</p>
    <div className="flex flex-wrap justify-end gap-2">
      {item.status === 'Pronto' ? <Button disabled={disabled} onClick={() => {
        if (window.confirm(`Confirma que este pedido externo já foi entregue?\nExterno #${item.id} · ${item.paciente}\nO pedido será marcado como Entregue e sairá da fila da recepção. O financeiro não será alterado.`)) {
          onExecutar(() => registrarEntregaExternaRecepcao({ origem: 'externo', id: item.id, expectedRevision: item.externo?.revisao || '', expectedVersion: item.externo?.version ?? -1 }), 'Entrega registrada. Pedido concluído e retirado da fila da recepção.')
        }
      }}><PackageCheck className="h-4 w-4" />Registrar entrega</Button> : null}
      {['conferir_recebimento', 'em_transito_laboratorio', 'no_laboratorio'].includes(item.situacao) ? <Button disabled={disabled} onClick={() => {
        if (window.confirm('Você confirma que recebeu fisicamente este trabalho do laboratório externo?')) onExecutar(() => executarExterno(item, { acao: 'receber' }), 'Recebimento externo confirmado.')
      }}>Confirmar recebimento físico</Button> : null}
      {item.situacao === 'aguardando_distribuicao' && item.agendamentoConfirmado ? <Button disabled={disabled} variant="outline" onClick={() => { if (window.confirm('Enviar fisicamente ao laboratório sem registrar decisão clínica? O agendamento será encerrado.')) onExecutar(() => executarExterno(item, { acao: 'enviar_retorno' }), 'Retorno físico registrado.') }}>Retornar ao laboratório</Button> : null}
      {['aguardando_distribuicao', 'com_dentista'].includes(item.situacao) ? <Button disabled={disabled} onClick={onDistribuir}>{item.situacao === 'com_dentista' ? 'Corrigir distribuição' : 'Entregar ao dentista'}</Button> : null}
      {item.situacao === 'com_dentista' ? <Button disabled={disabled} onClick={() => onExecutar(() => executarExterno(item, { acao: 'receber_retorno' }), 'Retorno físico do dentista registrado.')}>Receber do dentista</Button> : null}
      {item.situacao === 'aguardando_envio_laboratorio' ? <Button disabled={disabled} onClick={() => onExecutar(() => executarExterno(item, { acao: 'enviar_retorno' }), 'Envio físico ao laboratório externo registrado.')}>Enviar ao laboratório externo</Button> : null}
    </div>
  </div>
}

function AgendamentoModal({ item, dentistas, hoje, disabled, onClose, onConfirm }: {
  item: OrdemRecepcao
  dentistas?: string[]
  hoje?: string
  disabled: boolean
  onClose: () => void
  onConfirm: (agendado: boolean, dentista?: string, agendamento?: string) => void
}) {
  const [dentista, setDentista] = useState(item.agendamentoConfirmado ? item.agendamentoDentista || '' : '')
  const [data, setData] = useState(item.agendamentoConfirmado ? dataHoraMaceio(item.agendamento) : '')
  const consultaClinicorp = item.clinicorp?.proximaConsulta ?? null
  return <Modal isOpen onClose={onClose} title={item.agendamentoConfirmado ? 'Editar agendamento' : 'Registrar agendamento'} description={`${item.paciente} · ${item.origem} #${item.id}`} size="md" mobileFullscreen dismissible={!disabled}>
    <form className="space-y-4" onSubmit={event => { event.preventDefault(); if (!disabled) onConfirm(true, dentista, data ? instanteMaceio(data) : undefined) }}>
      <p className="text-sm">O agendamento não altera a localização física nem registra resultado clínico.</p>
      <label className="block text-sm">Dentista (opcional)<Input list="dentistas-agendamento-recepcao" value={dentista} onChange={event => setDentista(event.target.value)} maxLength={255} /></label>
      <label className="block text-sm">Data e hora em Maceió (opcional)<Input type="datetime-local" value={data} onChange={event => setData(event.target.value)} /></label>
      <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={disabled} onClick={onClose}>Fechar</Button>{item.agendamentoConfirmado ? <Button type="button" variant="outline" disabled={disabled} onClick={() => { if (window.confirm('Cancelar este agendamento? A localização física não será alterada.')) onConfirm(false) }}>Cancelar agendamento</Button> : null}{['aguardando_distribuicao', 'com_dentista'].includes(item.situacao) ? <Button type="submit" disabled={disabled}>{disabled ? 'Salvando...' : 'Salvar agendamento'}</Button> : null}</div>
      {consultaClinicorp ? (
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 text-xs text-indigo-950">
          <p className="font-semibold">Consulta encontrada no Clinicorp</p>
          <p className="mt-0.5">{formatarDataDiaClinicorp(consultaClinicorp.data, hoje || '')}{consultaClinicorp.horaInicio ? ` às ${consultaClinicorp.horaInicio}` : ''} · {consultaClinicorp.dentistaNome || 'Profissional não informado'}</p>
          <Button type="button" size="sm" variant="outline" className="mt-2 h-7 bg-white text-xs" onClick={() => {
            if (consultaClinicorp.dentistaNome) setDentista(consultaClinicorp.dentistaNome)
            setData(dataHoraInputClinicorp(consultaClinicorp.data, consultaClinicorp.horaInicio))
          }}>Preencher com Clinicorp</Button>
        </div>
      ) : null}
      <datalist id="dentistas-agendamento-recepcao">{(dentistas ?? []).map((nome) => <option key={nome} value={nome} />)}</datalist>
    </form></Modal>
}
