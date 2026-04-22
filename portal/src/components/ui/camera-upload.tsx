'use client'

import { useState, useRef } from 'react'
import { Camera, FileImage, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from './button'

interface CameraUploadProps {
  onUploadComplete: (path: string) => void
  label?: string
  instruction?: string
}

export function CameraUpload({ 
  onUploadComplete, 
  label = "Tirar Foto do Caso",
  instruction = "Para evitar distorção no tamanho do dente, recomendamos usar a câmera com Zoom 2x e boa iluminação."
}: CameraUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<string>('')
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [uploadedPath, setUploadedPath] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setError('')
    const selectedFile = e.target.files?.[0]
    
    if (selectedFile) {
      // Validate image
      if (!selectedFile.type.startsWith('image/')) {
        setError('Por favor, selecione ou tire apenas imagens.')
        return
      }

      setFile(selectedFile)
      setPreview(URL.createObjectURL(selectedFile))
      await handleUpload(selectedFile)
    }
  }

  const handleUpload = async (fileToUpload: File) => {
    setUploading(true)

    try {
      const supabase = createClient()
      const fileExt = fileToUpload.name.split('.').pop() || 'jpg'
      const fileName = `foto_${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `uploads/fotos/${fileName}`

      const { error: uploadError, data } = await supabase.storage
        .from('lab-files')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      setUploadedPath(data.path)
      onUploadComplete(data.path)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Erro ao enviar a imagem')
      setFile(null)
      setPreview('')
    } finally {
      setUploading(false)
    }
  }

  const removeFile = () => {
    setFile(null)
    setPreview('')
    setUploadedPath('')
    setError('')
    onUploadComplete('')
    if (inputRef.current) inputRef.current.value = ''
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">
        {label}
      </label>

      {/* Instructions Tip */}
      {instruction && !file && (
        <div className="mb-3 p-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg flex items-start gap-3">
          <Camera className="h-5 w-5 text-amber-600 dark:text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm font-medium text-amber-800 dark:text-amber-400">
            {instruction}
          </p>
        </div>
      )}

      {/* Hidden file input configured for back camera */}
      <input 
        type="file"
        accept="image/*"
        capture="environment"
        ref={inputRef}
        onChange={handleFileChange}
        className="hidden"
      />

      {!file ? (
        <Button 
          type="button"
          onClick={() => inputRef.current?.click()}
          className="w-full h-24 border-2 border-dashed border-slate-300 dark:border-zinc-700 bg-slate-50 dark:bg-zinc-800/50 hover:bg-slate-100 hover:border-indigo-400 dark:hover:bg-zinc-800 dark:hover:border-indigo-500 transition-colors flex flex-col items-center justify-center gap-2 text-slate-600 dark:text-slate-400"
          variant="ghost"
        >
          <Camera className="h-7 w-7 text-indigo-500" />
          <span className="text-sm font-medium">Tirar Foto do Caso</span>
        </Button>
      ) : (
        <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 rounded-xl p-3 overflow-hidden relative">
          <div className="flex items-center justify-between z-10 relative">
            <div className="flex items-center gap-3">
              {preview ? (
                <div className="h-12 w-12 rounded-lg bg-black overflow-hidden flex items-center justify-center shrink-0">
                   <img src={preview} alt="Preview" className="object-cover h-full w-full opacity-90" />
                </div>
              ) : (
                <div className={`p-3 rounded-lg ${error ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                  {error ? <AlertCircle className="h-6 w-6" /> : <FileImage className="h-6 w-6" />}
                </div>
              )}
              
              <div className="min-w-0 pr-4">
                <p className="text-sm font-bold text-slate-900 dark:text-white truncate">
                  {file.name}
                </p>
                <div className="flex items-center gap-2 mt-1">
                  {uploading ? (
                    <span className="text-xs text-indigo-600 dark:text-indigo-400 flex items-center gap-1 font-medium">
                      <Loader2 className="h-3 w-3 animate-spin" /> Enviando...
                    </span>
                  ) : uploadedPath ? (
                    <span className="text-xs text-emerald-600 dark:text-emerald-400 flex items-center gap-1 font-medium">
                      <CheckCircle className="h-3 w-3" /> Concluído
                    </span>
                  ) : error ? (
                    <span className="text-xs text-red-600 font-medium">Erro no envio</span>
                  ) : null}
                </div>
              </div>
            </div>
            
            {(!uploading) && (
              <button 
                onClick={removeFile}
                className="h-8 w-8 flex items-center justify-center rounded-full bg-slate-100 dark:bg-zinc-800 text-slate-500 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-500/10 transition-colors"
                title="Remover Imagem"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
          
          {error && (
            <div className="mt-3 p-2 bg-red-50 dark:bg-red-500/10 rounded border border-red-100 dark:border-red-500/20 text-xs text-red-600 dark:text-red-400">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
