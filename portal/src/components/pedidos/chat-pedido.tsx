'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, MessageSquare, Loader2, Camera, X, Image as ImageIcon, ZoomIn } from 'lucide-react'
import { enviarMensagem } from '@/actions/mensagens'
import { createClient } from '@/lib/supabase/client'

interface Mensagem {
  id: string
  role: string
  nome: string
  texto: string
  fotoUrl?: string
  createdAt: string
}

interface ChatPedidoProps {
  ordemId: number
  mensagensIniciais: Mensagem[]
  dentistaNome: string
}

// Faz upload direto ao Supabase Storage e retorna a URL pública
async function uploadFotoChat(file: File): Promise<string> {
  const supabase = createClient()
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `chat/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  const { error, data } = await supabase.storage
    .from('lab-files')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  const { data: urlData } = supabase.storage.from('lab-files').getPublicUrl(data.path)
  return urlData.publicUrl
}

export function ChatPedido({ ordemId, mensagensIniciais, dentistaNome }: ChatPedidoProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>(mensagensIniciais || [])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)
  // foto pendente (preview local + URL pós-upload)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string>('')
  const [fotoUrl, setFotoUrl] = useState<string>('')
  const [fotoUploading, setFotoUploading] = useState(false)
  const [fotoError, setFotoError] = useState('')
  // lightbox
  const [lightbox, setLightbox] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const handleSelectFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setFotoError('Selecione apenas imagens.')
      return
    }
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
    setFotoError('')
    setFotoUploading(true)
    try {
      const url = await uploadFotoChat(file)
      setFotoUrl(url)
    } catch (err: any) {
      setFotoError('Erro ao enviar imagem. Tente novamente.')
      setFotoFile(null)
      setFotoPreview('')
    } finally {
      setFotoUploading(false)
    }
  }

  const removeFoto = () => {
    setFotoFile(null)
    setFotoPreview('')
    setFotoUrl('')
    setFotoError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!texto.trim() && !fotoUrl) || loading || fotoUploading) return

    setLoading(true)
    const currentText = texto
    const currentFoto = fotoUrl
    setTexto('')
    removeFoto()

    try {
      const res = await enviarMensagem(ordemId, currentText, currentFoto || undefined)
      if (res.success && res.mensagem) {
        setMensagens(prev => [...prev, res.mensagem as Mensagem])
      }
    } catch (error) {
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Foto ampliada" className="max-w-full max-h-full rounded-xl shadow-2xl" />
          <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="flex flex-col h-[420px] border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
        {/* Header */}
        <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-emerald-500" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-white">Mensagens da Ordem</h4>
          <span className="text-[10px] font-medium text-slate-400 ml-auto">📸 Você pode enviar fotos aqui</span>
        </div>

        {/* Mensagens */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mensagens.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Nenhuma mensagem neste caso.</p>
              <p className="text-xs">Use o chat para falar com o laboratório.</p>
            </div>
          ) : (
            mensagens.map(msg => {
              const isDentista = msg.role === 'dentista'
              return (
                <div key={msg.id} className={`flex flex-col ${isDentista ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold text-slate-500">{msg.nome}</span>
                    <span className="text-[9px] text-slate-400">
                      {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`rounded-2xl max-w-[85%] overflow-hidden ${
                    isDentista
                      ? 'bg-emerald-500 text-white rounded-tr-sm'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                  }`}>
                    {/* Imagem dentro da bolha */}
                    {msg.fotoUrl && (
                      <button
                        onClick={() => setLightbox(msg.fotoUrl!)}
                        className="block w-full relative group"
                      >
                        <img
                          src={msg.fotoUrl}
                          alt="Foto do caso"
                          className="w-full max-w-[240px] object-cover rounded-t-2xl"
                          style={{ maxHeight: 180 }}
                        />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                          <ZoomIn className="h-6 w-6 text-white drop-shadow-lg" />
                        </div>
                      </button>
                    )}
                    {/* Texto (só renderiza se não estiver vazio) */}
                    {msg.texto && (
                      <p className="px-4 py-2 text-sm">{msg.texto}</p>
                    )}
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Preview da foto pendente */}
        {fotoFile && (
          <div className="px-3 py-2 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50">
            <div className="flex items-center gap-3">
              <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-slate-200 dark:bg-zinc-700 shrink-0">
                <img src={fotoPreview} alt="Preview" className="object-cover h-full w-full" />
                {fotoUploading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                    <Loader2 className="h-4 w-4 text-white animate-spin" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-bold text-slate-700 dark:text-slate-300 truncate">{fotoFile.name}</p>
                {fotoUploading ? (
                  <p className="text-[10px] text-indigo-500 mt-0.5">Enviando...</p>
                ) : fotoError ? (
                  <p className="text-[10px] text-red-500 mt-0.5">{fotoError}</p>
                ) : (
                  <p className="text-[10px] text-emerald-500 mt-0.5">Pronto para enviar</p>
                )}
              </div>
              <button onClick={removeFoto} className="p-1.5 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Dica de câmera (Zoom 2x) — só aparece quando não há foto pendente */}
        {!fotoFile && (
          <div className="px-3 pb-1">
            <p className="text-[10px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 px-2 py-1 rounded-lg">
              📷 Para fotos de prova: use <strong>Zoom 2x</strong> e boa iluminação
            </p>
          </div>
        )}

        {/* Campo de texto + botões */}
        <form onSubmit={handleSend} className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex gap-2">
          {/* Input hidden para câmera */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            ref={fileInputRef}
            onChange={handleSelectFoto}
            className="hidden"
          />

          {/* Botão câmera */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || fotoUploading || !!fotoFile}
            title="Tirar foto com câmera traseira"
            className="flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-500 hover:text-emerald-600 hover:border-emerald-400 disabled:opacity-40 transition-colors shrink-0"
          >
            <Camera className="h-4 w-4" />
          </button>

          <Input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder={fotoFile ? 'Adicione uma legenda (opcional)...' : 'Escreva uma mensagem...'}
            className="flex-1 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border-transparent focus:border-emerald-500"
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={(!texto.trim() && !fotoUrl) || loading || fotoUploading}
            className="rounded-xl px-4 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </>
  )
}
