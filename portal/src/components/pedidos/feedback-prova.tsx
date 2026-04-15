'use client'

import { useState, useRef } from 'react'
import { salvarFeedbackProva } from '@/actions/ciclos'
import { Button } from '@/components/ui/button'
import {
  Camera,
  CheckCircle2,
  RotateCcw,
  Send,
  Loader2,
  X,
  Image as ImageIcon,
} from 'lucide-react'

interface FeedbackProvaProps {
  cicloId: number
  numeroCiclo: number
  onSubmit?: () => void
}

export function FeedbackProva({ cicloId, numeroCiclo, onSubmit }: FeedbackProvaProps) {
  const [decisao, setDecisao] = useState<'ajustes' | 'aprovado' | null>(null)
  const [observacoes, setObservacoes] = useState('')
  const [fotos, setFotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const handleFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading(true)
    try {
      // Converter para base64 localmente (sem upload externo por enquanto)
      const encoded = await Promise.all(
        files.map(file => new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = (e) => resolve(e.target?.result as string)
          reader.readAsDataURL(file)
        }))
      )
      setFotos(prev => [...prev, ...encoded])
    } catch (e) {
      console.error(e)
    } finally {
      setUploading(false)
    }
  }

  const handleEnviar = async () => {
    if (!decisao) return
    setLoading(true)
    try {
      await salvarFeedbackProva(cicloId, observacoes, decisao, fotos)
      setEnviado(true)
      onSubmit?.()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  if (enviado) {
    return (
      <div className="flex flex-col items-center py-6 gap-3 text-center animate-in">
        <div className="w-14 h-14 rounded-full bg-emerald-500/10 flex items-center justify-center">
          <CheckCircle2 className="h-7 w-7 text-emerald-500" />
        </div>
        <div>
          <p className="font-bold text-white">Feedback enviado!</p>
          <p className="text-sm text-zinc-400">O laboratório já fue notificado.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-sm text-amber-300 flex items-center gap-2">
        <span className="text-lg">📬</span>
        Registre o resultado da prova <strong>#{numeroCiclo}</strong> para o laboratório.
      </div>

      {/* Fotos */}
      <div>
        <p className="text-xs font-bold uppercase text-zinc-400 mb-2">📷 Fotos da Prova <span className="normal-case font-normal">(opcional)</span></p>
        <div className="flex flex-wrap gap-2">
          {fotos.map((foto, i) => (
            <div key={i} className="relative group">
              <img src={foto} alt={`Foto ${i+1}`} className="h-20 w-20 object-cover rounded-xl border border-zinc-700" />
              <button
                onClick={() => setFotos(f => f.filter((_, idx) => idx !== i))}
                className="absolute -top-1.5 -right-1.5 h-5 w-5 bg-red-500 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
          <button
            onClick={() => fileRef.current?.click()}
            className="h-20 w-20 border-2 border-dashed border-zinc-700 hover:border-zinc-500 rounded-xl flex flex-col items-center justify-center gap-1 text-zinc-500 hover:text-zinc-300 transition-all"
          >
            {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
            <span className="text-[10px]">Adicionar</span>
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={handleFoto}
        />
      </div>

      {/* Observações */}
      <div>
        <label className="block text-xs font-bold uppercase text-zinc-400 mb-2">📝 Observações para o Lab</label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Ex: Ajustar linha média para a direita, reduzir volume no canino superior..."
          rows={3}
          className="w-full px-4 py-3 rounded-xl bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 resize-none"
        />
      </div>

      {/* Decisão */}
      <div>
        <p className="text-xs font-bold uppercase text-zinc-400 mb-3">🎯 Decisão</p>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setDecisao('ajustes')}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              decisao === 'ajustes'
                ? 'border-amber-500 bg-amber-500/10 text-amber-300'
                : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            <RotateCcw className="h-6 w-6" />
            <span className="text-sm font-bold">Precisa de Ajustes</span>
            <span className="text-[10px] text-center opacity-70">Devolver ao laboratório</span>
          </button>
          <button
            onClick={() => setDecisao('aprovado')}
            className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${
              decisao === 'aprovado'
                ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300'
                : 'border-zinc-700 bg-zinc-800/50 text-zinc-400 hover:border-zinc-500'
            }`}
          >
            <CheckCircle2 className="h-6 w-6" />
            <span className="text-sm font-bold">Aprovado!</span>
            <span className="text-[10px] text-center opacity-70">Pode finalizar</span>
          </button>
        </div>
      </div>

      <Button
        onClick={handleEnviar}
        disabled={!decisao || loading}
        className="w-full bg-emerald-600 hover:bg-emerald-500 text-white"
      >
        {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
        Enviar Feedback ao Laboratório
      </Button>
    </div>
  )
}
