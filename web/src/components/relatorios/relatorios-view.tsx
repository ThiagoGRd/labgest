'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { gerarRelatorioIA } from '@/actions/relatorios'
import {
  Sparkles,
  Send,
  BarChart3,
  TrendingUp,
  Users,
  DollarSign,
  Loader2,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react'
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  LineChart,
  Line
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

export function RelatoriosView({ financeiro }: { financeiro: FinancialData }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSend = async (query?: string) => {
    const messageText = query || input
    if (!messageText.trim()) return

    const userMessage: Message = { role: 'user', content: messageText }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const data = await gerarRelatorioIA()
      setMessages(prev => [...prev, { role: 'assistant', data: data }])
    } catch (error) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Erro ao gerar análise.' }])
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (val: number) => 
    new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val)

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border border-slate-200 rounded-lg shadow-lg">
          <p className="font-medium text-slate-900 mb-2">{label}</p>
          {payload.map((entry, index) => (
            <div key={index} className="flex items-center gap-2 text-sm">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
              <span className="text-slate-500">{entry.name}:</span>
              <span className="font-medium text-slate-900">
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
      
      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100vh-100px)]">
        
        {/* Coluna 1 e 2: Dashboards Visuais */}
        <div className="lg:col-span-2 space-y-6 overflow-y-auto pr-2">
          
          {/* Gráfico Principal */}
          <Card>
            <CardHeader>
              <CardTitle>Fluxo de Caixa (6 Meses)</CardTitle>
            </CardHeader>
            <CardContent className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={financeiro.grafico}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="mes" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis fontSize={12} tickLine={false} axisLine={false} tickFormatter={(val) => `R$${val/1000}k`} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="receita" name="Receita" fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="despesa" name="Despesa" fill="#ef4444" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          {/* Top Clientes */}
          <Card>
            <CardHeader>
              <CardTitle>Top 5 Clientes (Faturamento)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {financeiro.topClientes.map((c, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold text-xs">
                        {i + 1}
                      </div>
                      <div>
                        <p className="font-medium text-slate-900">{c.nome}</p>
                        <p className="text-xs text-slate-500">{c.qtd} pedidos • Ticket Médio: {formatCurrency(c.ticket)}</p>
                      </div>
                    </div>
                    <p className="font-bold text-slate-700">{formatCurrency(c.total)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3: Chat IA */}
        <div className="flex flex-col h-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-100 bg-slate-50/50">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-amber-500" />
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
                <div className={`max-w-[90%] rounded-lg p-3 text-sm ${
                  m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-800'
                }`}>
                  {m.content}
                  {m.data && (
                    <div className="space-y-3 mt-1">
                      <p className="font-medium text-indigo-700">{m.data.analiseGeral}</p>
                      {m.data.tendencias.length > 0 && (
                        <ul className="list-disc pl-4 space-y-1">
                          {m.data.tendencias.map((t, idx) => <li key={idx}>{t}</li>)}
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
    </DashboardLayout>
  )
}
