import { getOrdemPublic } from '@/actions/ordens'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { CheckCircle2, Clock, Package, User, Calendar, Activity } from 'lucide-react'
import Link from 'next/link'

function getStatusVariant(status: string) {
  const map: Record<string, any> = {
    'Aguardando': 'aguardando',
    'Em Produção': 'emProducao',
    'Finalizado': 'finalizado',
    'Cancelado': 'destructive',
    'Pausado': 'pausado',
  }
  return map[status] || 'default'
}

export default async function CheckOrderPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params
  console.log('[CheckOrderPage] Params received:', resolvedParams)

  // Tentar limpar o ID (remover qualquer coisa que não seja número)
  const cleanIdProp = resolvedParams.id ? resolvedParams.id.replace(/\D/g, '') : ''
  const id = parseInt(cleanIdProp)

  if (isNaN(id) || !cleanIdProp) {
    console.error('[CheckOrderPage] Invalid ID:', resolvedParams.id)
    return (
      <div className="min-h-screen flex items-center justify-center p-6 mesh-bg">
        <Card className="max-w-md w-full text-center p-12">
          <div className="w-20 h-20 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="h-10 w-10 text-amber-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Código Inválido</h1>
          <p className="text-slate-500 mb-4">O código da ordem não parece ser válido.</p>
          <div className="bg-slate-100 p-2 rounded mb-6 text-xs font-mono text-slate-600 break-all">
            Recebido: {JSON.stringify(resolvedParams)}
          </div>
          <Link href="/" className="text-indigo-600 font-bold hover:underline">Voltar para o site</Link>
        </Card>
      </div>
    )
  }

  const ordem = await getOrdemPublic(id)

  if (!ordem) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6 mesh-bg">
        <Card className="max-w-md w-full text-center p-12">
          <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Package className="h-10 w-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Ordem não encontrada</h1>
          <p className="text-slate-500 mb-8">O código digitado ou escaneado não corresponde a uma ordem válida.</p>
          <Link href="/" className="text-indigo-600 font-bold hover:underline">Voltar para o site</Link>
        </Card>
      </div>
    )
  }

  const etapas = [
    'Recebimento',
    'Modelagem',
    'Impressão',
    'Acabamento',
    'Conferência',
    'Pronto para Entrega'
  ]

  const etapaIndex = etapas.indexOf(ordem.etapaAtual || 'Recebimento')

  return (
    <div className="min-h-screen mesh-bg p-6 lg:p-12">
      <div className="max-w-2xl mx-auto space-y-8">

        {/* Header */}
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-600 to-purple-700 flex items-center justify-center shadow-xl shadow-indigo-600/30">
            <span className="text-white font-black text-2xl">LG</span>
          </div>
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-900">LabGest Tracking</h1>
            <p className="text-sm font-bold uppercase tracking-widest text-slate-400">Consulta de Status em Tempo Real</p>
          </div>
        </div>

        {/* Status Card */}
        <Card className="overflow-hidden border-none shadow-2xl">
          <div className="bg-indigo-600 p-8 text-white">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-indigo-100 text-[10px] font-bold uppercase tracking-widest mb-1">Identificação do Caso</p>
                <h2 className="text-4xl font-black tracking-tighter">#{ordem.id.toString().padStart(6, '0')}</h2>
              </div>
              <Badge className="bg-white text-indigo-600 border-none px-4 py-2 rounded-xl text-xs shadow-lg">
                {ordem.status}
              </Badge>
            </div>

            <div className="grid grid-cols-2 gap-8">
              <div>
                <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-1">Paciente</p>
                <p className="text-xl font-bold truncate">{ordem.paciente}</p>
              </div>
              <div className="text-right">
                <p className="text-indigo-200 text-[10px] font-bold uppercase tracking-widest mb-1">Dentista</p>
                <p className="text-lg font-bold truncate">{ordem.cliente.nome}</p>
              </div>
            </div>
          </div>

          <CardContent className="p-8 space-y-8 bg-white/80 backdrop-blur-xl">
            {/* Timeline */}
            <div className="relative">
              <h3 className="text-sm font-black uppercase tracking-widest text-slate-400 mb-8">Etapa da Produção</h3>

              <div className="space-y-6">
                {etapas.map((etapa, idx) => {
                  const isCompleted = idx < etapaIndex
                  const isCurrent = idx === etapaIndex

                  return (
                    <div key={etapa} className="flex items-center gap-4 relative">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 z-10 transition-all duration-500 ${isCompleted ? 'bg-emerald-500 text-white' :
                        isCurrent ? 'bg-indigo-600 text-white ring-4 ring-indigo-100 animate-pulse' :
                          'bg-slate-100 text-slate-400'
                        }`}>
                        {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <span className="text-xs font-bold">{idx + 1}</span>}
                      </div>

                      {idx < etapas.length - 1 && (
                        <div className={`absolute left-4 top-8 w-0.5 h-6 -translate-x-1/2 ${idx < etapaIndex ? 'bg-emerald-500' : 'bg-slate-100'
                          }`} />
                      )}

                      <div className="flex-1">
                        <p className={`text-sm font-bold ${isCurrent ? 'text-indigo-600' : isCompleted ? 'text-slate-900' : 'text-slate-400'}`}>
                          {etapa}
                        </p>
                        {isCurrent && <p className="text-[10px] font-bold text-indigo-400 uppercase tracking-tight">Em andamento</p>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            <hr className="border-slate-100" />

            {/* Meta Info */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Calendar className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Entrega Prevista</span>
                </div>
                <p className="text-lg font-black text-slate-900">{new Date(ordem.dataEntrega).toLocaleDateString('pt-BR')}</p>
              </div>

              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-2 text-slate-400 mb-2">
                  <Activity className="h-4 w-4" />
                  <span className="text-[10px] font-bold uppercase tracking-wider">Prioridade</span>
                </div>
                <p className="text-lg font-black text-slate-900 uppercase">{ordem.prioridade}</p>
              </div>
            </div>

            <div className="text-center pt-4">
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">LABGEST PREMIUM • DENTAL TECHNOLOGY</p>
            </div>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-slate-400">
          Este é um canal oficial de rastreamento do laboratório.
          Em caso de dúvidas, entre em contato diretamente com o suporte técnico.
        </p>
      </div>
    </div>
  )
}
