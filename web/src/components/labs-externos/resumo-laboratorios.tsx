'use client'

import { useMemo } from 'react'
import { Building2 } from 'lucide-react'
import type { LabExternoPedido } from '@/actions/labs-externos'
import { JANELA_ANALISE_DIAS, hojeIso, resumirLaboratorio } from '@/lib/labs-externos-utils'

interface ResumoLaboratoriosProps {
  pedidos: LabExternoPedido[]
}

const formatarNumero = (valor: number) => valor.toLocaleString('pt-BR')
const formatarDias = (valor: number) => `${formatarNumero(valor)} ${valor === 1 ? 'dia' : 'dias'}`

function Indicador({ titulo, valor, detalhe, destaque }: {
  titulo: string
  valor: string
  detalhe: string
  destaque?: 'alerta' | 'atencao'
}) {
  const cor = destaque === 'alerta'
    ? 'text-red-600 dark:text-red-400'
    : destaque === 'atencao'
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-slate-900 dark:text-white'
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500 dark:text-gray-400">{titulo}</p>
      <p className={`mt-1 text-2xl font-bold ${cor}`}>{valor}</p>
      <p className="mt-0.5 text-xs text-slate-500 dark:text-gray-400">{detalhe}</p>
    </div>
  )
}

// Visão de gestão: como cada laboratório está se saindo, em linguagem simples.
export function ResumoLaboratorios({ pedidos }: ResumoLaboratoriosProps) {
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
      .map((grupo) => ({ nome: grupo.nome, resumo: resumirLaboratorio(grupo.pedidos, hoje) }))
      .sort((a, b) => b.resumo.emAberto - a.resumo.emAberto)
  }, [pedidos, hoje])

  if (laboratorios.length === 0) return null

  return (
    <section aria-label="Desempenho dos laboratórios" className="space-y-3">
      <div>
        <h2 className="text-sm font-bold text-slate-900 dark:text-white">Desempenho dos laboratórios</h2>
        <p className="text-xs text-slate-500 dark:text-gray-400">Pedidos enviados nos últimos {JANELA_ANALISE_DIAS} dias</p>
      </div>
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-2">
        {laboratorios.map(({ nome, resumo }) => (
          <article key={nome} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-white/10 dark:bg-white/5">
            <header className="mb-4 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-500 dark:text-blue-400" />
              <h3 className="font-semibold text-slate-900 dark:text-white">{nome}</h3>
            </header>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Indicador
                titulo="Em aberto"
                valor={formatarNumero(resumo.emAberto)}
                detalhe={resumo.atrasados > 0 ? `${formatarNumero(resumo.atrasados)} com prazo vencido` : 'Nenhum com prazo vencido'}
                destaque={resumo.atrasados > 0 ? 'alerta' : undefined}
              />
              <Indicador
                titulo="Retrabalho"
                valor={resumo.taxaRetrabalho === null ? '—' : `${formatarNumero(resumo.taxaRetrabalho)}%`}
                detalhe={resumo.totalPedidos > 0 ? `${formatarNumero(resumo.retrabalhos)} de ${formatarNumero(resumo.totalPedidos)} pedidos` : 'Sem pedidos no período'}
                destaque={resumo.taxaRetrabalho !== null && resumo.taxaRetrabalho >= 10 ? 'atencao' : undefined}
              />
              <Indicador
                titulo="Prazo combinado"
                valor={resumo.prazoCombinadoMedio === null ? '—' : formatarDias(resumo.prazoCombinadoMedio)}
                detalhe="Média entre envio e prazo"
              />
              <Indicador
                titulo="Retorno real"
                valor={resumo.retornoMedio === null ? '—' : formatarDias(resumo.retornoMedio)}
                detalhe={resumo.taxaNoPrazo === null
                  ? 'Medido quando a peça é marcada como Pronta'
                  : `${formatarNumero(resumo.taxaNoPrazo)}% voltaram dentro do prazo`}
                destaque={resumo.taxaNoPrazo !== null && resumo.taxaNoPrazo < 70 ? 'atencao' : undefined}
              />
            </div>
          </article>
        ))}
      </div>
    </section>
  )
}
