'use client'

import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { AlertTriangle, Clock, Calendar, CheckCircle2, User, AlertCircle } from 'lucide-react'
import { etapaLabel } from '@/lib/workflow-config'

interface Ordem {
  id: number
  nomePaciente: string
  servicoNome: string
  clienteNome: string
  dataEntrega: Date
  etapaAtual: string | null
  status: string | null
}

interface PrioridadesViewProps {
  atrasados: Ordem[]
  hoje: Ordem[]
  urgentes: Ordem[]
  proximos: Ordem[]
}

function OrdemCard({ ordem, type }: { ordem: Ordem; type: 'atrasado' | 'hoje' | 'urgente' | 'proximo' }) {
  const colors = {
    atrasado: 'border-l-4 border-l-red-500 bg-red-50/50 dark:bg-red-500/10',
    hoje: 'border-l-4 border-l-amber-500 bg-amber-50/50 dark:bg-amber-500/10',
    urgente: 'border-l-4 border-l-orange-500 bg-orange-50/50 dark:bg-orange-500/10',
    proximo: 'border-l-4 border-l-blue-500 bg-blue-50/50 dark:bg-blue-500/10',
  }

  const icons = {
    atrasado: <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />,
    hoje: <Clock className="h-5 w-5 text-amber-600 dark:text-amber-400" />,
    urgente: <AlertTriangle className="h-5 w-5 text-orange-600 dark:text-orange-400" />,
    proximo: <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />,
  }

  return (
    <div className={`p-4 rounded-xl shadow-sm glass mb-3 animate-in transition-all hover:scale-[1.02] ${colors[type]}`}>
      <div className="flex justify-between items-start">
        <div className="flex gap-3">
          <div className="mt-1">{icons[type]}</div>
          <div>
            <h4 className="font-bold text-slate-900 dark:text-white">{ordem.nomePaciente}</h4>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-300">{ordem.servicoNome}</p>
            <div className="flex items-center gap-2 mt-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
              <User className="h-3 w-3" />
              <span>Dr(a). {ordem.clienteNome}</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <Badge variant="outline" className="mb-2 bg-white/50 dark:bg-black/20 border-black/5 dark:border-white/10">
            {etapaLabel(ordem.etapaAtual || 'recebimento', 'lab')}
          </Badge>
          <p className="text-[10px] font-bold uppercase tracking-tighter text-slate-400" suppressHydrationWarning>
            Entrega: {new Date(ordem.dataEntrega).toLocaleDateString('pt-BR')}
          </p>
        </div>
      </div>
    </div>
  )
}

export function PrioridadesView({ atrasados, hoje, urgentes, proximos }: PrioridadesViewProps) {
  const totalPrioridades = atrasados.length + hoje.length + urgentes.length

  return (
    <DashboardLayout>
      <Header 
        title="Cronograma de Prioridades" 
        subtitle={`Você tem ${totalPrioridades} entregas críticas para gerenciar.`}
      />

      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        
        {/* Coluna 1: Críticos (Atrasados + Urgentes) */}
        <div className="space-y-6">
          <Card className="border-red-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-red-700">
                <AlertCircle className="h-5 w-5" />
                Atrasados ({atrasados.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {atrasados.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Nenhum pedido atrasado. Ótimo trabalho! 👏</p>
              ) : (
                atrasados.map(o => <OrdemCard key={o.id} ordem={o} type="atrasado" />)
              )}
            </CardContent>
          </Card>

          <Card className="border-orange-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-orange-700">
                <AlertTriangle className="h-5 w-5" />
                Urgentes ({urgentes.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {urgentes.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Sem pedidos marcados como urgentes.</p>
              ) : (
                urgentes.map(o => <OrdemCard key={o.id} ordem={o} type="urgente" />)
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna 2: Para Hoje */}
        <div>
          <Card className="border-amber-200 h-full bg-amber-50/30">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-amber-700">
                <Clock className="h-5 w-5" />
                Entrega Hoje ({hoje.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {hoje.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-10 text-center">
                  <CheckCircle2 className="h-12 w-12 text-green-500 mb-2" />
                  <p className="text-slate-600 font-medium">Tudo em dia!</p>
                  <p className="text-sm text-slate-500">Nenhuma entrega agendada para hoje.</p>
                </div>
              ) : (
                hoje.map(o => <OrdemCard key={o.id} ordem={o} type="hoje" />)
              )}
            </CardContent>
          </Card>
        </div>

        {/* Coluna 3: Próximos */}
        <div>
          <Card className="border-blue-100 h-full">
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center gap-2 text-blue-700">
                <Calendar className="h-5 w-5" />
                Amanhã ({proximos.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {proximos.length === 0 ? (
                <p className="text-sm text-slate-500 italic">Nada agendado para amanhã por enquanto.</p>
              ) : (
                proximos.map(o => <OrdemCard key={o.id} ordem={o} type="proximo" />)
              )}
            </CardContent>
          </Card>
        </div>

      </div>
    </DashboardLayout>
  )
}
