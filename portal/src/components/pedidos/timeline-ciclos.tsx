'use client'

import { CheckCircle2, Clock, RotateCcw, FlaskConical, Image as ImageIcon } from 'lucide-react'

interface Ciclo {
  id: number
  numeroCiclo: number
  etapa?: string | null
  dataEntrada: string
  prazoDias: number
  dataComprometida: string
  dataSaida?: string | null
  dataRetorno?: string | null
  observacoesDentista?: string | null
  fotosProva?: string[]
  decisao?: string | null
  status: string
}

interface TimelineCiclosProps {
  ciclos: Ciclo[]
}

function formatDate(d: string | null | undefined) {
  if (!d) return '—'
  return new Date(d).toLocaleDateString('pt-BR')
}

function getDaysLeft(comprometida: string, status: string) {
  if (status !== 'no_lab') return null
  const hoje = new Date()
  hoje.setHours(0, 0, 0, 0)
  const alvo = new Date(comprometida)
  alvo.setHours(0, 0, 0, 0)
  return Math.ceil((alvo.getTime() - hoje.getTime()) / 86400000)
}

export function TimelineCiclos({ ciclos }: TimelineCiclosProps) {
  if (!ciclos || ciclos.length === 0) {
    return (
      <div className="text-center py-6 text-zinc-500 text-sm">
        Nenhum ciclo registrado ainda.
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {ciclos.map((ciclo) => {
        const daysLeft = getDaysLeft(ciclo.dataComprometida, ciclo.status)
        const isAtrasado = daysLeft !== null && daysLeft < 0
        const isConcluido = ciclo.status === 'concluido'
        const isEmProva = ciclo.status === 'em_prova'
        const isNoLab = ciclo.status === 'no_lab'

        return (
          <div
            key={ciclo.id}
            className={`rounded-2xl border p-4 transition-all ${
              isNoLab
                ? 'border-indigo-500/30 bg-indigo-900/10'
                : isEmProva
                ? 'border-amber-500/30 bg-amber-900/10'
                : 'border-zinc-700/50 bg-zinc-800/30'
            }`}
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-black ${
                  isNoLab ? 'bg-indigo-600 text-white' : isEmProva ? 'bg-amber-500 text-white' : 'bg-zinc-700 text-zinc-300'
                }`}>
                  {ciclo.numeroCiclo}
                </div>
                <div>
                  <p className={`text-xs font-bold uppercase tracking-wider ${
                    isNoLab ? 'text-indigo-400' : isEmProva ? 'text-amber-400' : 'text-zinc-500'
                  }`}>
                    {isNoLab ? '🔵 No Laboratório' : isEmProva ? '🟡 Aguardando Prova' : '✅ Concluído'}
                  </p>
                  {ciclo.etapa && <p className="text-sm font-semibold text-white mt-0.5">{ciclo.etapa}</p>}
                </div>
              </div>

              {/* Badge de prazo */}
              {isNoLab && daysLeft !== null && (
                <span className={`flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full ${
                  isAtrasado
                    ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                    : daysLeft <= 2
                    ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                    : 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                }`}>
                  <Clock className="h-3 w-3" />
                  {isAtrasado ? `${Math.abs(daysLeft)}d atrasado` : daysLeft === 0 ? 'Hoje' : `${daysLeft}d restantes`}
                </span>
              )}

              {isEmProva && (
                <span className="flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <FlaskConical className="h-3 w-3" />
                  Em prova
                </span>
              )}
            </div>

            {/* Linha do tempo interna */}
            <div className="grid grid-cols-3 gap-2 text-xs">
              <div className="bg-black/20 rounded-lg p-2">
                <p className="text-zinc-500 uppercase font-bold text-[10px]">Entrada no Lab</p>
                <p className="text-zinc-200 font-semibold mt-0.5">{formatDate(ciclo.dataEntrada)}</p>
              </div>
              <div className="bg-black/20 rounded-lg p-2">
                <p className="text-zinc-500 uppercase font-bold text-[10px]">Prazo Lab</p>
                <p className={`font-semibold mt-0.5 ${isAtrasado ? 'text-red-400' : 'text-zinc-200'}`}>
                  {formatDate(ciclo.dataComprometida)}
                </p>
              </div>
              {ciclo.dataSaida && (
                <div className="bg-black/20 rounded-lg p-2">
                  <p className="text-zinc-500 uppercase font-bold text-[10px]">Saiu p/ Prova</p>
                  <p className="text-amber-300 font-semibold mt-0.5">{formatDate(ciclo.dataSaida)}</p>
                </div>
              )}
              {ciclo.dataRetorno && (
                <div className="bg-black/20 rounded-lg p-2">
                  <p className="text-zinc-500 uppercase font-bold text-[10px]">Retornou</p>
                  <p className="text-emerald-400 font-semibold mt-0.5">{formatDate(ciclo.dataRetorno)}</p>
                </div>
              )}
            </div>

            {/* Feedback do dentista */}
            {ciclo.observacoesDentista && (
              <div className="mt-3 p-3 bg-black/20 rounded-xl border border-zinc-700/50">
                <p className="text-[10px] font-bold uppercase text-zinc-500 mb-1">
                  {ciclo.decisao === 'aprovado' ? '✅ Dentista aprovou' : '🔄 Ajustes solicitados'}
                </p>
                <p className="text-sm text-zinc-300">{ciclo.observacoesDentista}</p>
              </div>
            )}

            {/* Fotos */}
            {ciclo.fotosProva && ciclo.fotosProva.length > 0 && (
              <div className="mt-3">
                <p className="text-[10px] font-bold uppercase text-zinc-500 mb-2">
                  <ImageIcon className="h-3 w-3 inline mr-1" />
                  {ciclo.fotosProva.length} foto(s) da prova
                </p>
                <div className="flex gap-2">
                  {ciclo.fotosProva.slice(0, 4).map((foto, i) => (
                    <a key={i} href={foto} target="_blank" rel="noreferrer">
                      <img src={foto} alt={`Prova`} className="h-14 w-14 object-cover rounded-lg border border-zinc-700 hover:opacity-80 transition-opacity" />
                    </a>
                  ))}
                  {ciclo.fotosProva.length > 4 && (
                    <div className="h-14 w-14 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs font-bold text-zinc-400">
                      +{ciclo.fotosProva.length - 4}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
