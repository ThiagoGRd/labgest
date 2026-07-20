'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { salvarFeedbackProva } from '@/actions/ciclos'
import { Button } from '@/components/ui/button'
import {
  Camera,
  CheckCircle2,
  RotateCcw,
  Send,
  Loader2,
  X,
} from 'lucide-react'
import Image from 'next/image'

interface FeedbackProvaProps {
  cicloId: number
  numeroCiclo: number
  onSubmit?: () => void
}

export function FeedbackProva({ cicloId, numeroCiclo, onSubmit }: FeedbackProvaProps) {
  const router = useRouter()
  const [decisao, setDecisao] = useState<'ajustes' | 'aprovado' | null>(null)
  const [observacoes, setObservacoes] = useState('')
  const [fotos, setFotos] = useState<string[]>([])
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)
  const observacaoObrigatoria = decisao === 'ajustes'
  const observacaoAusente = observacaoObrigatoria && !observacoes.trim()

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
    if (observacaoAusente) {
      setError('Descreva o que precisa ser ajustado antes de enviar.')
      return
    }
    setLoading(true)
    setError('')
    try {
      const result = await salvarFeedbackProva(cicloId, observacoes, decisao, fotos)
      if (!result.success) {
        setError(result.error || 'Não foi possível enviar o resultado da prova.')
        return
      }
      setEnviado(true)
      router.refresh()
      onSubmit?.()
    } catch {
      setError('Não foi possível enviar o resultado da prova.')
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
          <p className="font-bold text-slate-900 dark:text-white">Feedback enviado!</p>
          <p className="text-sm text-slate-500 dark:text-zinc-400">O laboratório já foi notificado.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-white/70 p-3 text-sm text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-300">
        <span className="text-lg">📬</span>
        Registre o resultado da prova <strong>#{numeroCiclo}</strong> para o laboratório.
      </div>

      {/* Decisão */}
      <div>
        <p className="mb-3 text-xs font-bold uppercase text-slate-500 dark:text-zinc-400">🎯 Qual foi o resultado?</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => {
              setDecisao('ajustes')
              setError('')
            }}
            className={`flex min-h-24 items-center gap-3 rounded-xl border-2 p-4 text-left transition-all sm:flex-col sm:text-center ${
              decisao === 'ajustes'
                ? 'border-amber-500 bg-amber-100 text-amber-900 dark:bg-amber-500/10 dark:text-amber-300'
                : 'border-slate-200 bg-white text-slate-600 hover:border-amber-400 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400'
            }`}
          >
            <RotateCcw className="h-6 w-6 shrink-0" />
            <span>
              <span className="block text-sm font-bold">Precisa de ajustes</span>
              <span className="block text-[11px] opacity-70">Descrever e devolver ao laboratório</span>
            </span>
          </button>
          <button
            type="button"
            onClick={() => {
              setDecisao('aprovado')
              setError('')
            }}
            className={`flex min-h-24 items-center gap-3 rounded-xl border-2 p-4 text-left transition-all sm:flex-col sm:text-center ${
              decisao === 'aprovado'
                ? 'border-emerald-500 bg-emerald-100 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-300'
                : 'border-slate-200 bg-white text-slate-600 hover:border-emerald-400 dark:border-zinc-700 dark:bg-zinc-800/50 dark:text-zinc-400'
            }`}
          >
            <CheckCircle2 className="h-6 w-6 shrink-0" />
            <span>
              <span className="block text-sm font-bold">Aprovado</span>
              <span className="block text-[11px] opacity-70">O trabalho pode seguir para finalização</span>
            </span>
          </button>
        </div>
      </div>

      {/* Fotos */}
      <div>
        <p className="mb-2 text-xs font-bold uppercase text-slate-500 dark:text-zinc-400">📷 Fotos da Prova <span className="normal-case font-normal">(opcional)</span></p>
        <div className="flex flex-wrap gap-2">
          {fotos.map((foto, i) => (
            <div key={i} className="relative h-20 w-20 group">
              <Image src={foto} alt={`Foto ${i+1}`} fill unoptimized className="rounded-xl border border-slate-200 object-cover dark:border-zinc-700" />
              <button
                type="button"
                aria-label={`Remover foto ${i + 1}`}
                onClick={() => setFotos(f => f.filter((_, idx) => idx !== i))}
                className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-red-500 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100"
              >
                <X className="h-3 w-3 text-white" />
              </button>
            </div>
          ))}
          <button
            type="button"
            aria-label="Adicionar fotos da prova"
            onClick={() => fileRef.current?.click()}
            className="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 transition-all hover:border-slate-500 hover:text-slate-700 dark:border-zinc-700 dark:text-zinc-500 dark:hover:border-zinc-500 dark:hover:text-zinc-300"
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
        <label htmlFor={`observacoes-prova-${cicloId}`} className="mb-2 block text-xs font-bold uppercase text-slate-500 dark:text-zinc-400">
          📝 Observações para o Lab
          {observacaoObrigatoria && <span className="ml-1 text-amber-400">* obrigatório para ajustes</span>}
        </label>
        <textarea
          id={`observacoes-prova-${cicloId}`}
          value={observacoes}
          onChange={(e) => {
            setObservacoes(e.target.value)
            if (error) setError('')
          }}
          placeholder="Ex: Ajustar linha média para a direita, reduzir volume no canino superior..."
          rows={3}
          required={observacaoObrigatoria}
          aria-invalid={Boolean(error) && observacaoAusente}
          aria-describedby={error ? `erro-observacoes-prova-${cicloId}` : undefined}
          className={`w-full resize-none rounded-xl border bg-white px-4 py-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500 ${
            error && observacaoAusente
              ? 'border-red-500 focus:ring-red-500'
              : 'border-slate-300 focus:ring-emerald-500 dark:border-zinc-700'
          }`}
        />
        {observacaoObrigatoria && !error && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">Informe claramente o que o laboratório precisa corrigir.</p>
        )}
        {error && (
          <p id={`erro-observacoes-prova-${cicloId}`} role="alert" className="mt-2 text-xs font-medium text-red-400">{error}</p>
        )}
      </div>

      <div className="sticky bottom-0 z-10 -mx-4 bg-gradient-to-t from-amber-50 via-amber-50 px-4 pb-1 pt-3 dark:from-zinc-950 dark:via-zinc-950 sm:static sm:mx-0 sm:bg-none sm:p-0">
        <Button
          onClick={handleEnviar}
          disabled={!decisao || loading || observacaoAusente}
          className="h-12 w-full bg-emerald-600 text-white hover:bg-emerald-500"
        >
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
          {decisao === 'aprovado' ? 'Aprovar e enviar ao laboratório' : decisao === 'ajustes' ? 'Solicitar ajustes' : 'Enviar decisão ao laboratório'}
        </Button>
      </div>
    </div>
  )
}
