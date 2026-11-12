'use client'

import { movimentarRecepcaoExterna, registrarEntregaExternaRecepcao } from '@/actions/recepcao-externa'
import { chaveRecepcao, type MovimentoExterno } from '@/lib/recepcao-externa'
import { filtrarOrigem, type FiltroOrigem } from '@/lib/recepcao-filtros'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import {
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  MapPin,
  PackageCheck,
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
  type FinalidadeClinica,
  type OrdemRecepcao,
  type SituacaoLogistica,
} from '@/actions/recepcao'

interface RecepcaoViewProps {
  externosDisponiveis: boolean
  itens: OrdemRecepcao[]
  dentistas: string[]
  emitidoEm: string
  usuario: { nome: string; email: string; tipo: string }
}

type Filtro = 'todos' | 'receber' | 'recepcao' | 'dentista' | 'retorno' | 'laboratorio'

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

function pertenceFiltro(item: OrdemRecepcao, filtro: Filtro) {
  if (filtro === 'receber') return ['aguardando_recepcao', 'conferir_recebimento'].includes(item.situacao)
  if (filtro === 'recepcao') return ['aguardando_distribuicao', 'aguardando_resultado_dentista', 'aguardando_envio_laboratorio'].includes(item.situacao)
  if (filtro === 'dentista') return item.situacao === 'com_dentista'
  if (filtro === 'retorno') return item.situacao === 'em_transito_laboratorio'
  if (filtro === 'laboratorio') return item.situacao === 'no_laboratorio'
  return true
}

function formatarData(valor: string | null, comHora = false) {
  if (!valor) return 'Não informado'
  return new Date(valor).toLocaleString('pt-BR', comHora
    ? { timeZone: 'America/Maceio', dateStyle: 'short', timeStyle: 'short' }
    : { timeZone: 'UTC', dateStyle: 'short' })
}

