'use client'

import { useState, useRef, useEffect } from 'react'
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
  Package,
  Calendar,
  Download,
  RefreshCw,
  MessageSquare,
  Loader2,
  AlertTriangle,
  Lightbulb,
} from 'lucide-react'

// Relatórios rápidos predefinidos
const quickReports = [
  { icon: DollarSign, label: 'Análise Geral', query: 'Gere uma análise geral do laboratório' },
  { icon: TrendingUp, label: 'Tendências', query: 'Quais são as tendências atuais?' },
  { icon: AlertTriangle, label: 'Alertas de Risco', query: 'Existem riscos ou alertas?' },
]

interface RelatorioData {
  analiseGeral: string
  tendencias: string[]
  sugestoesAcao: string[]
  alertaRisco: string | null
}

interface Message {
  role: 'user' | 'assistant'
  content?: string
  data?: RelatorioData
}

export default function RelatoriosPage() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (query?: string) => {
    const messageText = query || input
    if (!messageText.trim()) return

    const userMessage: Message = { role: 'user', content: messageText }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const data = await gerarRelatorioIA()
      
      const aiResponse: Message = {
        role: 'assistant',
        data: data,
      }
      setMessages(prev => [...prev, aiResponse])
    } catch (error) {
      console.error(error)
      setMessages(prev => [...prev, { 
        role: 'assistant', 
        content: 'Desculpe, ocorreu um erro ao gerar o relatório. Tente novamente.' 
      }])
    } finally {
      setLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <DashboardLayout>
      <Header 
        title="Relatórios Inteligentes" 
        subtitle="Análise automática do seu laboratório com IA"
      />
      
      <div className="p-6 h-[calc(100vh-64px)] flex gap-6">
        {/* Sidebar - Quick Reports */}
        <div className="w-80 flex-shrink-0 space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-500" />
                Relatórios Rápidos
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickReports.map((report, index) => (
                <button
                  key={index}
                  onClick={() => handleSend(report.query)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg text-left hover:bg-slate-50 transition-colors group"
                >
                  <div className="p-2 rounded-lg bg-indigo-100 text-indigo-600 group-hover:bg-indigo-200 transition-colors">
                    <report.icon className="h-4 w-4" />
                  </div>
                  <span className="text-sm font-medium text-slate-700">{report.label}</span>
                </button>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Main Chat Area */}
        <Card className="flex-1 flex flex-col">
          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center text-center">
                <div className="p-4 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 mb-4">
                  <Sparkles className="h-8 w-8 text-indigo-600" />
                </div>
                <h3 className="text-lg font-medium text-slate-900 mb-2">
                  Olá! Eu sou a IA do LabGest.
                </h3>
                <p className="text-slate-500 max-w-md">
                  Estou analisando seus dados financeiros, de produção e clientes em tempo real.
                  Clique em um dos relatórios rápidos para ver meus insights.
                </p>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-3xl rounded-2xl px-5 py-4 ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-900 w-full'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-slate-700">LabGest IA</span>
                    </div>
                  )}
                  
                  {message.content && (
                    <div className="whitespace-pre-wrap text-sm leading-relaxed">
                      {message.content}
                    </div>
                  )}

                  {message.data && (
                    <div className="space-y-6">
                      {/* Análise Geral */}
                      <div>
                        <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                          <BarChart3 className="h-4 w-4 text-indigo-600" />
                          Análise Geral
                        </h4>
                        <p className="text-slate-600 text-sm leading-relaxed">
                          {message.data.analiseGeral}
                        </p>
                      </div>

                      {/* Tendências */}
                      {message.data.tendencias.length > 0 && (
                        <div>
                          <h4 className="font-semibold text-slate-900 mb-2 flex items-center gap-2">
                            <TrendingUp className="h-4 w-4 text-emerald-600" />
                            Tendências
                          </h4>
                          <ul className="space-y-1">
                            {message.data.tendencias.map((item, i) => (
                              <li key={i} className="text-sm text-slate-600 flex items-start gap-2">
                                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Sugestões */}
                      {message.data.sugestoesAcao.length > 0 && (
                        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100">
                          <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
                            <Lightbulb className="h-4 w-4 text-indigo-600" />
                            Sugestões de Ação
                          </h4>
                          <ul className="space-y-2">
                            {message.data.sugestoesAcao.map((item, i) => (
                              <li key={i} className="text-sm text-indigo-700 flex items-start gap-2">
                                <span className="font-bold text-indigo-400">{i + 1}.</span>
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {/* Alertas */}
                      {message.data.alertaRisco && (
                        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
                          <h4 className="font-semibold text-red-900 mb-2 flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4 text-red-600" />
                            Atenção Necessária
                          </h4>
                          <p className="text-sm text-red-700">
                            {message.data.alertaRisco}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200">
                      <Button variant="ghost" size="sm" className="text-xs">
                        <Download className="h-3 w-3 mr-1" />
                        Salvar Relatório
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div className="bg-slate-100 rounded-2xl px-5 py-4 flex items-center gap-3">
                  <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
                  <span className="text-sm text-slate-600">Processando dados com IA...</span>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-200">
            <div className="flex items-center gap-3">
              <div className="relative flex-1">
                <MessageSquare className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-slate-400" />
                <Input
                  placeholder="Peça uma nova análise..."
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="pl-12 pr-4 h-12 text-base"
                  disabled={loading}
                />
              </div>
              <Button 
                onClick={() => handleSend()} 
                className="h-12 px-6"
                disabled={loading || !input.trim()}
              >
                <Send className="h-5 w-5" />
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}

