'use client'

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  Award,
  Boxes,
  CheckCircle2,
  Flame,
  Loader2,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { toast } from 'sonner'
import { aplicarReajusteServico } from '@/actions/financeiro'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { formatCurrency } from '@/lib/date-utils'
import type {
  AlertaInsumoFinanceiro,
  AnaliseReajusteServico,
  RentabilidadeCliente,
} from '@/lib/inteligencia-financeira'

interface PainelInteligenciaFinanceiraProps {
  reajusteServicos: AnaliseReajusteServico[]
  rentabilidadeClientes: RentabilidadeCliente[]
  reposicaoEstoque: {
    alertas: AlertaInsumoFinanceiro[]
    custoTotalReposicao: number
    valorTotalEmEstoque: number
  }
}

export function PainelInteligenciaFinanceira({
  reajusteServicos,
  rentabilidadeClientes,
  reposicaoEstoque,
}: PainelInteligenciaFinanceiraProps) {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [reajustandoId, setReajustandoId] = useState<number | null>(null)

  const servicosDefasados = reajusteServicos.filter((s) => s.statusMargem !== 'saudavel')
  const perdaTotalRetrabalho = rentabilidadeClientes.reduce((acc, c) => acc + c.custoRetrabalhoEstimado, 0)

  function handleAplicarReajuste(item: AnaliseReajusteServico) {
    if (item.precoSugerido <= item.precoAtual) return
    setReajustandoId(item.servicoId)
    startTransition(async () => {
      const res = await aplicarReajusteServico(item.servicoId, item.precoSugerido)
      setReajustandoId(null)
      if (res.success) {
        toast.success(`Tabela atualizada: ${item.servicoNome} reajustado para ${formatCurrency(item.precoSugerido)}!`)
        router.refresh()
      } else {
        toast.error(res.error || 'Erro ao aplicar reajuste.')
      }
    })
  }

  return (
    <div className="space-y-6">
      {/* KPIs Executivos */}
      <section aria-label="Indicadores de inteligência financeira" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              <TrendingUp className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Termômetro de Tabela</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {servicosDefasados.length} serviço{servicosDefasados.length === 1 ? '' : 's'}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Com margem abaixo da meta pelo custo vivo de insumos + retrabalho
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <Flame className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Custo Oculto de Retrabalho</p>
            <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
              {formatCurrency(perdaTotalRetrabalho)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Consumido em repetições de prova e ajustes clínicos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300">
              <Boxes className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Capital em Estoque</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(reposicaoEstoque.valorTotalEmEstoque)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Valorizado pelo custo médio ponderado das entradas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
              <AlertTriangle className="h-5 w-5" />
            </div>
            <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Reposição Crítica de Insumos</p>
            <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">
              {formatCurrency(reposicaoEstoque.custoTotalReposicao)}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {reposicaoEstoque.alertas.length} insumo(s) em nível mínimo ou vencendo
            </p>
          </CardContent>
        </Card>
      </section>

      {/* Termômetro de Reajuste de Tabela */}
      <Card>
        <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-indigo-600" />
              Termômetro de Reajuste de Preços (Custo Vivo de Estoque + Retrabalho)
            </h2>
            <p className="text-xs text-slate-500">
              Compara o preço atual de cada prótese com o custo atualizado dos insumos e a taxa real de ajustes na bancada (meta: 65% de margem líquida).
            </p>
          </div>
          <Link href="/servicos" className="text-xs font-bold text-indigo-600 hover:underline">
            Gerenciar ficha técnica →
          </Link>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">Serviço / Prótese</th>
                  <th className="px-5 py-3 text-right">Preço Atual</th>
                  <th className="px-5 py-3 text-right">Custo Insumos + Retrabalho</th>
                  <th className="px-5 py-3 text-center">Margem Real</th>
                  <th className="px-5 py-3 text-right">Preço Sugerido</th>
                  <th className="px-5 py-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody>
                {reajusteServicos.map((srv) => (
                  <tr key={srv.servicoId} className="border-b border-slate-100 last:border-0 dark:border-white/5">
                    <td className="px-5 py-3">
                      <p className="font-semibold text-slate-900 dark:text-white">{srv.servicoNome}</p>
                      <p className="text-xs text-slate-500">{srv.recomendacao}</p>
                    </td>
                    <td className="px-5 py-3 text-right font-semibold">
                      {formatCurrency(srv.precoAtual)}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <p className="font-medium text-slate-800 dark:text-slate-200">{formatCurrency(srv.custoTotalReal)}</p>
                      <p className="text-[11px] text-slate-400">
                        Insumo: {formatCurrency(srv.custoInsumosAoVivo)} • Retrab ({srv.taxaRetrabalhoPercentual}%): +{formatCurrency(srv.custoRetrabalhoMedio)}
                      </p>
                    </td>
                    <td className="px-5 py-3 text-center">
                      <Badge
                        variant={
                          srv.statusMargem === 'saudavel'
                            ? 'success'
                            : srv.statusMargem === 'atencao'
                              ? 'warning'
                              : 'destructive'
                        }
                      >
                        {srv.margemRealPercentual}%
                      </Badge>
                    </td>
                    <td className="px-5 py-3 text-right">
                      <p className="font-bold text-indigo-600 dark:text-indigo-300">
                        {formatCurrency(srv.precoSugerido)}
                      </p>
                      {srv.reajusteSugeridoPercentual > 0 && (
                        <span className="text-[11px] font-bold text-amber-600">
                          +{srv.reajusteSugeridoPercentual}% sugerido
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3 text-right">
                      {srv.precoSugerido > srv.precoAtual ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isPending && reajustandoId === srv.servicoId}
                          onClick={() => handleAplicarReajuste(srv)}
                        >
                          {isPending && reajustandoId === srv.servicoId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <TrendingUp className="h-3.5 w-3.5 mr-1 text-indigo-600" />
                          )}
                          Reajustar
                        </Button>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Em dia
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Ranking de Rentabilidade Real por Dentista / Clínica */}
      <Card>
        <CardHeader>
          <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Award className="h-4 w-4 text-emerald-600" />
            Ranking de Rentabilidade Real por Dentista / Clínica
          </h2>
          <p className="text-xs text-slate-500">
            Mostra quem realmente dá lucro líquido para o laboratório após descontar insumos, repetições de prova/retrabalho e inadimplência.
          </p>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-[10px] uppercase tracking-wider text-slate-400">
                  <th className="px-5 py-3">Dentista / Clínica</th>
                  <th className="px-5 py-3 text-center">Casos / Ajustes</th>
                  <th className="px-5 py-3 text-right">Faturamento Bruto</th>
                  <th className="px-5 py-3 text-right">Perda c/ Retrabalho</th>
                  <th className="px-5 py-3 text-right">Lucro Líquido Real</th>
                  <th className="px-5 py-3">Diagnóstico do CEO</th>
                </tr>
              </thead>
              <tbody>
                {rentabilidadeClientes.slice(0, 12).map((cli) => (
                  <tr key={cli.clienteNome} className="border-b border-slate-100 last:border-0 dark:border-white/5">
                    <td className="px-5 py-3 font-semibold text-slate-900 dark:text-white">
                      {cli.clienteNome}
                    </td>
                    <td className="px-5 py-3 text-center">
                      <span className="font-semibold">{cli.totalOrdens}</span> OS •{' '}
                      <span className={cli.taxaRetrabalhoPercentual >= 35 ? 'font-bold text-red-600' : 'text-slate-500'}>
                        {cli.totalAjustesRetorno} ajuste(s) ({cli.taxaRetrabalhoPercentual}%)
                      </span>
                    </td>
                    <td className="px-5 py-3 text-right font-medium">
                      {formatCurrency(cli.receitaBruta)}
                    </td>
                    <td className="px-5 py-3 text-right text-red-600 font-medium">
                      {cli.custoRetrabalhoEstimado > 0 ? `- ${formatCurrency(cli.custoRetrabalhoEstimado)}` : 'R$ 0,00'}
                    </td>
                    <td className="px-5 py-3 text-right">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400">
                        {formatCurrency(cli.lucroLiquidoReal)}
                      </span>
                      <span className="ml-1.5 text-xs text-slate-500">({cli.margemRealPercentual}%)</span>
                    </td>
                    <td className="px-5 py-3">
                      <Badge
                        variant={
                          cli.classificacao === 'estrela'
                            ? 'success'
                            : cli.classificacao === 'atencao_retrabalho'
                              ? 'warning'
                              : cli.classificacao === 'risco_inadimplencia'
                                ? 'destructive'
                                : 'secondary'
                        }
                      >
                        {cli.classificacao === 'estrela'
                          ? '⭐ Alta Rentabilidade'
                          : cli.classificacao === 'atencao_retrabalho'
                            ? '⚠️ Retrabalho Alto'
                            : cli.classificacao === 'risco_inadimplencia'
                              ? '🚨 Inadimplência'
                              : 'Regular'}
                      </Badge>
                      <p className="mt-1 text-xs text-slate-500">{cli.insightGestor}</p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Controle de Insumos e Previsão de Compra */}
      {reposicaoEstoque.alertas.length > 0 && (
        <Card>
          <CardHeader className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Boxes className="h-4 w-4 text-amber-600" />
                Previsão Financeira de Compra de Insumos (Estoque Crítico)
              </h2>
              <p className="text-xs text-slate-500">
                Insumos que atingiram o estoque mínimo ou vencem nos próximos 30 dias.
              </p>
            </div>
            <Link href="/estoque" className="text-xs font-bold text-indigo-600 hover:underline">
              Ir para Estoque →
            </Link>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {reposicaoEstoque.alertas.slice(0, 6).map((al) => (
              <div key={al.estoqueId} className="rounded-xl border border-amber-200/80 bg-amber-50/40 p-3.5 dark:border-amber-500/20 dark:bg-amber-950/10">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-slate-900 dark:text-white">{al.nome}</p>
                    <p className="text-xs text-slate-500">
                      Saldo: <strong>{al.quantidadeAtual} {al.unidade}</strong> (Mín: {al.quantidadeMinima})
                    </p>
                  </div>
                  <Badge variant={al.motivo === 'estoque_baixo' ? 'destructive' : 'warning'}>
                    {al.motivo === 'estoque_baixo' ? 'Estoque Baixo' : 'Vencendo'}
                  </Badge>
                </div>
                <div className="mt-3 flex items-center justify-between border-t border-amber-200/50 pt-2 text-xs">
                  <span className="text-slate-600 dark:text-slate-400">
                    Comprar sugerido: <strong>{al.quantidadeSugeridaCompra} {al.unidade}</strong>
                  </span>
                  <strong className="text-amber-900 dark:text-amber-300">
                    {formatCurrency(al.custoReposicaoEstimado)}
                  </strong>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
