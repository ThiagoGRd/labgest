'use client'

import { useRef, useState, useTransition } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useReactToPrint } from 'react-to-print'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { gerarRelatorioIA } from '@/actions/relatorios'
import { RelatorioOrdensEntregues, type RelatorioOrdensEntreguesData } from '@/components/relatorios/relatorio-ordens-entregues'
import {
  CalendarDays,
  FileText,
  Sparkles,
  Send,
  Loader2,
  Lightbulb,
  Printer,
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
} from 'recharts'

interface RelatorioData {
  analiseGeral: string
  tendencias: string[]
  sugestoesAcao: string[]
  alertaRisco: string | null
}

interface FinancialData {
  grafico: { mes: string; receita: number; despesa: number; lucro: number }[]
  topClientes: { nome: string; total: number; qtd: number; ticket: number }[]
}

interface Message {
  role: 'user' | 'assistant'
  content?: string
  data?: RelatorioData
}

interface TooltipPayloadEntry {
  color?: string
  name?: string
  value?: number | string
}

interface CustomTooltipProps {
  active?: boolean
  payload?: ReadonlyArray<TooltipPayloadEntry>
  label?: string
}

interface RelatoriosViewProps {
  financeiro: FinancialData
  ordensEntregues: RelatorioOrdensEntreguesData
}

