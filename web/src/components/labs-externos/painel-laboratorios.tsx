'use client'

import { useMemo } from 'react'
import { Building2 } from 'lucide-react'
import type { LabExternoPedido } from '@/actions/labs-externos'
import { JANELA_ANALISE_DIAS, hojeIso, resumirLaboratorio } from '@/lib/labs-externos-utils'

const numero = (v: number) => v.toLocaleString('pt-BR')
const dias = (v: number) => `${numero(v)} ${v === 1 ? 'dia' : 'dias'}`

function Linha({ rotulo, valor, tom, ajuda }: { rotulo: string; valor: string; tom?: 'alerta' | 'atencao'; ajuda?: string }) {
  const cor = tom === 'alerta' ? 'text-red-600 dark:text-red-400' : tom === 'atencao' ? 'text-amber-600 dark:text-amber-400' : 'text-slate-900 dark:text-white'
  return (
    <div className="flex items-baseline justify-between gap-3 py-2">
      <div className="min-w-0">
        <dt className="text-sm text-slate-600 dark:text-slate-300">{rotulo}</dt>
        {ajuda && <dd className="text-xs text-slate-400 dark:text-slate-500">{ajuda}</dd>}
      </div>
      <span className={`shrink-0 text-sm font-bold ${cor}`}>{valor}</span>
    </div>
  )
}

// Coluna lateral: como cada laboratório parceiro está entregando.
export function PainelLaboratorios({ pedidos }: { pedidos: LabExternoPedido[] }) {
  const hoje = hojeIso()
  const laboratorios = useMemo(() => {
    const grupos = new Map<string, { nome: string; pedidos: LabExternoPedido[] }>()
    for (const pedido of pedidos) {
      const chave = String(pedido.labId ?? pedido.labNome)
      const grupo = grupos.get(chave) ?? { nome: pedido.labNome, pedidos: [] }
      grupo.pedidos.push(pedido)
      grupos.set(chave, grupo)
    }
    return Array.from(grupos.values())
      .map((g) => ({ nome: g.nome, resumo: resumirLaboratorio(g.pedidos, hoje) }))
      .sort((a, b) => b.resumo.emAberto - a.resumo.emAberto)
  }, [pedidos, hoje])

  return (
    <section aria-label="Desempenho dos laboratórios" className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-white/10 dark:bg-zinc-900">
      <h2 className="text-base font-bold text-slate-900 dark:text-white">Desempenho dos laboratórios</h2>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Pedidos enviados nos últimos {JANELA_ANALISE_DIAS} dias</p>

      {laboratorios.length === 0 ? (
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">Os indicadores aparecem assim que o primeiro pedido for cadastrado.</p>
      ) : (
        <div className="mt-4 space-y-5">
          {laboratorios.map(({ nome, resumo }) => (
            <article key={nome}>
              <header className="flex items-center gap-2.5">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-300"><Building2 className="h-4 w-4" /></span>
                <h3 className="truncate text-sm font-bold text-slate-900 dark:text-white">{nome}</h3>
              </header>
              <dl className="mt-2 divide-y divide-slate-100 dark:divide-white/5">
                <Linha rotulo="Em aberto" valor={numero(resumo.emAberto)} ajuda={resumo.atrasados > 0 ? `${numero(resumo.atrasados)} com prazo vencido` : 'Nenhum com prazo vencido'} tom={resumo.atrasados > 0 ? 'alerta' : undefined} />
                <Linha rotulo="Retrabalho" valor={resumo.taxaRetrabalho === null ? '—' : `${numero(resumo.taxaRetrabalho)}%`} ajuda={resumo.totalPedidos > 0 ? `${numero(resumo.retrabalhos)} de ${numero(resumo.totalPedidos)} pedidos` : 'Sem pedidos no período'} tom={resumo.taxaRetrabalho !== null && resumo.taxaRetrabalho >= 10 ? 'atencao' : undefined} />
                <Linha rotulo="Prazo combinado" valor={resumo.prazoCombinadoMedio === null ? '—' : dias(resumo.prazoCombinadoMedio)} ajuda="Média entre envio e prazo" />
                <Linha rotulo="Retorno real" valor={resumo.retornoMedio === null ? '—' : dias(resumo.retornoMedio)} ajuda={resumo.taxaNoPrazo === null ? 'Medido quando a peça é marcada como pronta' : `${numero(resumo.taxaNoPrazo)}% voltaram dentro do prazo`} tom={resumo.taxaNoPrazo !== null && resumo.taxaNoPrazo < 70 ? 'atencao' : undefined} />
              </dl>
            </article>
          ))}
        </div>
      )}
    </section>
  )
}
