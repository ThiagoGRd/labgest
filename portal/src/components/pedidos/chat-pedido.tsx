'use client'

import { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Send, MessageSquare, Loader2, Camera, X, ZoomIn } from 'lucide-react'
import { enviarMensagem } from '@/actions/mensagens'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import { useMessageSync } from '@/lib/use-message-sync'
import { mergeMessages } from '@/lib/message-sync'

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

export function ChatPedido(props: ChatPedidoProps) {
  return <ChatPedidoContent key={props.ordemId} {...props} />
}

function ChatPedidoContent({ ordemId, mensagensIniciais }: ChatPedidoProps) {
  const [mensagens, setMensagens] = useState<Mensagem[]>(mensagensIniciais || [])
  useMessageSync(ordemId, mensagens, setMensagens)
  const [texto, setTexto] = useState('')
  const requestRef = useRef<{ signature: string; id: string } | null>(null)
  const [loading, setLoading] = useState(false)
  // foto pendente (preview local + URL pós-upload)
  const [fotoFile, setFotoFile] = useState<File | null>(null)
  const [fotoPreview, setFotoPreview] = useState<string>('')
  const [fotoUrl, setFotoUrl] = useState<string>('')
  const [fotoUploading, setFotoUploading] = useState(false)
  const [fotoError, setFotoError] = useState('')
  // lightbox
  const [sendError, setSendError] = useState('')
  const uploadGeneration = useRef(0)
  const sending = useRef(false)
  useEffect(() => () => { uploadGeneration.current++ }, [])
  useEffect(() => () => { if (fotoPreview) URL.revokeObjectURL(fotoPreview) }, [fotoPreview])
  const [lightbox, setLightbox] = useState<string | null>(null)

  const bottomRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [mensagens])

  const handleSelectFoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (sending.current) return
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setFotoError('Selecione apenas imagens.')
      return
    }
    const request = ++uploadGeneration.current
    setFotoUrl('')
    setFotoFile(file)
    setFotoPreview(URL.createObjectURL(file))
    setFotoError('')
    setFotoUploading(true)
    try {
      const url = await uploadFotoChat(file)
      if (request !== uploadGeneration.current) return
      setFotoUrl(url)
    } catch {
      if (request !== uploadGeneration.current) return
      setFotoError('Erro ao enviar imagem. Tente novamente.')
      setFotoFile(null)
      setFotoPreview('')
      if (fileInputRef.current) fileInputRef.current.value = ''
    } finally {
      if (request === uploadGeneration.current) setFotoUploading(false)
    }
  }

  const removeFoto = () => {
    uploadGeneration.current++
    setFotoUploading(false)
    setFotoFile(null)
    setFotoPreview('')
    setFotoUrl('')
    setFotoError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if ((!texto.trim() && !fotoUrl) || sending.current || fotoUploading || !!fotoError) return

    sending.current = true
    setLoading(true)
    setSendError('')
    const currentText = texto
    const currentFoto = fotoUrl


    try {
      const signature = JSON.stringify([currentText, currentFoto])
      if (requestRef.current?.signature !== signature) requestRef.current = { signature, id: crypto.randomUUID() }
      const res = await enviarMensagem(ordemId, currentText, currentFoto || undefined, requestRef.current.id)
      if (!res.success || !res.mensagem) {
        setSendError(res.error || 'Não foi possível enviar a mensagem. Tente novamente.')
        return
      }
      setTexto('')
        requestRef.current = null
      removeFoto()
      if (res.mensagem) {
        setMensagens(prev => mergeMessages(prev, [res.mensagem as Mensagem]))
      }
    } catch (error) {
      setSendError(error instanceof Error ? error.message : 'Não foi possível enviar a mensagem. Tente novamente.')
    } finally {
      sending.current = false
      setLoading(false)
    }
  }

  return (
    <>
      {/* Lightbox */}
      {lightbox && (
        <Modal
          isOpen
          onClose={() => setLightbox(null)}
          title="Foto da conversa"
          description="Visualização ampliada"
          size="2xl"
          tone="dark"
          mobileFullscreen
        >
          <div className="flex min-h-[50dvh] items-center justify-center">
            <Image
              src={lightbox}
              alt="Foto ampliada da conversa"
              width={1200}
              height={900}
              unoptimized
              className="max-h-[72dvh] w-auto max-w-full rounded-xl object-contain shadow-2xl"
            />
          </div>
        </Modal>
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
                        <Image
                          src={msg.fotoUrl}
                          alt="Foto do caso"
                          width={240}
                          height={180}
                          unoptimized
                          className="max-h-[180px] w-full max-w-[240px] rounded-t-2xl object-cover"
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
                <Image src={fotoPreview} alt="Preview" fill unoptimized className="object-cover" />
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
              <button type="button" disabled={loading} onClick={removeFoto} className="p-1.5 rounded-full bg-slate-200 dark:bg-zinc-700 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors shrink-0">
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

        {fotoError && (
          <div className="px-3 text-sm text-red-600">
            <p role="alert">{fotoError}</p>
            <button type="button" disabled={loading} onClick={removeFoto} className="underline">Descartar anexo</button>
          </div>
        )}
        {sendError && <p role="alert" className="px-3 text-sm text-red-600">{sendError}</p>}

        {/* Campo de texto + botões */}
        <form onSubmit={handleSend} className="p-3 border-t border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex gap-2">
          {/* Input hidden para câmera */}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            disabled={loading}
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
            disabled={(!texto.trim() && !fotoUrl) || loading || fotoUploading || !!fotoError}
            className="rounded-xl px-4 bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </form>
      </div>
    </>
  )
}
