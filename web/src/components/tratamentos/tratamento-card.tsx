'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { CalendarDays, Check, ChevronDown, Link2, Stethoscope, UserX } from 'lucide-react'
import { diasEntre } from '@labgest/shared'
import type { ConsultaAnalisada, NivelAlerta, Responsavel, SituacaoConsulta } from '@labgest/shared'
import type { TratamentoPainel } from '@/lib/controle-tratamentos'
import { darCienciaAlertas, definirContagemConsulta, vincularPaciente } from '@/actions/tratamentos'
import { campoClasse } from '@/components/labs-externos/campos'
import { formatDate } from '@/lib/date-utils'
import { cn } from '@/lib/utils'

export const NIVEL: Record<NivelAlerta, { rotulo: string; selo: string; barra: string; borda: string }> = {
  critico: { rotulo: 'Crítico', selo: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', barra: 'bg-red-500', borda: 'border-l-red-500' },
  atencao: { rotulo: 'Atenção', selo: 'bg-amber-100 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300', barra: 'bg-amber-500', borda: 'border-l-amber-500' },
  ok: { rotulo: 'No previsto', selo: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300', barra: 'bg-emerald-500', borda: 'border-l-emerald-500' },
}

export const PARTE: Record<Responsavel, { rotulo: string; cor: string }> = {
  laboratorio: { rotulo: 'Laboratório', cor: 'bg-indigo-500' },
  clinica: { rotulo: 'Clínica', cor: 'bg-sky-400' },
  fornecedor: { rotulo: 'Fornecedor', cor: 'bg-slate-400' },
}

const SITUACAO: Record<SituacaoConsulta, { rotulo: string; classe: string }> = {
  realizada: { rotulo: 'Compareceu', classe: 'text-emerald-700 dark:text-emerald-300' },
  sem_confirmacao: { rotulo: 'Sem marcação no Clinicorp', classe: 'text-amber-700 dark:text-amber-300' },
  falta: { rotulo: 'Paciente faltou', classe: 'text-red-700 dark:text-red-300' },
  futura: { rotulo: 'Agendada', classe: 'text-sky-700 dark:text-sky-300' },
  fora: { rotulo: 'Não conta', classe: 'text-slate-400' },
}

const dias = (valor: number) => `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 0 })} ${Math.round(valor) === 1 ? 'dia' : 'dias'}`

function Medidor({ rotulo, valor, maximo, nivel, detalhe }: { rotulo: string; valor: number; maximo: number; nivel: NivelAlerta; detalhe: string }) {
  return (
    <div className="min-w-0">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-xs font-medium text-slate-500 dark:text-slate-400">{rotulo}</span>
        <span className="text-sm font-bold text-slate-900 dark:text-white">{valor.toLocaleString('pt-BR')}<span className="font-medium text-slate-400"> / {maximo}</span></span>
      </div>
      <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10" role="img" aria-label={`${rotulo}: ${valor} de ${maximo}`}>
        <div className={cn('h-full rounded-full', NIVEL[nivel].barra)} style={{ width: `${Math.min(100, (valor / Math.max(1, maximo)) * 100)}%` }} />
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{detalhe}</p>
    </div>
  )
}

export function BarraTempo({ tempo }: { tempo: { laboratorio: number; clinica: number; fornecedor: number } }) {
  const total = tempo.laboratorio + tempo.clinica + tempo.fornecedor
  const partes = (['laboratorio', 'clinica', 'fornecedor'] as const).filter((p) => tempo[p] > 0)
  if (total <= 0) return null
  return (
    <div>
      <div className="flex h-2.5 gap-0.5 overflow-hidden rounded-full">
        {partes.map((parte) => <div key={parte} className={PARTE[parte].cor} style={{ width: `${(tempo[parte] / total) * 100}%` }} />)}
      </div>
      <ul className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-600 dark:text-slate-300">
        {partes.map((parte) => (
          <li key={parte} className="flex items-center gap-1.5">
            <span className={cn('h-2 w-2 rounded-full', PARTE[parte].cor)} />
            {PARTE[parte].rotulo}: <strong className="font-semibold text-slate-900 dark:text-white">{dias(tempo[parte])}</strong>
          </li>
        ))}
      </ul>
    </div>
  )
}

function LinhaConsulta({ consulta, numero }: { consulta: ConsultaAnalisada; numero: number | null }) {
  const [pendente, iniciar] = useTransition()
  const conta = consulta.situacao !== 'fora'
  function alternar() {
    iniciar(async () => {
      const resultado = await definirContagemConsulta(consulta.id, !conta)
      if (!resultado.success) toast.error(resultado.error)
    })
  }
  return (
    <li className={cn('flex gap-3 py-2.5', !conta && 'opacity-60')}>
      <span className={cn('mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold',
        numero ? 'bg-slate-900 text-white dark:bg-white dark:text-slate-900' : 'bg-slate-100 text-slate-400 dark:bg-white/10')}>
        {numero ?? '–'}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-slate-900 dark:text-white">
          <span className="font-semibold">{formatDate(consulta.data)}</span>{consulta.hora ? ` às ${consulta.hora}` : ''}
          <span className={cn('ml-2 text-xs font-semibold', SITUACAO[consulta.situacao].classe)}>{SITUACAO[consulta.situacao].rotulo}</span>
        </p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {[consulta.dentista, consulta.categoria].filter(Boolean).join(' · ') || 'Sem profissional ou categoria informados'}
        </p>
        {consulta.observacoes && <p className="mt-1 whitespace-pre-line break-words rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 dark:bg-white/5 dark:text-slate-300">{consulta.observacoes}</p>}
      </div>
      <button type="button" onClick={alternar} disabled={pendente} className="shrink-0 self-start text-xs font-medium text-indigo-600 hover:underline disabled:opacity-50 dark:text-indigo-300">
        {conta ? 'Não contar' : 'Contar'}
      </button>
    </li>
  )
}

function Vinculo({ tratamento }: { tratamento: TratamentoPainel }) {
  const [nome, setNome] = useState(tratamento.vinculo ?? '')
  const [pendente, iniciar] = useTransition()
  function salvar(valor: string) {
    iniciar(async () => {
      const resultado = await vincularPaciente(tratamento.ordemId, valor)
      if (resultado.success) toast.success(resultado.mensagem ?? 'Salvo.')
      else toast.error(resultado.error)
    })
  }
  return (
    <div className="rounded-xl border border-dashed border-slate-300 p-3 dark:border-white/15">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 dark:text-slate-200"><Link2 className="h-3.5 w-3.5" /> Nome do paciente no Clinicorp</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
        As consultas são encontradas pelo nome. Se no Clinicorp o cadastro estiver diferente de “{tratamento.paciente}”, informe-o aqui.
      </p>
      {tratamento.sugestoes.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {tratamento.sugestoes.map((sugestao) => (
            <button key={sugestao} type="button" disabled={pendente} onClick={() => { setNome(sugestao); salvar(sugestao) }}
              className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-100 disabled:opacity-50 dark:bg-indigo-500/15 dark:text-indigo-200">
              Usar “{sugestao}”
            </button>
          ))}
        </div>
      )}
      <form className="mt-2 flex gap-2" onSubmit={(e) => { e.preventDefault(); salvar(nome) }}>
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Nome completo como está no Clinicorp" aria-label="Nome do paciente no Clinicorp" className={cn(campoClasse, 'py-2')} />
        <button type="submit" disabled={pendente} className="shrink-0 rounded-xl border border-slate-200 px-3 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-white/15 dark:text-slate-200 dark:hover:bg-white/10">Salvar</button>
      </form>
    </div>
  )
}

export function TratamentoCard({ tratamento, sincronizado, hoje }: { tratamento: TratamentoPainel; sincronizado: boolean; hoje: string }) {
  const [aberto, setAberto] = useState(false)
  const [pendente, iniciar] = useTransition()
  const t = tratamento
  const nivel = NIVEL[t.avaliacao.geral]
  const semCiencia = t.alertas.filter((a) => !a.cienteEm)
  const ciente = t.alertas.find((a) => a.cienteEm)
  const diasParado = diasEntre(t.tempo.desde, hoje)
  const contam = t.consultas.lista.filter((c) => c.situacao === 'realizada' || c.situacao === 'sem_confirmacao').map((c) => c.id)

  function darCiencia() {
    const nota = window.prompt('Registrar providência (opcional): o que foi combinado com o dentista ou o laboratório?') ?? undefined
    iniciar(async () => {
      const resultado = await darCienciaAlertas(t.ordemId, nota)
      if (!resultado.success) toast.error(resultado.error)
    })
  }

  return (
    <article className={cn('rounded-2xl border border-l-4 border-slate-200 bg-white shadow-sm dark:border-white/10 dark:bg-zinc-900', t.encerrado ? 'border-l-slate-300 dark:border-l-white/20' : nivel.borda)}>
      <div className="p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2">
          <div className="min-w-0">
            <h3 className="truncate text-base font-bold text-slate-900 dark:text-white">{t.paciente}</h3>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              {t.tipoNome} · OS #{t.ordemId} · {t.clinica}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {t.pausado && <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">Pausado</span>}
            {t.encerrado
              ? <span className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600 dark:bg-white/10 dark:text-slate-300">Encerrado em {t.dataFim ? formatDate(t.dataFim) : '—'}</span>
              : <span className={cn('rounded-lg px-2.5 py-1 text-xs font-bold', nivel.selo)}>{nivel.rotulo}</span>}
          </div>
        </div>

        {!t.encerrado && (
          <p className="mt-3 text-sm text-slate-700 dark:text-slate-200">
            Está com <strong className="font-semibold">{PARTE[t.tempo.comQuem].rotulo.toLowerCase()}</strong>
            {t.tempo.temRegistro && <> há <strong className="font-semibold">{dias(diasParado)}</strong></>}
            <span className="text-slate-500 dark:text-slate-400"> · etapa: {t.etapa}</span>
          </p>
        )}

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Medidor
            rotulo="Consultas"
            valor={t.consultas.realizadas}
            maximo={t.limite.consultasMax}
            nivel={t.avaliacao.consultas}
            detalhe={!sincronizado ? 'Aguardando sincronização com o Clinicorp'
              : `Previsto: ${t.consultasPrevistas}${t.consultas.faltas ? ` · ${t.consultas.faltas} falta(s) do paciente` : ''}${t.consultas.futuras ? ` · ${t.consultas.futuras} agendada(s)` : ''}`}
          />
          <Medidor
            rotulo={t.encerrado ? 'Duração total (dias)' : 'Dias em aberto'}
            valor={t.diasAberto}
            maximo={t.limite.diasMax}
            nivel={t.avaliacao.tempo}
            detalhe={`Pedido em ${formatDate(t.dataPedido)} · atenção a partir de ${t.limite.diasAtencao} dias`}
          />
        </div>

        <div className="mt-4">
          <p className="mb-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">Com quem o trabalho ficou</p>
          {t.tempo.temRegistro
            ? <BarraTempo tempo={t.tempo} />
            : <p className="text-xs text-slate-500 dark:text-slate-400">Sem movimentações registradas (envio à recepção / retorno ao laboratório) para dividir o tempo desta ordem.</p>}
        </div>

        {(t.provas > 0 || t.ajustes > 0) && (
          <p className="mt-3 text-xs text-slate-600 dark:text-slate-300">
            {t.provas} prova(s) enviada(s){t.ajustes > 0 && <> · <strong className="font-semibold text-amber-700 dark:text-amber-300">{t.ajustes} voltaram com pedido de ajuste</strong></>}
          </p>
        )}

        {semCiencia.length > 0 && (
          <div className="mt-4 flex flex-col gap-2 rounded-xl bg-red-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:bg-red-500/10">
            <ul className="space-y-0.5 text-sm text-red-800 dark:text-red-200">
              {semCiencia
                .filter((alerta) => !semCiencia.some((outro) => outro.tipo === alerta.tipo.replace('_atencao', '_critico') && outro.id !== alerta.id))
                .map((alerta) => <li key={alerta.id}>{alerta.mensagem}</li>)}
            </ul>
            <button type="button" onClick={darCiencia} disabled={pendente} className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-xl bg-white px-3 py-2 text-sm font-semibold text-red-700 shadow-sm hover:bg-red-100 disabled:opacity-50 dark:bg-white/10 dark:text-red-200">
              <Check className="h-4 w-4" /> Dar ciência
            </button>
          </div>
        )}
        {semCiencia.length === 0 && ciente && (
          <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
            Ciência de {ciente.cientePor ?? 'gestor'} em {formatDate(ciente.cienteEm as string)}{ciente.cienteNota ? ` — “${ciente.cienteNota}”` : ''}
          </p>
        )}

        <button type="button" onClick={() => setAberto(!aberto)} aria-expanded={aberto} className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-300">
          <ChevronDown className={cn('h-4 w-4 transition-transform', aberto && 'rotate-180')} />
          {aberto ? 'Ocultar consultas' : `Ver consultas (${t.consultas.lista.length})`}
        </button>
      </div>

      {aberto && (
        <div className="space-y-4 border-t border-slate-100 p-4 sm:p-5 dark:border-white/5">
          {t.consultas.lista.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <UserX className="h-4 w-4" /> Nenhuma consulta encontrada no Clinicorp para este paciente no período do tratamento.
            </p>
          ) : (
            <>
              {t.dentistas.length > 0 && (
                <p className="flex items-center gap-1.5 text-xs text-slate-600 dark:text-slate-300"><Stethoscope className="h-3.5 w-3.5" /> Atendido por: {t.dentistas.join(', ')}</p>
              )}
              <ul className="divide-y divide-slate-100 dark:divide-white/5">
                {t.consultas.lista.map((consulta) => {
                  const posicao = contam.indexOf(consulta.id)
                  return <LinhaConsulta key={consulta.id} consulta={consulta} numero={posicao >= 0 ? posicao + 1 : null} />
                })}
              </ul>
              <p className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
                <CalendarDays className="h-3.5 w-3.5" /> Contam as consultas em que o paciente compareceu e as passadas sem marcação de falta. Faltas e consultas de outras categorias ficam de fora.
              </p>
            </>
          )}
          <Vinculo tratamento={t} />
        </div>
      )}
    </article>
  )
}
