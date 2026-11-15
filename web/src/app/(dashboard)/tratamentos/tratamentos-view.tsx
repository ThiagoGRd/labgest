'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { AlertTriangle, ClipboardList, RefreshCw, Search, Settings2, X } from 'lucide-react'
import { getFluxoProtese, type LimiteTratamento, type Responsavel, type TipoProteseId, type TipoRiscoOperacional } from '@labgest/shared'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { EmptyState } from '@/components/ui/empty-state'
import { Modal } from '@/components/ui/modal'
import { campoClasse } from '@/components/labs-externos/campos'
import { BarraTempo, TratamentoCard } from '@/components/tratamentos/tratamento-card'
import { salvarLimite, sincronizarAgora } from '@/actions/tratamentos'
import type { PainelTratamentos, TratamentoPainel } from '@/lib/controle-tratamentos'
import { cn } from '@/lib/utils'

type Aba = 'acao' | 'andamento' | 'encerrados'
const PESO = { critico: 0, atencao: 1, ok: 2 } as const
const POR_PAGINA = 15
const cartao = 'rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-slate-900'

function Indicador({ rotulo, valor, tom, ajuda }: { rotulo: string; valor: number; tom?: 'critico' | 'atencao'; ajuda: string }) {
  const cor = valor === 0 ? 'text-slate-900 dark:text-white' : tom === 'critico' ? 'text-red-600 dark:text-red-400' : tom === 'atencao' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
  return (
    <div className={cartao}>
      <p className="text-sm text-slate-500 dark:text-slate-400">{rotulo}</p>
      <p className={cn('mt-1 text-3xl font-bold', cor)}>{valor.toLocaleString('pt-BR')}</p>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{ajuda}</p>
    </div>
  )
}

function LimitesModal({ painel, aberto, fechar }: { painel: PainelTratamentos; aberto: boolean; fechar: () => void }) {
  const [valores, setValores] = useState<Record<string, LimiteTratamento>>(() => Object.fromEntries(painel.limites.map((l) => [l.tipo, l.limite])))
  const [pendente, iniciar] = useTransition()

  useEffect(() => {
    if (aberto) {
      setValores(Object.fromEntries(painel.limites.map((l) => [l.tipo, l.limite])))
    }
  }, [aberto, painel.limites])

  const campos: Array<{ chave: keyof LimiteTratamento; rotulo: string }> = [
    { chave: 'consultasAtencao', rotulo: 'Consultas: atenção' },
    { chave: 'consultasMax', rotulo: 'Consultas: máximo' },
    { chave: 'diasAtencao', rotulo: 'Dias: atenção' },
    { chave: 'diasMax', rotulo: 'Dias: máximo' },
  ]
  function salvar(tipo: TipoProteseId) {
    iniciar(async () => {
      const resultado = await salvarLimite(tipo, valores[tipo])
      if (resultado.success) toast.success('Limite atualizado.')
      else toast.error(resultado.error)
    })
  }
  return (
    <Modal isOpen={aberto} onClose={fechar} title="Limites por tipo de prótese" description="Quando avisar o gestor" size="lg">
      <p className="mb-4 text-sm text-slate-600 dark:text-slate-300">
        O alerta de <strong>atenção</strong> nasce ao atingir o primeiro número e o <strong>crítico</strong> ao atingir o máximo. “Previsto” é o número de etapas clínicas do fluxo ideal.
      </p>
      <div className="space-y-4">
        {painel.limites.map((item) => (
          <form key={item.tipo} onSubmit={(e) => { e.preventDefault(); salvar(item.tipo) }} className="rounded-xl border border-slate-200 p-3 dark:border-white/10">
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{item.nome} <span className="font-normal text-slate-500">· previsto: {item.previstas} consultas</span></p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-5">
              {campos.map((campo) => (
                <label key={campo.chave} className="text-xs text-slate-500 dark:text-slate-400">
                  {campo.rotulo}
                  <input type="number" min={1} max={3650} required value={valores[item.tipo][campo.chave]}
                    onChange={(e) => setValores({ ...valores, [item.tipo]: { ...valores[item.tipo], [campo.chave]: Number(e.target.value) } })}
                    className={cn(campoClasse, 'mt-1 py-2')} />
                </label>
              ))}
              <button type="submit" disabled={pendente} className="col-span-2 self-end rounded-xl bg-indigo-600 py-2 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60 sm:col-span-1">Salvar</button>
            </div>
          </form>
        ))}
      </div>
    </Modal>
  )
}

