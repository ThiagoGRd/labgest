import { Badge, type BadgeProps } from '@/components/ui/badge'
import type { ItemCasoOrdem } from '@/components/producao/types'
import { etapaLabel, getProgresso, isEtapaId, isTipoProtese, FLUXOS_PROTESE } from '@/lib/workflow-config'
import { formatCurrency, formatDate } from '@/lib/date-utils'
import { rotuloLocalizacaoTrabalho } from '@/lib/recepcao-utils'

export interface FichaOrdem {
  status: string | null
  etapaAtual: string | null
  passoFluxoAtual: string | null
  dataEntrada: string | null
  dataEntrega: string | null
  dataFinalizacao: string | null
  dataEntregaReal: string | null
  prazoEtapaAtual: string | null
  prazoFornecedor: string | null
  movimentacaoLogisticaEm: string | null
  cobrancas: Array<{
    id: number
    valor: number
    valorRecebido: number
    status: string | null
    dataVencimento: string | null
    dataRecebimento: string | null
    canceladoEm: string | null
  }>
}

export interface OrdemResumo {
  id: number
  paciente: string
  cliente: { nome: string }
  servico: string
  status: string
  prioridade: string
  valor: number
  etapaAtual: string
  dataEntrada?: string
  dataEntrega: string
  tipoWorkflow?: string | null
  subetapaAtual?: string
  motivoPausa?: string | null
  localizacaoAtual?: string
  situacaoLogistica?: string
  dentistaResponsavel?: string | null
  finalidadeClinica?: string | null
  agendamentoClinico?: string | null
  arcadas?: number
  itensCaso?: ItemCasoOrdem[]
  ficha?: FichaOrdem
}

export function dataCivilFicha(valor?: string | null) {
  return valor && !Number.isNaN(Date.parse(valor)) ? formatDate(valor) : 'Não informado'
}

