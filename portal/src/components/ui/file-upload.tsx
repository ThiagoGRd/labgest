'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { UploadCloud, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabase/client'

interface FileUploadProps {
  onUploadComplete: (path: string) => void | Promise<void>
  onStatusChange?: (status: 'idle' | 'uploading' | 'error' | 'complete') => void
  disabled?: boolean
  label?: string
}

export function FileUpload({ onUploadComplete, onStatusChange, disabled = false, label = "Arquivo STL ou ZIP" }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [uploadedPath, setUploadedPath] = useState('')

  const generation = useRef(0)
  useEffect(() => () => { generation.current++ }, [])

  const handleUpload = useCallback(async (fileToUpload: File) => {
    const request = ++generation.current
    setUploadedPath('')
    void onUploadComplete('')
    setUploading(true)
    onStatusChange?.('uploading')

    try {
      const supabase = createClient()
      const fileExt = fileToUpload.name.split('.').pop()
      const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
      const filePath = `uploads/${fileName}`

      const { error: uploadError, data } = await supabase.storage
        .from('lab-files')
        .upload(filePath, fileToUpload, {
          cacheControl: '3600',
          upsert: false,
        })

      if (uploadError) throw uploadError

      if (request !== generation.current) return
      await onUploadComplete(data.path)
      if (request !== generation.current) return
      setUploadedPath(data.path)
      onStatusChange?.('complete')
    } catch (err: unknown) {
      if (request !== generation.current) return
      setError(err instanceof Error ? err.message : 'Erro ao enviar arquivo')
      setFile(null)
      onStatusChange?.('error')
    } finally {
      if (request === generation.current) setUploading(false)
    }
  }, [onUploadComplete, onStatusChange])

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (disabled) return
    setError('')
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      void handleUpload(acceptedFiles[0])
    }
  }, [handleUpload, disabled])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    disabled,
    onDropRejected: () => setError('Selecione um STL, OBJ ou ZIP de até 50MB.'),
    maxFiles: 1,
    accept: {
      'model/stl': ['.stl'],
      'application/vnd.ms-pki.stl': ['.stl'],
      'application/x-stl': ['.stl'],
      'application/octet-stream': ['.stl'],
      'application/zip': ['.zip'],
      'application/x-zip-compressed': ['.zip'],
      'model/obj': ['.obj'],
    },
    maxSize: 50 * 1024 * 1024, // 50MB
  })

  const removeFile = () => {
    if (disabled) return
    generation.current++
    setUploading(false)
    onStatusChange?.('idle')
    setFile(null)
    setUploadedPath('')
    setError('')
    void onUploadComplete('')
  }

  return (
    <div className="w-full">
      <label className="block text-sm font-medium text-slate-700 mb-2">
        {label}
      </label>

      {!file ? (
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
            isDragActive
              ? 'border-indigo-500 bg-indigo-50'
              : 'border-slate-300 hover:border-indigo-400 hover:bg-slate-50'
          }`}
        >
          <input {...getInputProps()} />
          <div className="flex flex-col items-center gap-2">
            <div className="p-3 bg-indigo-100 text-indigo-600 rounded-full">
              <UploadCloud className="h-6 w-6" />
            </div>
            <p className="text-sm font-medium text-slate-900">
              Clique para selecionar ou arraste o arquivo
            </p>
            <p className="text-xs text-slate-500">
              STL, OBJ ou ZIP (máx. 50MB)
            </p>
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 overflow-hidden">
              <div className={`p-2 rounded-lg ${error ? 'bg-red-100 text-red-600' : 'bg-indigo-100 text-indigo-600'}`}>
                {error ? <AlertCircle className="h-5 w-5" /> : <File className="h-5 w-5" />}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900 truncate">
                  {file.name}
                </p>
                <p className="text-xs text-slate-500">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            
            {uploading && <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />}
            <button
              type="button"
              aria-label="Remover arquivo"
              disabled={disabled}
              onClick={removeFile}
              className="text-slate-400 hover:text-red-500 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {(uploading || uploadedPath) && !error && (
            <div className="mt-3">
              <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                <div 
                  className={`h-full transition-all duration-500 ${
                    uploadedPath ? 'bg-emerald-500' : 'bg-indigo-600'
                  }`}
                  style={{ width: `${uploadedPath ? 100 : 50}%` }} // Simulado, pois onUploadProgress não está no client simples
                />
              </div>
              {uploadedPath && (
                <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1">
                  <CheckCircle className="h-3 w-3" />
                  Upload concluído
                </p>
              )}
            </div>
          )}
        </div>
      )}
      {error && (
        <div className="mt-2 text-xs text-red-600">
          <p role="alert">{error}</p>
          <button type="button" disabled={disabled} onClick={removeFile} className="mt-2 underline">
            Descartar anexo
          </button>
        </div>
      )}
    </div>
  )
}