export function RelatoriosView({ financeiro, ordensEntregues }: RelatoriosViewProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const relatorioRef = useRef<HTMLDivElement>(null)
  const [isChangingMonth, startMonthTransition] = useTransition()
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const imprimirOrdensEntregues = useReactToPrint({
    contentRef: relatorioRef,
    documentTitle: `ordens-entregues-${ordensEntregues.mes}`,
  })

  const selecionarMes = (mes: string) => {
    if (!mes) return
    const params = new URLSearchParams(searchParams.toString())
    params.set('mes', mes)
    startMonthTransition(() => router.push(`${pathname}?${params.toString()}`))
  }

  const handleSend = async (query?: string) => {
    const messageText = query || input
    if (!messageText.trim()) return

    const userMessage: Message = { role: 'user', content: messageText }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const data = await gerarRelatorioIA(messageText)
      setMessages(prev => [...prev, { role: 'assistant', data: data }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao gerar análise.' }])
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const CustomTooltip = ({ active, payload, label }: CustomTooltipProps) => {
    if (active && payload && payload.length) {
      return (
        <div className="glass p-4 border border-black/5 dark:border-white/10 rounded-xl shadow-xl">
          <p className="font-bold text-slate-900 dark:text-white mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-500 dark:text-slate-400 font-medium">{entry.name}:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {formatCurrency(Number(entry.value))}
              </span>
            </div>
          ))}
        </div>
      )
    }
    return null
  }

  return (
    <DashboardLayout>
      <Header title="Relatórios & Inteligência" subtitle="Análise financeira e operacional" />
      
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-120px)] max-w-[1600px] mx-auto">
        
        {/* Coluna 1 e 2: Dashboards Visuais */}
        <div className="lg:col-span-2 space-y-8 overflow-y-auto pr-2 custom-scrollbar">
          <Card className="overflow-hidden border-indigo-200/70 dark:border-indigo-500/20">
            <CardHeader className="border-b border-black/5 pb-5 dark:border-white/5">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2 text-xl">
                    <FileText className="h-5 w-5 text-indigo-600" />
                    Ordens entregues por mês
                  </CardTitle>
                  <p className="mt-1 text-sm text-slate-500">Relatório operacional com conferência do lançamento financeiro.</p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <label className="relative">
                    <span className="sr-only">Mês das entregas</span>
                    <CalendarDays className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <Input
                      type="month"
                      value={ordensEntregues.mes}
                      onChange={(event) => selecionarMes(event.target.value)}
                      className="w-full pl-9 sm:w-44"
                    />
                  </label>
                  <Button
                    onClick={() => imprimirOrdensEntregues()}
                    disabled={isChangingMonth}
                  >
                    {isChangingMonth ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
                    {isChangingMonth ? 'Carregando...' : 'Gerar relatório'}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="grid gap-3 pt-5 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl bg-indigo-50 p-4 dark:bg-indigo-500/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-indigo-600 dark:text-indigo-300">Entregas</p>
                <p className="mt-1 text-2xl font-bold">{ordensEntregues.totalOrdens}</p><p className="text-xs text-slate-500">{formatCurrency(ordensEntregues.valorTotal)}</p>
              </div>
              <div className="rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Recebidas</p>
                <p className="mt-1 text-2xl font-bold">{ordensEntregues.resumoFinanceiro.recebidas.quantidade}</p><p className="text-xs text-slate-500">{formatCurrency(ordensEntregues.resumoFinanceiro.recebidas.valor)}</p>
              </div>
              <div className="rounded-xl bg-amber-50 p-4 dark:bg-amber-500/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">Pendentes</p>
                <p className="mt-1 text-2xl font-bold">{ordensEntregues.resumoFinanceiro.pendentes.quantidade}</p><p className="text-xs text-slate-500">{formatCurrency(ordensEntregues.resumoFinanceiro.pendentes.valor)}</p>
              </div>
              <div className="rounded-xl bg-red-50 p-4 dark:bg-red-500/10">
                <p className="text-xs font-semibold uppercase tracking-wide text-red-700 dark:text-red-300">Vencidas</p>
                <p className="mt-1 text-2xl font-bold">{ordensEntregues.resumoFinanceiro.vencidas.quantidade}</p><p className="text-xs text-slate-500">{formatCurrency(ordensEntregues.resumoFinanceiro.vencidas.valor)}</p>
              </div>
            </CardContent>
          </Card>
          
          {/* Gráfico Principal */}
          <Card className="overflow-hidden">
            <CardHeader className="border-b border-black/5 dark:border-white/5 pb-6">
              <CardTitle className="text-xl">Fluxo de Caixa (6 Meses)</CardTitle>
            </CardHeader>
            <CardContent className="h-[350px] pt-8">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeiro.grafico} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.05)" />
                  <XAxis 
                    dataKey="mes" 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    fontFamily="Outfit"
                    fontWeight="bold"
                    tick={{ fill: '#94a3b8' }}
                  />
                  <YAxis 
                    fontSize={10} 
                    tickLine={false} 
                    axisLine={false} 
                    tickFormatter={(val) => `R$${val/1000}k`} 
                    fontFamily="Outfit"
                    fontWeight="bold"
                    tick={{ fill: '#94a3b8' }}
                  />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="despesa" name="Despesa" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Clientes */}
          <Card>
            <CardHeader className="border-b border-black/5 dark:border-white/5 pb-6">
              <CardTitle className="text-xl">Top 5 Clientes (Faturamento)</CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="space-y-4">
                {financeiro.topClientes.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-4 bg-white/40 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl group hover:scale-[1.01] transition-all">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-xl bg-indigo-600 text-white flex items-center justify-center font-bold shadow-lg shadow-indigo-600/20">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-bold text-slate-900 dark:text-white group-hover:text-indigo-600 transition-colors">{c.nome}</p>
                        <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">{c.qtd} pedidos <span className="mx-1">•</span> Ticket Médio: {formatCurrency(c.ticket)}</p>
                      </div>
                    </div>
                    <p className="font-bold text-lg text-slate-900 dark:text-white">{formatCurrency(c.total)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3: Chat IA */}
        <div className="flex flex-col h-full glass dark:bg-slate-950/40 border border-black/5 dark:border-white/10 rounded-2xl shadow-xl overflow-hidden animate-in" style={{ animationDelay: '300ms' }}>
          <div className="p-6 border-b border-black/5 dark:border-white/5 bg-white/40 dark:bg-black/20">
            <h3 className="font-bold text-slate-900 dark:text-white flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-500/20">
                <Sparkles className="h-4 w-4 text-amber-500" />
              </div>
              Consultor IA
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.length === 0 && (
              <div className="text-center py-10 px-4">
                <p className="text-sm text-slate-500 mb-4">
                  Pergunte sobre tendências, riscos ou peça uma análise geral do mês.
                </p>
                <div className="space-y-2">
                  <Button variant="outline" size="sm" className="w-full justify-start text-slate-600" onClick={() => handleSend('Gere uma análise geral')}>
                    📊 Análise Geral
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start text-slate-600" onClick={() => handleSend('Quais os riscos atuais?')}>
                    ⚠️ Riscos e Alertas
                  </Button>
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[90%] rounded-2xl p-4 shadow-sm transition-all duration-300 ${
                  m.role === 'user' 
                    ? 'bg-indigo-600 text-white rounded-tr-none' 
                    : 'bg-white/50 dark:bg-white/5 text-slate-800 dark:text-slate-100 rounded-tl-none border border-black/5 dark:border-white/5'
                }`}>
                  <p className="text-sm font-medium leading-relaxed">{m.content}</p>
                  {m.data && (
                    <div className="space-y-4 mt-3">
                      <div className="p-3 rounded-xl bg-indigo-50 dark:bg-indigo-500/10 border border-indigo-100 dark:border-indigo-500/20">
                        <p className="font-bold text-indigo-700 dark:text-indigo-300 text-xs uppercase tracking-wider mb-2">Análise Estratégica</p>
                        <p className="text-indigo-900 dark:text-indigo-100 leading-relaxed font-medium">{m.data.analiseGeral}</p>
                      </div>
                      {m.data.tendencias.length > 0 && (
                        <ul className="space-y-2">
                          {m.data.tendencias.map((t, idx) => (
                            <li key={idx} className="flex items-start gap-2 text-slate-600 dark:text-slate-300">
                              <Lightbulb className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                              <span className="text-xs font-medium">{t}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-lg p-3">
                  <Loader2 className="h-4 w-4 animate-spin text-indigo-600" />
                </div>
              </div>
            )}
          </div>

          <div className="p-3 border-t border-slate-100">
            <div className="flex gap-2">
              <Input 
                value={input} 
                onChange={e => setInput(e.target.value)} 
                placeholder="Faça uma pergunta..." 
                className="h-9 text-sm"
              />
              <Button size="sm" onClick={() => handleSend()} disabled={loading || !input}>
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

      </div>

      <div className="fixed left-[-10000px] top-0 bg-white">
        <RelatorioOrdensEntregues ref={relatorioRef} dados={ordensEntregues} />
      </div>
    </DashboardLayout>
  )
}