export function instanteFicha(valor?: string | null) {
  if (!valor || Number.isNaN(Date.parse(valor))) return 'Não informado'
  return new Date(valor).toLocaleString('pt-BR', {
    timeZone: 'America/Maceio', day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

function Campo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="min-w-0"><dt className="text-xs text-slate-500 dark:text-slate-400">{label}</dt><dd className="mt-1 break-words text-sm font-medium text-slate-900 dark:text-white">{children}</dd></div>
}

const STATUS: Record<string, BadgeProps['variant']> = {
  Aguardando: 'aguardando', 'Em Produção': 'emProducao', 'Em Prova': 'warning', Finalizado: 'finalizado', Entregue: 'success', Cancelado: 'destructive', Pausado: 'pausado',
}
const bloco = 'min-w-0 rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900 sm:p-5'
const titulo = 'mb-4 font-semibold text-slate-950 dark:text-white'

export function ResumoOrdem({ ordem }: { ordem: OrdemResumo }) {
  const ficha = ordem.ficha
  const status = ficha ? ficha.status : ordem.status
  const etapa = ficha ? ficha.etapaAtual : ordem.etapaAtual
  const tipo = isTipoProtese(ordem.tipoWorkflow) ? ordem.tipoWorkflow : null
  const passo = tipo ? FLUXOS_PROTESE[tipo].passos.find(passo => passo.id === ficha?.passoFluxoAtual) : undefined
  const etapaNome = etapa ? (isEtapaId(etapa) ? etapaLabel(etapa) : etapa) : 'Etapa não informada'
  const progresso = etapa && isEtapaId(etapa) && etapa !== 'entregue' ? getProgresso(null, etapa) : null
  const itensCaso = ordem.itensCaso ?? []

  return <>
    <section aria-label="Resumo da OS" className={bloco}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase text-slate-500 dark:text-slate-400 tabular-nums">Resumo da OS #{ordem.id}</p>
            {(ordem.arcadas && ordem.arcadas >= 2) ? (
              <Badge variant="default">Superior + Inferior</Badge>
            ) : null}
          </div>
          <h2 className="mt-1 break-words text-xl font-bold text-slate-950 dark:text-white">{ordem.paciente}</h2>
          <p className="mt-1 break-words text-sm text-slate-600 dark:text-slate-300">{ordem.servico}</p>
        </div>
        <Badge variant={STATUS[status || ''] || 'outline'}>{status || 'Status não informado'}</Badge>
      </div>
      <dl className="mt-4 grid gap-3 sm:grid-cols-2"><Campo label="Clínica / cliente">{ordem.cliente.nome}</Campo><Campo label="Prioridade">{ordem.prioridade || 'Não informada'}</Campo></dl>
    </section>

    {itensCaso.length > 0 && (
      <section aria-label="Serviços e arcadas incluídas nesta OS" className={bloco}>
        <div className="mb-3 flex items-center justify-between gap-2">
          <h3 className="font-semibold text-slate-950 dark:text-white">Serviços / Arcadas incluídas nesta OS</h3>
          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400 tabular-nums">{itensCaso.length} {itensCaso.length === 1 ? 'item' : 'itens'}</span>
        </div>
        <div className="divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-200 dark:border-slate-800">
          {itensCaso.map((item, idx) => (
            <div key={`${item.servicoId ?? idx}-${idx}`} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-sm">
              <div className="min-w-0">
                <p className="font-semibold text-slate-900 dark:text-white">{item.servicoNome}</p>
                <div className="mt-0.5 flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                  {item.arcada && <span className="font-semibold text-indigo-600 dark:text-indigo-400">{item.arcada}</span>}
                  {item.elementos && <span>Dentes: {item.elementos}</span>}
                  {item.corDentes && <span>Cor: {item.corDentes}</span>}
                  {item.material && <span>Material: {item.material}</span>}
                  {item.origemOrdemId && <span className="tabular-nums text-slate-400">Origem OS #{item.origemOrdemId}</span>}
                </div>
              </div>
              <span className="font-bold tabular-nums text-slate-900 dark:text-slate-100">{item.valor != null ? formatCurrency(item.valor) : '—'}</span>
            </div>
          ))}
        </div>
      </section>
    )}

    <div className="grid items-start gap-4 md:grid-cols-2">
      <section aria-labelledby="ficha-producao" className={bloco}>
        <h3 id="ficha-producao" className={titulo}>Etapa de produção</h3>
        <dl className="space-y-3">
          <Campo label="Macroetapa registrada">{etapaNome}</Campo>
          <Campo label="Fluxo da prótese">{tipo ? FLUXOS_PROTESE[tipo].nome : ordem.tipoWorkflow || 'Não informado'}</Campo>
          <Campo label="Passo detalhado">{passo?.nome || ficha?.passoFluxoAtual || 'Não informado'}</Campo>
          {ordem.subetapaAtual && <Campo label="Detalhe da etapa">{ordem.subetapaAtual}</Campo>}
          {status === 'Pausado' && <Campo label="Motivo da pausa">{ordem.motivoPausa || 'Não informado'}</Campo>}
        </dl>
        {progresso !== null && <div className="mt-4"><p className="mb-2 text-xs text-slate-500 dark:text-slate-400">Progresso das macroetapas · {progresso}%</p><div role="progressbar" aria-label="Progresso das macroetapas" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progresso} className="h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full bg-indigo-600" style={{ width: `${progresso}%` }} /></div></div>}
      </section>
      <section aria-labelledby="ficha-localizacao" className={bloco}>
        <h3 id="ficha-localizacao" className={titulo}>Localização física</h3>
        <dl className="space-y-3">
          <Campo label="Custódia / movimentação">{rotuloLocalizacaoTrabalho(ordem.situacaoLogistica, ordem.dentistaResponsavel, ordem.localizacaoAtual)}</Campo>
          <Campo label="Dentista responsável">{ordem.dentistaResponsavel || 'Não informado'}</Campo>
          <Campo label="Finalidade clínica">{ordem.finalidadeClinica || 'Não informada'}</Campo>
          <Campo label="Última movimentação registrada">{instanteFicha(ficha?.movimentacaoLogisticaEm)}</Campo>
        </dl>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Localização registrada no sistema; não é rastreamento em tempo real.</p>
      </section>
      <section aria-labelledby="ficha-prazos" className={bloco}>
        <h3 id="ficha-prazos" className={titulo}>Prazos e eventos</h3>
        <dl className="grid gap-4 sm:grid-cols-2">
          <Campo label="Entrada do pedido">{dataCivilFicha(ficha ? ficha.dataEntrada : ordem.dataEntrada)}</Campo>
          <Campo label="Previsão de entrega">{dataCivilFicha(ficha ? ficha.dataEntrega : ordem.dataEntrega)}</Campo>
          <Campo label="Prazo da etapa atual">{instanteFicha(ficha?.prazoEtapaAtual)}</Campo>
          <Campo label="Prazo do fornecedor">{instanteFicha(ficha?.prazoFornecedor)}</Campo>
          <Campo label="Conclusão da produção">{dataCivilFicha(ficha?.dataFinalizacao)}</Campo>
          <Campo label="Entrega física registrada">{instanteFicha(ficha?.dataEntregaReal)}</Campo>
          <Campo label="Agendamento clínico">{instanteFicha(ordem.agendamentoClinico)}</Campo>
        </dl>
        <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">Horários em Brasília. Vencimentos financeiros constam em cada cobrança ao lado.</p>
      </section>
      <section aria-labelledby="ficha-financeiro" className={bloco}>
        <h3 id="ficha-financeiro" className={titulo}>Situação financeira</h3>
        <dl><Campo label="Valor da OS">{Number.isFinite(ordem.valor) ? <span className="tabular-nums">{formatCurrency(ordem.valor)}</span> : 'Não informado'}</Campo></dl>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">Valor do serviço; não indica recebimento ou saldo.</p>
        {!ficha ? <p className="mt-4 text-sm text-slate-500">Informações de cobrança não carregadas.</p> : ficha.cobrancas.length === 0 ? <p className="mt-4 text-sm text-slate-500">Nenhuma cobrança vinculada à OS. Isso não indica quitação.</p> : <div className="mt-4 space-y-3">
          {ficha.cobrancas.map((conta) => {
            const cancelada = conta.status === 'Cancelado' || Boolean(conta.canceladoEm)
            return <article key={conta.id} aria-label={`Cobrança #${conta.id}`} className="rounded-xl border border-slate-200 p-3 dark:border-slate-700">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2"><h4 className="text-sm font-semibold">Cobrança #{conta.id}</h4><Badge variant={cancelada ? 'outline' : 'secondary'}>{cancelada ? 'Cobrança cancelada' : conta.status || 'Status não informado'}</Badge></div>
              <dl className="grid gap-3 sm:grid-cols-2">
                <Campo label="Valor da cobrança"><span className="tabular-nums">{formatCurrency(conta.valor)}</span></Campo><Campo label="Recebido registrado"><span className="tabular-nums">{formatCurrency(conta.valorRecebido)}</span></Campo>
                <Campo label="Vencimento financeiro">{dataCivilFicha(conta.dataVencimento)}</Campo><Campo label="Data de recebimento registrada">{dataCivilFicha(conta.dataRecebimento)}</Campo>
              </dl>
              {cancelada && <p className="mt-3 text-xs text-slate-500">Registro cancelado; não representa cobrança ativa.</p>}
            </article>
          })}
        </div>}
      </section>
    </div>
  </>
}