function resumoPorDentista(tratamentos: TratamentoPainel[]) {
  const mapa = new Map<string, { consultas: number; tratamentos: Set<number>; acima: Set<number>; ajustes: Map<number, number> }>()
  for (const t of tratamentos) {
    for (const consulta of t.consultas.lista) {
      if (!consulta.dentista || (consulta.situacao !== 'realizada' && consulta.situacao !== 'sem_confirmacao')) continue
      const linha = mapa.get(consulta.dentista) ?? { consultas: 0, tratamentos: new Set(), acima: new Set(), ajustes: new Map() }
      linha.consultas += 1
      linha.tratamentos.add(t.ordemId)
      linha.ajustes.set(t.ordemId, t.ajustes)
      if (t.avaliacao.consultas !== 'ok') linha.acima.add(t.ordemId)
      mapa.set(consulta.dentista, linha)
    }
  }
  return [...mapa.entries()]
    .map(([nome, l]) => ({
      nome,
      consultas: l.consultas,
      tratamentos: l.tratamentos.size,
      acima: l.acima.size,
      ajustes: [...l.ajustes.values()].reduce((s, v) => s + v, 0),
      media: l.consultas / l.tratamentos.size,
    }))
    .sort((a, b) => b.acima - a.acima || b.ajustes - a.ajustes || b.media - a.media)
}

function resumoEficiencia(encerrados: TratamentoPainel[], limites: PainelTratamentos['limites']) {
  return limites.map((item) => {
    const grupo = encerrados.filter((t) => t.tipo === item.tipo)
    const qtd = grupo.length
    if (qtd === 0) {
      return { tipo: item.tipo, nome: item.nome, previstas: item.previstas, qtd: 0, mediaConsultas: null, mediaDias: null, pctAjuste: null }
    }
    const mediaConsultas = grupo.reduce((s, t) => s + t.consultas.realizadas, 0) / qtd
    const mediaDias = grupo.reduce((s, t) => s + t.diasAberto, 0) / qtd
    const comAjuste = grupo.filter((t) => t.ajustes > 0).length
    return {
      tipo: item.tipo,
      nome: item.nome,
      previstas: item.previstas,
      qtd,
      mediaConsultas,
      mediaDias,
      pctAjuste: Math.round((comAjuste / qtd) * 100),
    }
  })
}

function pesoOrdenacao(t: TratamentoPainel) {
  if (t.avaliacao.geral === 'critico' || t.riscos.some((r) => r.nivel === 'critico')) return 0
  if (t.avaliacao.geral === 'atencao' || t.riscos.length > 0) return 1
  return 2
}