function paraDataHoraLocal(valor: string | null) {
  if (!valor) return ''
  const data = new Date(valor)
  return new Date(data.getTime() - data.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

function horasParado(item: OrdemRecepcao, emitidoEm: string) {
  if (!item.movimentadoEm) return 0
  return Math.max(0, (new Date(emitidoEm).getTime() - new Date(item.movimentadoEm).getTime()) / 3_600_000)
}

export function RecepcaoView({ itens, dentistas, emitidoEm, usuario, externosDisponiveis }: RecepcaoViewProps) {
  const router = useRouter()
  const [origem, setOrigem] = useState<FiltroOrigem>('todos')
  const [filtro, setFiltro] = useState<Filtro>('todos')
  const [busca, setBusca] = useState('')
  const [distribuindo, setDistribuindo] = useState<OrdemRecepcao | null>(null)
  const [isPending, startTransition] = useTransition()
  const recepcaoSomente = usuario.tipo === 'recepcao'
  const termo = busca.trim().toLocaleLowerCase('pt-BR')
  const itensOrigem = filtrarOrigem(itens, origem)
  const origens: Array<{ id: FiltroOrigem; label: string; quantidade: number }> = [
    { id: 'todos', label: 'Todos', quantidade: itens.length },
    { id: 'interno', label: 'Lab interno', quantidade: filtrarOrigem(itens, 'interno').length },
    { id: 'externo', label: 'Labs externos', quantidade: filtrarOrigem(itens, 'externo').length },
  ]
  const filtrados = itensOrigem.filter((item) => pertenceFiltro(item, filtro) && (!termo || [item.paciente, item.clinica, item.servico, item.dentista, String(item.id)].some((valor) => valor.toLocaleLowerCase('pt-BR').includes(termo))))
  const parados = itensOrigem.filter((item) => ['aguardando_recepcao', 'aguardando_distribuicao'].includes(item.situacao) && horasParado(item, emitidoEm) >= 24).length

  const filtros: Array<{ id: Filtro; label: string; quantidade: number }> = [
    { id: 'todos', label: 'Todos', quantidade: itensOrigem.length },
    { id: 'receber', label: 'Receber', quantidade: itensOrigem.filter((item) => pertenceFiltro(item, 'receber')).length },
    { id: 'recepcao', label: 'Na recepção', quantidade: itensOrigem.filter((item) => pertenceFiltro(item, 'recepcao')).length },
    { id: 'dentista', label: 'Com dentista', quantidade: itensOrigem.filter((item) => pertenceFiltro(item, 'dentista')).length },
    { id: 'retorno', label: 'Retorno ao lab', quantidade: itensOrigem.filter((item) => pertenceFiltro(item, 'retorno')).length },
    { id: 'laboratorio', label: 'No laboratório', quantidade: itensOrigem.filter((item) => pertenceFiltro(item, 'laboratorio')).length },
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

  return (
    <DashboardLayout user={{ nome: usuario.nome, email: usuario.email, tipo: usuario.tipo }}>
      <Header title="Recepção e distribuição" subtitle="Custódia dos trabalhos entre laboratório, recepção e dentistas" />
      <main className="mx-auto max-w-[1500px] space-y-5 p-1 sm:p-6">
        {!externosDisponiveis ? <p role="alert" className="rounded-xl bg-amber-50 p-3 text-sm text-amber-900">Fluxo dos laboratórios externos indisponível ou ainda não ativado. Esta lista mostra somente os trabalhos internos.</p> : null}
        <section aria-label="Origem dos trabalhos" className="rounded-2xl border bg-white p-3 shadow-sm dark:border-white/10 dark:bg-zinc-900 sm:p-4">
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
          <Resumo icon={PackageCheck} label="Receber ou conferir" valor={itensOrigem.filter((item) => pertenceFiltro(item, 'receber')).length} tone="blue" />
          <Resumo icon={MapPin} label="Na recepção" valor={itensOrigem.filter((item) => pertenceFiltro(item, 'recepcao')).length} tone="amber" />
          <Resumo icon={Stethoscope} label="Com dentistas" valor={itensOrigem.filter((item) => item.situacao === 'com_dentista').length} tone="violet" />
          <Resumo icon={Clock3} label="Parados há mais de 24h" valor={parados} tone={parados ? 'red' : 'slate'} />
        </section>

        <section className="rounded-2xl border bg-white p-3 shadow-sm dark:border-white/10 dark:bg-zinc-900 sm:p-4">
          <div className="flex gap-2 overflow-x-auto pb-3" role="tablist" aria-label="Filtrar movimentações da recepção">
            {filtros.map((item) => (
              <button key={item.id} type="button" role="tab" aria-selected={filtro === item.id} onClick={() => setFiltro(item.id)} className={`whitespace-nowrap rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${filtro === item.id ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-white/5 dark:text-slate-300'}`}>
                {item.label} <span className="ml-1 opacity-70">{item.quantidade}</span>
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input value={busca} onChange={(event) => setBusca(event.target.value)} placeholder="Buscar paciente, dentista, clínica, serviço ou OS" className="pl-9" aria-label="Buscar trabalhos na recepção" />
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
                emitidoEm={emitidoEm}
                recepcaoSomente={recepcaoSomente}
                disabled={isPending}
                onDistribuir={() => setDistribuindo(item)}
                onExecutar={executar}
              />
            ))}
          </section>
        )}
      </main>

      {distribuindo ? (
        <DistribuirModal
          item={distribuindo}
          dentistas={dentistas}
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

function Resumo({ icon: Icon, label, valor, tone }: { icon: typeof PackageCheck; label: string; valor: number; tone: string }) {
  const cores: Record<string, string> = { blue: 'text-blue-600 bg-blue-50', amber: 'text-amber-700 bg-amber-50', violet: 'text-violet-600 bg-violet-50', red: 'text-red-600 bg-red-50', slate: 'text-slate-600 bg-slate-50' }
  return <div className="flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900"><div className={`rounded-xl p-2.5 ${cores[tone]}`}><Icon className="h-5 w-5" /></div><div><p className="text-2xl font-bold">{valor}</p><p className="text-xs font-semibold text-slate-500">{label}</p></div></div>
}

function TrabalhoCard({ item, emitidoEm, recepcaoSomente, disabled, onDistribuir, onExecutar }: {
  item: OrdemRecepcao
  emitidoEm: string
  recepcaoSomente: boolean
  disabled: boolean
  onDistribuir: () => void
  onExecutar: (acao: () => Promise<{ success: boolean; error?: string }>, sucesso: string) => void
}) {
  const config = SITUACOES[item.situacao]
  const horas = horasParado(item, emitidoEm)
  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm dark:border-white/10 dark:bg-zinc-900 ${horas >= 24 && ['aguardando_recepcao', 'aguardando_distribuicao'].includes(item.situacao) ? 'border-red-300 dark:border-red-800' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0"><p className="text-xs font-bold text-indigo-600">{item.origem === 'externo' ? 'Externo' : 'Interno · OS'} #{item.id}</p><h2 className="break-words text-lg font-bold">{item.paciente}</h2><p className="whitespace-pre-wrap break-words text-sm text-slate-500">{item.servico} · {item.clinica}</p></div>
        <Badge className={config.tone}>{config.label}</Badge>
      </div>
      <div className="mt-4 grid gap-2 rounded-xl bg-slate-50 p-3 text-xs dark:bg-white/5 sm:grid-cols-2">
        <p><span className="font-semibold text-slate-500">Etapa:</span> {item.etapa}</p>
        <p><span className="font-semibold text-slate-500">Finalidade:</span> {item.finalidade ? FINALIDADES[item.finalidade] : 'A definir na distribuição'}</p>
        <p><span className="font-semibold text-slate-500">Dentista:</span> {item.dentista || 'Ainda não definido'}</p>
        <p><span className="font-semibold text-slate-500">Agendamento:</span> {formatarData(item.agendamento, true)}</p>
        <p><span className="font-semibold text-slate-500">Entrega prevista:</span> {formatarData(item.entregaPrevista)}</p>
        <p className={horas >= 24 ? 'font-semibold text-red-600' : ''}><span className="font-semibold text-slate-500">Nesta situação:</span> {item.movimentadoEm ? `${Math.floor(horas)}h` : 'Histórico anterior'}</p>
      </div>
      {item.situacao === 'aguardando_resultado_dentista' ? <p className="mt-3 rounded-lg bg-red-50 p-2 text-xs font-semibold text-red-700">O trabalho voltou fisicamente, mas o dentista ainda precisa registrar no portal se foi aprovado ou se precisa de ajuste.</p> : null}
      {item.decisaoDentista ? <p className={`mt-3 rounded-lg p-2 text-xs font-semibold ${item.decisaoDentista === 'aprovado' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-800'}`}>{item.decisaoDentista === 'aprovado' ? 'Prova aprovada pelo dentista' : `Ajuste solicitado: ${item.observacaoDentista || 'sem observação'}`}</p> : null}
      {item.origem === 'externo' ? <AcoesExternas item={item} disabled={disabled} onDistribuir={onDistribuir} onExecutar={onExecutar} /> :
      <div className="mt-4 flex flex-wrap justify-end gap-2">
        {item.situacao === 'no_laboratorio' && !recepcaoSomente ? <Button size="sm" onClick={() => onExecutar(() => enviarParaRecepcao(item.id), 'Envio para a recepção registrado.')} disabled={disabled}><Send className="h-4 w-4" />Enviar à recepção</Button> : null}
        {['aguardando_recepcao', 'no_laboratorio'].includes(item.situacao) ? <Button size="sm" onClick={() => onExecutar(() => confirmarRecebimentoRecepcao(item.id), 'Recebimento confirmado.')} disabled={disabled}><PackageCheck className="h-4 w-4" />Confirmar recebimento</Button> : null}
        {item.situacao === 'aguardando_distribuicao' ? <Button size="sm" onClick={onDistribuir} disabled={disabled}><UserRoundCheck className="h-4 w-4" />Entregar ao dentista</Button> : null}
        {item.situacao === 'com_dentista' ? <><Button size="sm" variant="outline" onClick={onDistribuir} disabled={disabled}><RefreshCw className="h-4 w-4" />Corrigir</Button><Button size="sm" onClick={() => onExecutar(() => receberDoDentista(item.id), 'Devolução do dentista registrada.')} disabled={disabled}><Undo2 className="h-4 w-4" />Receber do dentista</Button></> : null}
        {item.situacao === 'aguardando_resultado_dentista' ? <Button size="sm" variant="outline" onClick={() => onExecutar(() => enviarRetornoLaboratorio(item.id), 'Retorno enviado ao laboratório.')} disabled={disabled}><RefreshCw className="h-4 w-4" />Verificar resposta</Button> : null}
        {item.situacao === 'aguardando_envio_laboratorio' ? <Button size="sm" onClick={() => onExecutar(() => enviarRetornoLaboratorio(item.id), 'Retorno enviado ao laboratório.')} disabled={disabled}><Send className="h-4 w-4" />Enviar ao laboratório</Button> : null}
        {item.situacao === 'em_transito_laboratorio' && !recepcaoSomente ? <Button size="sm" onClick={() => onExecutar(() => confirmarRecebimentoLaboratorio(item.id), 'Recebimento no laboratório confirmado.')} disabled={disabled}><Building2 className="h-4 w-4" />Confirmar no laboratório</Button> : null}
      </div>}
      {(item.origem === 'externo'
        ? ['conferir_recebimento', 'aguardando_distribuicao', 'em_transito_laboratorio']
        : ['aguardando_recepcao', 'aguardando_distribuicao']).includes(item.situacao) ? (
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
  const [agendamento, setAgendamento] = useState(paraDataHoraLocal(item.agendamento))
  const [observacao, setObservacao] = useState('')
  return (
    <Modal isOpen onClose={onClose} title={corrigindo ? 'Corrigir distribuição' : 'Entregar ao dentista'} description={`${item.origem === 'externo' ? 'Externo' : 'OS'} #${item.id} · ${item.paciente}`} size="md" mobileFullscreen dismissible={!disabled}>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); onConfirm({ dentista, finalidade, agendamento: agendamento ? new Date(agendamento).toISOString() : undefined, observacao: observacao || undefined }) }}>
        <div><label htmlFor="dentista-recepcao" className="mb-1 block text-sm font-semibold">Dentista responsável *</label><Input id="dentista-recepcao" list="dentistas-recepcao" value={dentista} onChange={(event) => setDentista(event.target.value)} placeholder="Nome do dentista" required maxLength={255} /><datalist id="dentistas-recepcao">{dentistas.map((nome) => <option key={nome} value={nome} />)}</datalist></div>
        <div><label htmlFor="finalidade-recepcao" className="mb-1 block text-sm font-semibold">Finalidade *</label><select id="finalidade-recepcao" value={finalidade} onChange={(event) => setFinalidade(event.target.value as FinalidadeClinica)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"><option value="prova">Prova clínica</option><option value="instalacao">Instalação</option><option value="entrega">Entrega ao paciente</option></select></div>
        {item.origem === 'interno' ? <div><label htmlFor="agendamento-recepcao" className="mb-1 block text-sm font-semibold">Agendamento</label><Input id="agendamento-recepcao" type="datetime-local" value={agendamento} onChange={(event) => setAgendamento(event.target.value)} /><p className="mt-1 text-xs text-slate-500">Pode ser preenchido manualmente enquanto a agenda do Clinicorp não estiver sincronizada.</p></div> : null}
        {corrigindo ? <div><label htmlFor="motivo-correcao" className="mb-1 block text-sm font-semibold">Motivo da correção *</label><textarea id="motivo-correcao" value={observacao} onChange={(event) => setObservacao(event.target.value)} required rows={3} maxLength={500} className="w-full resize-none rounded-md border border-input bg-background px-3 py-2 text-sm" placeholder="Explique por que a distribuição está sendo alterada." /></div> : null}
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
      {['aguardando_distribuicao', 'com_dentista'].includes(item.situacao) ? <Button disabled={disabled} onClick={onDistribuir}>{item.situacao === 'com_dentista' ? 'Corrigir distribuição' : 'Entregar ao dentista'}</Button> : null}
      {item.situacao === 'com_dentista' ? <Button disabled={disabled} onClick={() => onExecutar(() => executarExterno(item, { acao: 'receber_retorno' }), 'Retorno físico do dentista registrado.')}>Receber do dentista</Button> : null}
      {item.situacao === 'aguardando_envio_laboratorio' ? <Button disabled={disabled} onClick={() => onExecutar(() => executarExterno(item, { acao: 'enviar_retorno' }), 'Envio físico ao laboratório externo registrado.')}>Enviar ao laboratório externo</Button> : null}
    </div>
  </div>
}
