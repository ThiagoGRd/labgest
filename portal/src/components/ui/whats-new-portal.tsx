'use client'

import { useEffect, useState } from 'react'
import { X, Sparkles, ChevronDown, ChevronUp, ArrowUpCircle, Wrench } from 'lucide-react'
import { VERSAO_ATUAL, HISTORICO_RELEASES, type NotaRelease } from '@/lib/release-notes'

const STORAGE_KEY = `labgest_portal_seen_version`

interface WhatsNewPortalProps {
  forceOpen?: boolean
  onClose?: () => void
}

const tipoConfig = {
  novo: { label: 'Novo', icon: Sparkles, color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
  melhoria: { label: 'Melhoria', icon: ArrowUpCircle, color: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
  correcao: { label: 'Correção', icon: Wrench, color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
}

function ReleaseCard({ nota, defaultOpen = false }: { nota: NotaRelease; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-white/5 transition-colors"
      >
        <div className="text-left">
          <p className="font-bold text-white text-sm">{nota.titulo}</p>
          <p className="text-xs text-zinc-500 mt-0.5">v{nota.versao} · {nota.data}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-zinc-500" /> : <ChevronDown className="h-4 w-4 text-zinc-500" />}
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-2 border-t border-white/5 pt-4">
          {nota.novidades.map((n, i) => {
            const cfg = tipoConfig[n.tipo]
            const Icon = cfg.icon
            return (
              <div key={i} className="flex items-start gap-3">
                <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5 ${cfg.color}`}>
                  <Icon className="h-3 w-3" />
                  {cfg.label}
                </span>
                <p className="text-sm text-zinc-300 leading-relaxed">{n.texto}</p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export function WhatsNewPortal({ forceOpen = false, onClose }: WhatsNewPortalProps) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    const seen = localStorage.getItem(STORAGE_KEY)
    if (seen !== VERSAO_ATUAL || forceOpen) {
      setOpen(true)
    }
  }, [forceOpen])

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, VERSAO_ATUAL)
    setOpen(false)
    onClose?.()
  }

  if (!open) return null

  const [latest, ...anteriores] = HISTORICO_RELEASES

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={handleClose} />

      <div className="relative z-10 w-full max-w-lg max-h-[90vh] flex flex-col rounded-3xl border border-white/10 bg-zinc-950 shadow-2xl shadow-black/50 overflow-hidden animate-in slide-in-from-bottom-4 duration-300">

        {/* Header Esmeralda */}
        <div className="relative px-6 pt-8 pb-6 bg-gradient-to-br from-emerald-600/20 via-teal-600/10 to-transparent border-b border-white/10">
          <button
            onClick={handleClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition-colors"
          >
            <X className="h-4 w-4 text-white" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="h-10 w-10 rounded-xl bg-emerald-600 flex items-center justify-center shadow-lg shadow-emerald-600/30">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-400">Novidades do Portal</p>
              <h2 className="text-xl font-black text-white">O que há de novo</h2>
            </div>
          </div>
          <p className="text-sm text-zinc-400">Fique por dentro das últimas melhorias do seu portal.</p>
        </div>

        {/* Conteúdo */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <div className="flex items-center gap-2 mb-4">
              <span className="text-[10px] font-black bg-emerald-600 text-white px-2.5 py-1 rounded-full uppercase tracking-wider">
                Novo agora · v{latest.versao}
              </span>
              <span className="text-xs text-zinc-500">{latest.data}</span>
            </div>
            <h3 className="font-bold text-white text-base mb-4">{latest.titulo}</h3>
            <div className="space-y-3">
              {latest.novidades.map((n, i) => {
                const cfg = tipoConfig[n.tipo]
                const Icon = cfg.icon
                return (
                  <div key={i} className="flex items-start gap-3">
                    <span className={`flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-full border flex-shrink-0 mt-0.5 ${cfg.color}`}>
                      <Icon className="h-3 w-3" />
                      {cfg.label}
                    </span>
                    <p className="text-sm text-zinc-300 leading-relaxed">{n.texto}</p>
                  </div>
                )
              })}
            </div>
          </div>

          {anteriores.length > 0 && (
            <div>
              <p className="text-xs font-bold uppercase text-zinc-600 mb-3 tracking-wider">Versões anteriores</p>
              <div className="space-y-2">
                {anteriores.map(nota => (
                  <ReleaseCard key={nota.versao} nota={nota} />
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-white/10 flex items-center justify-between">
          <p className="text-xs text-zinc-600">LabGest Portal v{VERSAO_ATUAL}</p>
          <button
            onClick={handleClose}
            className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-bold rounded-xl transition-all active:scale-[0.97] shadow-lg shadow-emerald-600/20"
          >
            Entendido! 🚀
          </button>
        </div>
      </div>
    </div>
  )
}
