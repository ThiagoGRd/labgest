'use client'

import { useCallback, useState } from 'react'
import { UploadCloud, File, X, CheckCircle, AlertCircle, Loader2 } from 'lucide-react'
import { useDropzone } from 'react-dropzone'
import { createClient } from '@/lib/supabase/client'

interface FileUploadProps {
  onUploadComplete: (path: string) => void
  label?: string
}

export function FileUpload({ onUploadComplete, label = "Arquivo STL ou ZIP" }: FileUploadProps) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const [uploadedPath, setUploadedPath] = useState('')

  const onDrop = useCallback((acceptedFiles: File[]) => {
    setError('')
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0])
      handleUpload(acceptedFiles[0])
    }
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
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

  const handleUpload = async (fileToUpload: File) => {
    setUploading(true)
    setProgress(0)

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

      setUploadedPath(data.path)
      onUploadComplete(data.path)
      setProgress(100)
    } catch (err: any) {
      console.error('Upload error:', err)
      setError(err.message || 'Erro ao enviar arquivo')
      setFile(null)
    } finally {
      setUploading(false)
    }
  }

  const removeFile = () => {
    setFile(null)
    setUploadedPath('')
    setError('')
    setProgress(0)
    onUploadComplete('')
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
            
            {uploading ? (
              <Loader2 className="h-5 w-5 text-indigo-600 animate-spin" />
            ) : uploadedPath ? (
              <button 
                onClick={removeFile}
                className="text-slate-400 hover:text-red-500 transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            ) : null}
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

          {error && (
            <p className="text-xs text-red-600 mt-2">{error}</p>
          )}
        </div>
      )}
    </div>
  )
}