export function TratamentosView({ painel }: { painel: PainelTratamentos }) {
  const [aba, setAba] = useState<Aba>('acao')
  const [busca, setBusca] = useState('')
  const [tipo, setTipo] = useState('')
  const [clinicaFiltro, setClinicaFiltro] = useState('')
  const [responsavelFiltro, setResponsavelFiltro] = useState<'' | Responsavel>('')
  const [dentistaFiltro, setDentistaFiltro] = useState('')
  const [riscoFiltro, setRiscoFiltro] = useState<'' | TipoRiscoOperacional>('')
  const [limite, setLimite] = useState(POR_PAGINA)
  const [limitesAbertos, setLimitesAbertos] = useState(false)
  const [sincronizando, iniciarSincronizacao] = useTransition()

  const ativos = useMemo(() => painel.tratamentos.filter((t) => !t.encerrado), [painel.tratamentos])
  const encerrados = useMemo(() => painel.tratamentos.filter((t) => t.encerrado), [painel.tratamentos])
  const comAcao = useMemo(() => ativos.filter((t) => !t.pausado && (t.avaliacao.geral !== 'ok' || t.riscos.length > 0)), [ativos])
  const criticos = ativos.filter((t) => !t.pausado && (t.avaliacao.geral === 'critico' || t.riscos.some((r) => r.nivel === 'critico'))).length
  const atencao = ativos.filter((t) => !t.pausado && t.avaliacao.geral !== 'critico' && !t.riscos.some((r) => r.nivel === 'critico') && (t.avaliacao.geral === 'atencao' || t.riscos.length > 0)).length
  const semCiencia = ativos.filter((t) => t.alertas.some((a) => !a.cienteEm)).length
  const sincronizado = Boolean(painel.ultimaSincronizacao?.sucesso)

  const clinicas = useMemo(() => [...new Set(painel.tratamentos.map((t) => t.clinica).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pt-BR')), [painel.tratamentos])

  const contagemRiscos = useMemo(() => {
    const baseRiscos = ativos.filter((t) => !t.pausado)
    return {
      consulta_sem_peca: baseRiscos.filter((t) => t.riscos.some((r) => r.tipo === 'consulta_sem_peca')).length,
      peca_sem_agenda: baseRiscos.filter((t) => t.riscos.some((r) => r.tipo === 'peca_sem_agenda')).length,
      faltas_recorrentes: baseRiscos.filter((t) => t.riscos.some((r) => r.tipo === 'faltas_recorrentes')).length,
    }
  }, [ativos])

  const lista = useMemo(() => {
    const base = aba === 'acao' ? comAcao : aba === 'andamento' ? ativos : encerrados
    const termo = busca.trim().toLowerCase()
    return base
      .filter((t) => !tipo || t.tipo === tipo)
      .filter((t) => !clinicaFiltro || t.clinica === clinicaFiltro)
      .filter((t) => !responsavelFiltro || t.tempo.comQuem === responsavelFiltro)
      .filter((t) => !dentistaFiltro || t.dentistas.includes(dentistaFiltro) || t.dentistaOrdem === dentistaFiltro)
      .filter((t) => !riscoFiltro || t.riscos.some((r) => r.tipo === riscoFiltro))
      .filter((t) => !termo || t.paciente.toLowerCase().includes(termo) || t.clinica.toLowerCase().includes(termo) || String(t.ordemId) === termo.replace('#', '') || t.dentistas.some((d) => d.toLowerCase().includes(termo)) || (t.dentistaOrdem ?? '').toLowerCase().includes(termo))
      .sort((a, b) => pesoOrdenacao(a) - pesoOrdenacao(b) || PESO[a.avaliacao.geral] - PESO[b.avaliacao.geral] || b.diasAberto - a.diasAberto)
  }, [aba, comAcao, ativos, encerrados, busca, tipo, clinicaFiltro, responsavelFiltro, dentistaFiltro, riscoFiltro])

  const tempoTotal = useMemo(() => {
    const comRegistro = painel.tratamentos.filter((t) => t.tempo.temRegistro)
    return {
      quantidade: comRegistro.length,
      laboratorio: comRegistro.reduce((s, t) => s + t.tempo.laboratorio, 0),
      clinica: comRegistro.reduce((s, t) => s + t.tempo.clinica, 0),
      fornecedor: comRegistro.reduce((s, t) => s + t.tempo.fornecedor, 0),
    }
  }, [painel.tratamentos])
  const dentistas = useMemo(() => resumoPorDentista(painel.tratamentos), [painel.tratamentos])
  const eficiencia = useMemo(() => resumoEficiencia(encerrados, painel.limites), [encerrados, painel.limites])
  const ajustes = painel.tratamentos.reduce((s, t) => s + t.ajustes, 0)
  const provas = painel.tratamentos.reduce((s, t) => s + t.provas, 0)

  function sincronizar() {
    iniciarSincronizacao(async () => {
      const resultado = await sincronizarAgora()
      if (resultado.success) toast.success(resultado.mensagem ?? 'Sincronizado.')
      else toast.error(resultado.error)
    })
  }

  const abas: Array<{ id: Aba; rotulo: string; total: number }> = [
    { id: 'acao', rotulo: 'Precisam de ação', total: comAcao.length },
    { id: 'andamento', rotulo: 'Em andamento', total: ativos.length },
    { id: 'encerrados', rotulo: 'Encerrados (180 dias)', total: encerrados.length },
  ]

  return (
    <DashboardLayout>
      <Header title="Controle de tratamentos" subtitle="Consultas e tempo por prótese" />

      <main className="space-y-6 p-4 sm:p-6">
        {(!painel.clinicorpConfigurado || !sincronizado) && (
          <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <p className="font-semibold">
                {!painel.clinicorpConfigurado ? 'Clinicorp ainda não conectado' : painel.ultimaSincronizacao ? 'A última sincronização com o Clinicorp falhou' : 'Agenda do Clinicorp ainda não sincronizada'}
              </p>
              <p className="mt-0.5">
                {!painel.clinicorpConfigurado
                  ? 'Os prazos já são acompanhados, mas a contagem de consultas depende das credenciais do Clinicorp (CLINICORP_URL, CLINICORP_SUBSCRIBER e CLINICORP_AUTH) no ambiente do LabGest.'
                  : painel.ultimaSincronizacao?.erro ?? 'Use “Sincronizar agora” para buscar as consultas dos pacientes em tratamento.'}
              </p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <Indicador rotulo="Em andamento" valor={ativos.length} ajuda="Protocolos, totais e parciais abertos" />
          <Indicador rotulo="Críticos" valor={criticos} tom="critico" ajuda="Atingiram o máximo de consultas ou de dias" />
          <Indicador rotulo="Em atenção" valor={atencao} tom="atencao" ajuda="Passaram do previsto; ainda dá tempo de agir" />
          <Indicador rotulo="Alertas sem ciência" valor={semCiencia} tom="critico" ajuda="Tratamentos aguardando providência do gestor" />
        </div>

        <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
          <section aria-label="Tratamentos" className="min-w-0 space-y-4">
            <div className={cn(cartao, 'p-4')}>
              <div className="flex flex-wrap gap-2" role="tablist">
                {abas.map((item) => (
                  <button key={item.id} type="button" role="tab" aria-selected={aba === item.id} onClick={() => { setAba(item.id); setLimite(POR_PAGINA) }}
                    className={cn('rounded-xl px-3.5 py-2 text-sm font-semibold transition-colors',
                      aba === item.id ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-white/10')}>
                    {item.rotulo} <span className="ml-1 font-medium opacity-70">{item.total}</span>
                  </button>
                ))}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
                <div className="relative sm:col-span-2">
                  <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={busca} onChange={(e) => { setBusca(e.target.value); setLimite(POR_PAGINA) }} placeholder="Buscar por paciente, clínica, dentista ou nº da ordem" aria-label="Buscar tratamentos" className={cn(campoClasse, 'pl-10')} />
                </div>
                <select aria-label="Filtrar por tipo de prótese" value={tipo} onChange={(e) => { setTipo(e.target.value); setLimite(POR_PAGINA) }} className={campoClasse}>
                  <option value="">Todos os tipos</option>
                  {painel.limites.map((l) => <option key={l.tipo} value={l.tipo}>{l.nome}</option>)}
                </select>
                <select aria-label="Filtrar por responsável atual" value={responsavelFiltro} onChange={(e) => { setResponsavelFiltro(e.target.value as '' | Responsavel); setLimite(POR_PAGINA) }} className={campoClasse}>
                  <option value="">Com qualquer setor</option>
                  <option value="clinica">Com a clínica</option>
                  <option value="laboratorio">No laboratório</option>
                  <option value="fornecedor">No fornecedor</option>
                </select>
              </div>
              {(clinicas.length > 1 || contagemRiscos.consulta_sem_peca > 0 || contagemRiscos.peca_sem_agenda > 0 || contagemRiscos.faltas_recorrentes > 0 || dentistaFiltro || riscoFiltro) && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2">
                  {clinicas.length > 1 && (
                    <select aria-label="Filtrar por clínica" value={clinicaFiltro} onChange={(e) => { setClinicaFiltro(e.target.value); setLimite(POR_PAGINA) }} className={cn(campoClasse, 'w-auto py-1.5 text-xs')}>
                      <option value="">Todas as clínicas</option>
                      {clinicas.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  )}
                  {([
                    { id: 'consulta_sem_peca', rotulo: 'Consulta ≤48h sem peça', total: contagemRiscos.consulta_sem_peca, tom: 'critico' },
                    { id: 'peca_sem_agenda', rotulo: 'Na clínica sem agenda', total: contagemRiscos.peca_sem_agenda, tom: 'atencao' },
                    { id: 'faltas_recorrentes', rotulo: '2+ faltas', total: contagemRiscos.faltas_recorrentes, tom: 'atencao' },
                  ] as const)
                    .filter((chip) => chip.total > 0 || riscoFiltro === chip.id)
                    .map((chip) => {
                      const ativo = riscoFiltro === chip.id
                      return (
                        <button
                          key={chip.id}
                          type="button"
                          onClick={() => { setRiscoFiltro(ativo ? '' : chip.id); setLimite(POR_PAGINA) }}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
                            ativo
                              ? 'border-indigo-600 bg-indigo-600 text-white'
                              : chip.tom === 'critico'
                                ? 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
                                : 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300',
                          )}
                        >
                          <span>{chip.rotulo}</span>
                          <span className="opacity-80">{chip.total}</span>
                        </button>
                      )
                    })}
                  {dentistaFiltro && (
                    <button
                      type="button"
                      onClick={() => { setDentistaFiltro(''); setLimite(POR_PAGINA) }}
                      className="inline-flex items-center gap-1 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 dark:border-indigo-500/30 dark:bg-indigo-500/15 dark:text-indigo-200"
                    >
                      <span>Dentista: {dentistaFiltro}</span>
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              )}
            </div>

            {lista.length === 0 ? (
              <EmptyState variant="card" icon={ClipboardList}
                title={aba === 'acao' && !busca && !tipo && !clinicaFiltro && !responsavelFiltro && !dentistaFiltro && !riscoFiltro ? 'Nenhum tratamento fora do previsto' : 'Nenhum tratamento encontrado'}
                description={aba === 'acao' && !busca && !tipo && !clinicaFiltro && !responsavelFiltro && !dentistaFiltro && !riscoFiltro ? 'Quando uma prótese passar do número de consultas ou do prazo, ela aparece aqui.' : 'Tente outro filtro ou limpe a seleção atual.'} />
            ) : (
              <>
                <div className="space-y-3">
                  {lista.slice(0, limite).map((t) => <TratamentoCard key={t.ordemId} tratamento={t} sincronizado={sincronizado} hoje={painel.hoje} />)}
                </div>
                {lista.length > limite && (
                  <button type="button" onClick={() => setLimite(limite + POR_PAGINA)} className="w-full rounded-xl border border-slate-200 bg-white py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:bg-transparent dark:text-slate-200 dark:hover:bg-white/10">
                    Mostrar mais ({lista.length - limite} restantes)
                  </button>
                )}
              </>
            )}
          </section>

          <aside className="space-y-6">
            <section className={cartao} aria-label="Sincronização com o Clinicorp">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Clinicorp</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                {painel.ultimaSincronizacao
                  ? `Última sincronização: ${new Date(painel.ultimaSincronizacao.em).toLocaleString('pt-BR', { timeZone: 'America/Maceio', dateStyle: 'short', timeStyle: 'short' })} · ${painel.ultimaSincronizacao.consultas} consultas`
                  : 'Nunca sincronizado'}
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={sincronizar} disabled={sincronizando || !painel.clinicorpConfigurado}
                  className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60">
                  <RefreshCw className={cn('h-4 w-4', sincronizando && 'animate-spin')} /> {sincronizando ? 'Sincronizando…' : 'Sincronizar agora'}
                </button>
                <button type="button" onClick={() => setLimitesAbertos(true)} title="Limites por tipo de prótese" aria-label="Limites por tipo de prótese"
                  className="rounded-xl border border-slate-200 px-3 text-slate-700 hover:bg-slate-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">
                  <Settings2 className="h-4 w-4" />
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">A agenda também é lida automaticamente uma vez por dia.</p>
            </section>

            <section className={cartao} aria-label="Onde o tempo foi gasto">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Onde o tempo foi gasto</h2>
              <p className="mt-0.5 mb-3 text-xs text-slate-500 dark:text-slate-400">
                Soma dos dias em {tempoTotal.quantidade} tratamento(s) com movimentações registradas
              </p>
              {tempoTotal.quantidade > 0
                ? <BarraTempo tempo={tempoTotal} />
                : <p className="text-sm text-slate-500 dark:text-slate-400">Ainda não há movimentações registradas para comparar.</p>}
              {provas > 0 && (
                <p className="mt-3 border-t border-slate-100 pt-3 text-xs text-slate-600 dark:border-white/5 dark:text-slate-300">
                  {ajustes} de {provas} provas voltaram da clínica com pedido de ajuste.
                </p>
              )}
            </section>

            <section className={cartao} aria-label="Consultas por dentista">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Por dentista</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Clique no profissional para filtrar os casos</p>
              {dentistas.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Sem consultas sincronizadas com profissional identificado.</p>
              ) : (
                <table className="mt-3 w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-500 dark:text-slate-400">
                      <th className="pb-1.5 font-medium">Profissional</th>
                      <th className="pb-1.5 text-right font-medium" title="Média de consultas por tratamento">Média</th>
                      <th className="pb-1.5 text-right font-medium" title="Total de ciclos devolvidos para ajuste">Ajust.</th>
                      <th className="pb-1.5 text-right font-medium" title="Tratamentos acima do previsto / tratamentos atendidos">Acima</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {dentistas.map((d) => {
                      const selecionado = dentistaFiltro === d.nome
                      return (
                        <tr key={d.nome}>
                          <td className="max-w-0 py-1.5 pr-2">
                            <button
                              type="button"
                              onClick={() => { setDentistaFiltro(selecionado ? '' : d.nome); setLimite(POR_PAGINA) }}
                              className={cn(
                                'w-full truncate text-left font-medium hover:underline',
                                selecionado ? 'text-indigo-600 dark:text-indigo-300' : 'text-slate-900 dark:text-white',
                              )}
                              title={d.nome}
                            >
                              {d.nome}
                            </button>
                          </td>
                          <td className="py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200">{d.media.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}</td>
                          <td className={cn('py-1.5 text-right tabular-nums', d.ajustes > 0 ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-slate-400')}>{d.ajustes}</td>
                          <td className={cn('py-1.5 text-right tabular-nums font-semibold', d.acima > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-400')}>{d.acima}/{d.tratamentos}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </section>

            <section className={cartao} aria-label="Eficiência nos últimos 180 dias">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Eficiência (180 dias)</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Média real dos casos encerrados vs. fluxo previsto</p>
              {encerrados.length === 0 ? (
                <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">Sem tratamentos encerrados nos últimos 180 dias.</p>
              ) : (
                <table className="mt-3 w-full text-xs">
                  <thead>
                    <tr className="text-left text-slate-500 dark:text-slate-400">
                      <th className="pb-1.5 font-medium">Prótese</th>
                      <th className="pb-1.5 text-right font-medium" title="Previsto / Média real de consultas">Cons.</th>
                      <th className="pb-1.5 text-right font-medium" title="Duração média em dias">Dias</th>
                      <th className="pb-1.5 text-right font-medium" title="Percentual que teve pedido de ajuste">Ajuste</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {eficiencia.map((e) => (
                      <tr key={e.tipo}>
                        <td className="max-w-0 truncate py-1.5 pr-2 font-medium text-slate-900 dark:text-white" title={`${e.nome} (${e.qtd})`}>
                          {getFluxoProtese(e.tipo).nomeCurto}
                        </td>
                        <td className={cn(
                          'py-1.5 text-right tabular-nums',
                          e.mediaConsultas !== null && e.mediaConsultas > e.previstas ? 'font-semibold text-amber-600 dark:text-amber-400' : 'text-slate-700 dark:text-slate-200',
                        )}>
                          {e.mediaConsultas === null ? '—' : `${e.mediaConsultas.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} / ${e.previstas}`}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                          {e.mediaDias === null ? '—' : `${Math.round(e.mediaDias)}d`}
                        </td>
                        <td className="py-1.5 text-right tabular-nums text-slate-700 dark:text-slate-200">
                          {e.pctAjuste === null ? '—' : `${e.pctAjuste}%`}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          </aside>
        </div>
      </main>

      <LimitesModal painel={painel} aberto={limitesAbertos} fechar={() => setLimitesAbertos(false)} />
    </DashboardLayout>
  )
}
