'use client'

import { useState, useRef, useEffect } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
} from 'lucide-react'

// Relatórios rápidos predefinidos
const quickReports = [
  { icon: DollarSign, label: 'Faturamento do mês', query: 'Qual foi o faturamento deste mês?' },
  { icon: TrendingUp, label: 'Produtividade', query: 'Qual a produtividade dos técnicos esta semana?' },
  { icon: Users, label: 'Clientes ativos', query: 'Quais dentistas mais pediram no último trimestre?' },
  { icon: Package, label: 'Estoque crítico', query: 'Quais materiais estão com estoque baixo?' },
  { icon: Calendar, label: 'Ordens atrasadas', query: 'Quantas ordens estão atrasadas?' },
  { icon: BarChart3, label: 'Serviços populares', query: 'Quais são os serviços mais realizados?' },
]

// Mensagens de exemplo
const exemplosMensagens: Message[] = [
  {
    role: 'user' as const,
    content: 'Qual foi o faturamento de janeiro?',
  },
  {
    role: 'assistant' as const,
    content: `📊 **Faturamento de Janeiro/2026**

O faturamento total de janeiro foi de **R$ 42.350,00**.

**Detalhamento por categoria:**
- Próteses Totais: R$ 15.300 (36%)
- Protocolo: R$ 12.800 (30%)
- Parciais Removíveis: R$ 8.450 (20%)
- Provisórios: R$ 3.600 (8.5%)
- Pontes Adesivas: R$ 2.200 (5.5%)

**Comparativo:**
- ↑ 12% vs dezembro
- ↑ 8% vs janeiro/2025

**Top 3 dentistas:**
1. Dr. João Santos - R$ 12.450
2. Dra. Ana Lima - R$ 9.800
3. Dr. Paulo Costa - R$ 7.200`,
  },
]

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function RelatoriosPage() {
  const [messages, setMessages] = useState<Message[]>(exemplosMensagens)
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

    // Simular resposta da IA
    await new Promise(resolve => setTimeout(resolve, 2000))

    const aiResponse: Message = {
      role: 'assistant',
      content: generateMockResponse(messageText),
    }
    setMessages(prev => [...prev, aiResponse])
    setLoading(false)
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
        subtitle="Pergunte qualquer coisa sobre seu laboratório"
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

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Exemplos de Perguntas</CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="text-sm text-slate-600 space-y-2">
                <li className="cursor-pointer hover:text-indigo-600" onClick={() => handleSend('Qual o tempo médio de produção de prótese total?')}>
                  "Qual o tempo médio de produção?"
                </li>
                <li className="cursor-pointer hover:text-indigo-600" onClick={() => handleSend('Quais dentistas não fazem pedidos há mais de 30 dias?')}>
                  "Dentistas inativos há 30 dias?"
                </li>
                <li className="cursor-pointer hover:text-indigo-600" onClick={() => handleSend('Quanto gastei em PMMA este mês?')}>
                  "Gastos com PMMA este mês?"
                </li>
                <li className="cursor-pointer hover:text-indigo-600" onClick={() => handleSend('Qual técnico produziu mais esta semana?')}>
                  "Técnico mais produtivo?"
                </li>
              </ul>
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
                  Olá! Como posso ajudar?
                </h3>
                <p className="text-slate-500 max-w-md">
                  Faça perguntas sobre seu laboratório em linguagem natural. 
                  Posso gerar relatórios, analisar dados e fornecer insights.
                </p>
              </div>
            )}

            {messages.map((message, index) => (
              <div
                key={index}
                className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-2xl rounded-2xl px-5 py-4 ${
                    message.role === 'user'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-slate-100 text-slate-900'
                  }`}
                >
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mb-3 pb-3 border-b border-slate-200">
                      <Sparkles className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium text-slate-700">LabGest IA</span>
                    </div>
                  )}
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {message.content}
                  </div>
                  {message.role === 'assistant' && (
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-slate-200">
                      <Button variant="ghost" size="sm" className="text-xs">
                        <Download className="h-3 w-3 mr-1" />
                        Exportar
                      </Button>
                      <Button variant="ghost" size="sm" className="text-xs">
                        <RefreshCw className="h-3 w-3 mr-1" />
                        Refazer
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
                  <span className="text-sm text-slate-600">Analisando dados...</span>
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
                  placeholder="Pergunte algo sobre seu laboratório..."
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
            <p className="text-xs text-slate-400 mt-2 text-center">
              A IA analisa os dados do seu laboratório para gerar insights personalizados
            </p>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}

// Função para gerar respostas mockadas
function generateMockResponse(query: string): string {
  const queryLower = query.toLowerCase()

  if (queryLower.includes('atrasad')) {
    return `⚠️ **Ordens Atrasadas**

Atualmente há **3 ordens atrasadas**:

1. **#002** - Carlos Oliveira
   - Serviço: Protocolo Inferior
   - Atraso: 1 dia
   - Dentista: Dra. Ana Lima

2. **#008** - Roberto Silva  
   - Serviço: Prótese Total Superior
   - Atraso: 2 dias
   - Dentista: Dr. João Santos

3. **#012** - Marina Costa
   - Serviço: Parcial Removível
   - Atraso: 1 dia
   - Dentista: Dr. Paulo Costa

**Recomendação:** Priorize a ordem #008 que tem maior atraso e é de um cliente frequente.`
  }

  if (queryLower.includes('estoque') || queryLower.includes('material')) {
    return `📦 **Alerta de Estoque**

**4 itens** estão abaixo do nível mínimo:

| Material | Atual | Mínimo | Status |
|----------|-------|--------|--------|
| PMMA Rosa | 2 un | 5 un | 🔴 Crítico |
| Dentes A2 | 3 cx | 5 cx | 🔴 Crítico |
| Resina Caracterização | 1 un | 3 un | 🟡 Baixo |
| Gesso Tipo IV | 4 kg | 10 kg | 🟡 Baixo |

**Previsão de consumo:**
- PMMA Rosa: ~3 unidades/semana
- Dentes A2: ~2 caixas/semana

**Sugestão:** Faça pedido de reposição nos próximos 2 dias para evitar paradas na produção.`
  }

  if (queryLower.includes('produtiv') || queryLower.includes('técnico')) {
    return `👥 **Produtividade dos Técnicos - Esta Semana**

| Técnico | Ordens | Tempo Médio | Eficiência |
|---------|--------|-------------|------------|
| João | 12 | 4.2h | ⭐ 95% |
| Marcos | 9 | 5.1h | ⭐ 88% |

**Destaques:**
- João completou 3 protocolos esta semana (recorde!)
- Tempo médio geral reduziu 15% vs semana passada
- Nenhum retrabalho registrado

**Distribuição por tipo:**
- Próteses Totais: 8 (38%)
- Protocolo: 5 (24%)
- Parciais: 4 (19%)
- Outros: 4 (19%)`
  }

  if (queryLower.includes('dentista') && queryLower.includes('inativ')) {
    return `👤 **Dentistas Inativos (sem pedidos há 30+ dias)**

Encontrei **2 dentistas** inativos:

1. **Dra. Fernanda Reis** (CRO-AL 1122)
   - Último pedido: 20/11/2025 (77 dias)
   - Total histórico: 5 pedidos
   - Valor total: R$ 4.500

2. **Dr. Ricardo Mendes** (CRO-AL 4455)
   - Último pedido: 15/12/2025 (52 dias)
   - Total histórico: 8 pedidos
   - Valor total: R$ 7.200

**Sugestão:** Considere entrar em contato para:
- Verificar satisfação com serviços anteriores
- Informar sobre novos serviços/promoções
- Atualizar dados cadastrais`
  }

  // Resposta genérica
  return `📊 **Análise Concluída**

Com base na sua pergunta, analisei os dados do laboratório.

**Resumo:**
- Total de ordens este mês: 45
- Faturamento acumulado: R$ 38.500
- Taxa de entrega no prazo: 92%
- Clientes ativos: 6

Para uma análise mais específica, tente perguntas como:
- "Qual o faturamento por categoria?"
- "Quais ordens estão atrasadas?"
- "Qual o tempo médio de produção?"

Posso ajudar com algo mais específico?`
}
