'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Send, MessageSquare, Loader2, Camera, X, ZoomIn } from 'lucide-react'
import { enviarMensagemLab } from '@/actions/mensagens'

interface Mensagem {
  id: string
  role: string
  nome: string
  texto: string
  fotoUrl?: string
  createdAt: string
}

interface ChatOrdemProps {
  ordemId: number
  mensagensIniciais: Mensagem[]
  supabaseUrl?: string
}

async function uploadFotoChatLab(file: File, supabaseUrl: string): Promise<string> {
  // Faz upload via fetch direto para Supabase Storage
  const ext = file.name.split('.').pop() || 'jpg'
  const path = `chat/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
  
  const { createClient } = await import('@supabase/supabase-js')
  const supabase = createClient(
    supabaseUrl,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
  )
  const { error, data } = await supabase.storage
    .from('lab-files')
    .upload(path, file, { cacheControl: '3600', upsert: false })
  if (error) throw error
  const { data: urlData } = supabase.storage.from('lab-files').getPublicUrl(data.path)
  return urlData.publicUrl
}

export function ChatOrdem({ ordemId, mensagensIniciais, supabaseUrl }: ChatOrdemProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>(mensagensIniciais || [])
  const [texto, setTexto] = useState('')
  const [loading, setLoading] = useState(false)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string>('')
  const [fotoUrl, setFotoUrl] = useState<string>('')
  const [fotoUploading, setFotoUploading] = useState(false)
  const [lightbox, setLightbox] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const url = supabaseUrl || process.env.NEXT_PUBLIC_SUPABASE_URL || ''

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const handleSelectFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !file.type.startsWith('image/')) return
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
    setFotoUploading(true)
    try {
      const uploadedUrl = await uploadFotoChatLab(file, url)
      setFotoUrl(uploadedUrl)
    } catch {
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
      const res = await enviarMensagemLab(ordemId, currentText, currentFoto || undefined)
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
      {lightbox && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4 cursor-zoom-out"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="Foto" className="max-w-full max-h-full rounded-xl shadow-2xl" />
          <button className="absolute top-4 right-4 p-2 bg-white/10 rounded-full text-white hover:bg-white/20">
            <X className="h-5 w-5" />
          </button>
        </div>
      )}

      <div className="flex flex-col h-[400px] border border-slate-200 dark:border-zinc-800 rounded-xl overflow-hidden bg-white dark:bg-zinc-900">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex items-center gap-2">
          <MessageSquare className="h-4 w-4 text-emerald-500" />
          <h4 className="text-sm font-bold text-slate-800 dark:text-white">Chat com o Dentista</h4>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {mensagens.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400">
              <MessageSquare className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">Nenhuma mensagem trocada.</p>
            </div>
          ) : (
            mensagens.map(msg => {
              const isLab = msg.role === 'lab'
              return (
                <div key={msg.id} className={`flex flex-col ${isLab ? 'items-end' : 'items-start'}`}>
                  <div className="flex items-center gap-1.5 mb-1">
                    <span className="text-[10px] font-bold text-slate-500">{msg.nome}</span>
                    <span className="text-[9px] text-slate-400">
                      {new Date(msg.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  <div className={`rounded-2xl max-w-[85%] overflow-hidden ${
                    isLab
                      ? 'bg-emerald-500 text-white rounded-tr-sm'
                      : 'bg-slate-100 dark:bg-zinc-800 text-slate-800 dark:text-slate-200 rounded-tl-sm'
                  }`}>
                    {msg.fotoUrl && (
                      <button onClick={() => setLightbox(msg.fotoUrl!)} className="block w-full relative group">
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
                    {msg.texto && <p className="px-4 py-2 text-sm">{msg.texto}</p>}
                  </div>
                </div>
              )
            })
          )}
          <div ref={bottomRef} />
        </div>

        {/* Preview foto pendente */}
        {fotoFile && (
          <div className="px-3 py-2 border-t border-slate-100 dark:border-zinc-800 bg-slate-50 dark:bg-zinc-800/50 flex items-center gap-3">
            <div className="relative h-12 w-12 rounded-lg overflow-hidden bg-slate-200 shrink-0">
              <img src={fotoPreview} alt="Preview" className="object-cover h-full w-full" />
              {fotoUploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/40">
                  <Loader2 className="h-4 w-4 text-white animate-spin" />
                </div>
              )}
            </div>
            <span className="text-xs font-medium text-slate-500 flex-1 truncate">{fotoFile.name}</span>
            <button onClick={removeFoto} className="p-1.5 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-500 hover:text-red-500 transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        )}

        <form onSubmit={handleSend} className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex gap-2">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleSelectFoto}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={loading || fotoUploading || !!fotoFile}
            className="flex items-center justify-center h-10 w-10 rounded-xl border border-slate-200 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800 text-slate-500 hover:text-indigo-600 hover:border-indigo-400 disabled:opacity-40 transition-colors shrink-0"
          >
            <Camera className="h-4 w-4" />
          </button>
          <Input
            value={texto}
            onChange={e => setTexto(e.target.value)}
            placeholder={fotoFile ? 'Adicione uma legenda (opcional)...' : 'Escreva uma mensagem...'}
            className="flex-1 rounded-xl bg-slate-50 dark:bg-zinc-800/50 border-transparent focus:border-indigo-500"
            disabled={loading}
          />
          <Button
            type="submit"
            disabled={(!texto.trim() && !fotoUrl) || loading || fotoUploading}
            className="rounded-xl px-4 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </>
  )
}
