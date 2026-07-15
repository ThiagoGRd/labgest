'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertTriangle, Building2, CheckCircle2, Clock3, Stethoscope } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { confirmarRecebimentoFornecedor, concluirEtapaLaboratorial, registrarEnvioFornecedor } from '@/actions/workflow-protese'
import { getFluxoProtese, type TipoProteseId } from '@/lib/workflow-config'

export interface OrdemFluxoProtese {
  id: number
  paciente: string
  dentista: string
  tipoWorkflow?: string | null
  passoFluxoAtual?: string | null
  arcadas?: number
  prazoEtapaAtual?: string | null
  fornecedorEstrutura?: string | null
  dataEnvioFornecedor?: string | null
  prazoFornecedor?: string | null
  cicloDentistaDeci?: string | null
  cicloStatus?: string | null
}

interface FluxoProteseBoardProps {
  tipo: TipoProteseId
  ordens: OrdemFluxoProtese[]
  onAbrirOrdem: (id: number) => void
}

function formatarPrazo(data?: string | null) {
  if (!data) return 'Sem prazo ativo'
  return new Date(data).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
}

export function FluxoProteseBoard({ tipo, ordens, onAbrirOrdem }: FluxoProteseBoardProps) {
  const router = useRouter()
  const fluxo = getFluxoProtese(tipo)
  const [fornecedores, setFornecedores] = useState<Record<number, string>>({})
  const [justificativas, setJustificativas] = useState<Record<number, string>>({})
  const [processando, setProcessando] = useState<number | null>(null)
  const [erros, setErros] = useState<Record<number, string>>({})
  const [agora] = useState(() => Date.now())
  const ordensSemPasso = ordens.filter((ordem) => !ordem.passoFluxoAtual)

  const executar = async (ordemId: number, acao: () => Promise<{ success: boolean; error?: string }>) => {
    setProcessando(ordemId)
    setErros((anterior) => ({ ...anterior, [ordemId]: '' }))
    const resultado = await acao()
    if (resultado.success) router.refresh()
    else setErros((anterior) => ({ ...anterior, [ordemId]: resultado.error || 'Não foi possível atualizar a ordem' }))
    setProcessando(null)
  }

  return (
    <div className="flex min-h-[calc(100vh-280px)] gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
      {ordensSemPasso.length > 0 && (
        <section className="w-80 shrink-0 snap-center">
          <header className="rounded-t-2xl border border-amber-200 bg-amber-50 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/20">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-wider text-amber-700 dark:text-amber-400">Ordens anteriores</p>
                <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">Etapa a definir</h3>
              </div>
              <Badge variant="secondary">{ordensSemPasso.length}</Badge>
            </div>
          </header>
          <div className="min-h-[540px] space-y-3 rounded-b-2xl border-x border-b border-amber-200 bg-amber-50/30 p-3 dark:border-amber-900/50 dark:bg-amber-950/10">
            <p className="rounded-lg bg-white/80 p-3 text-xs text-amber-800 dark:bg-zinc-900 dark:text-amber-300">Estas ordens continuam no Kanban geral até que a etapa específica seja definida.</p>
            {ordensSemPasso.map((ordem) => (
              <article key={ordem.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                <div className="flex items-start justify-between gap-2">
                  <button type="button" onClick={() => onAbrirOrdem(ordem.id)} className="min-w-0 truncate text-left text-sm font-bold text-slate-900 hover:text-indigo-600 dark:text-white">{ordem.paciente}</button>
                  <span className="shrink-0 font-mono text-[10px] text-slate-400">#{ordem.id}</span>
                </div>
                <p className="mt-1 truncate text-xs text-slate-500">{ordem.dentista}</p>
              </article>
            ))}
          </div>
        </section>
      )}
      {fluxo.passos.map((passo, indice) => {
        const ordensDoPasso = ordens.filter((ordem) => ordem.passoFluxoAtual === passo.id && !(ordem.cicloStatus === 'em_prova' && ordem.cicloDentistaDeci))
        const Icone = passo.responsavel === 'clinica' ? Stethoscope : passo.responsavel === 'fornecedor' ? Building2 : Clock3
        return (
          <section key={passo.id} className="w-80 shrink-0 snap-center">
            <header className={`rounded-t-2xl border px-4 py-3 ${passo.responsavel === 'clinica' ? 'border-sky-200 bg-sky-50 dark:border-sky-900/50 dark:bg-sky-950/20' : passo.responsavel === 'fornecedor' ? 'border-orange-200 bg-orange-50 dark:border-orange-900/50 dark:bg-orange-950/20' : 'border-violet-200 bg-violet-50 dark:border-violet-900/50 dark:bg-violet-950/20'}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{indice + 1}. {passo.responsavel}</p>
                  <h3 className="mt-1 text-sm font-bold text-slate-900 dark:text-white">{passo.nome}</h3>
                </div>
                <Badge variant="secondary">{ordensDoPasso.length}</Badge>
              </div>
            </header>

            <div className="min-h-[540px] space-y-3 rounded-b-2xl border-x border-b border-slate-200 bg-slate-50/60 p-3 dark:border-white/5 dark:bg-slate-900/20">
              {ordensDoPasso.map((ordem) => {
                const prazo = passo.responsavel === 'fornecedor' ? ordem.prazoFornecedor : ordem.prazoEtapaAtual
                const atrasado = Boolean(prazo && agora > new Date(prazo).getTime())
                return (
                  <article key={ordem.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
                    <div className="flex items-start justify-between gap-2">
                      <button type="button" onClick={() => onAbrirOrdem(ordem.id)} className="min-w-0 truncate text-left text-sm font-bold text-slate-900 hover:text-indigo-600 dark:text-white">{ordem.paciente}</button>
                      <span className="shrink-0 font-mono text-[10px] text-slate-400">#{ordem.id}</span>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">{ordem.dentista}</p>
                    <div className={`mt-3 flex items-center gap-1.5 text-xs font-semibold ${atrasado ? 'text-red-600' : 'text-slate-500'}`}>
                      {atrasado ? <AlertTriangle className="h-3.5 w-3.5" /> : <Icone className="h-3.5 w-3.5" />}
                      {atrasado ? `Atrasado desde ${formatarPrazo(prazo)}` : formatarPrazo(prazo)}
                    </div>
                    {ordem.arcadas === 2 && <p className="mt-1 text-[11px] font-medium text-indigo-600">Duas arcadas</p>}

                    {passo.responsavel === 'clinica' && <p className="mt-4 rounded-lg bg-sky-50 p-2 text-center text-xs font-semibold text-sky-700 dark:bg-sky-950/30 dark:text-sky-300">{passo.prova ? 'Aguardando resultado da prova no portal' : 'Aguardando a clínica concluir no portal'}</p>}

                    {passo.responsavel === 'laboratorio' && (
                      <Button type="button" className="mt-4 w-full bg-violet-600 text-white hover:bg-violet-700" disabled={processando === ordem.id} onClick={() => executar(ordem.id, () => concluirEtapaLaboratorial(ordem.id))}>
                        <CheckCircle2 className="h-4 w-4" /> {processando === ordem.id ? 'Atualizando...' : 'Concluir etapa'}
                      </Button>
                    )}

                    {passo.responsavel === 'fornecedor' && !ordem.dataEnvioFornecedor && (
                      <div className="mt-4 space-y-2">
                        <input value={fornecedores[ordem.id] || ''} onChange={(event) => setFornecedores((anterior) => ({ ...anterior, [ordem.id]: event.target.value }))} placeholder="Nome do fornecedor" className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm dark:border-zinc-700 dark:bg-zinc-800" />
                        <Button type="button" className="w-full bg-orange-600 text-white hover:bg-orange-700" disabled={processando === ordem.id || !fornecedores[ordem.id]?.trim()} onClick={() => executar(ordem.id, () => registrarEnvioFornecedor(ordem.id, fornecedores[ordem.id] || ''))}>Registrar envio — 15 dias</Button>
                      </div>
                    )}

                    {passo.responsavel === 'fornecedor' && ordem.dataEnvioFornecedor && (
                      <div className="mt-4 space-y-2">
                        <p className="text-xs text-slate-600 dark:text-slate-300">Fornecedor: <strong>{ordem.fornecedorEstrutura}</strong></p>
                        {atrasado && <textarea value={justificativas[ordem.id] || ''} onChange={(event) => setJustificativas((anterior) => ({ ...anterior, [ordem.id]: event.target.value }))} placeholder="Justificativa informada pelo fornecedor" rows={2} className="w-full resize-none rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm dark:border-red-900 dark:bg-red-950/20" />}
                        <Button type="button" className="w-full bg-emerald-600 text-white hover:bg-emerald-700" disabled={processando === ordem.id || (atrasado && !justificativas[ordem.id]?.trim())} onClick={() => executar(ordem.id, () => confirmarRecebimentoFornecedor(ordem.id, justificativas[ordem.id]))}>Confirmar recebimento</Button>
                      </div>
                    )}
                    {erros[ordem.id] && <p role="alert" className="mt-2 text-xs font-medium text-red-600">{erros[ordem.id]}</p>}
                  </article>
                )
              })}
              {ordensDoPasso.length === 0 && <p className="py-8 text-center text-xs text-slate-400">Nenhuma ordem nesta etapa</p>}
            </div>
          </section>
        )
      })}
    </div>
  )
}
