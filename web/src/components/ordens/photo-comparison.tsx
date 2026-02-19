'use client'

import { useState, useRef } from 'react'
import { Upload, X, ZoomIn, ZoomOut, RotateCcw, Check, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { uploadFotoProva } from '@/actions/ordens'

interface PhotoComparisonProps {
  ordemId: number
  numeroProva: number
  fotosExistentes?: any[]
  onSuccess?: () => void
}

interface ChecklistItem {
  key: string
  label: string
  checked: boolean
}

const CHECKLIST_DENTISTA: ChecklistItem[] = [
  { key: 'dvo', label: 'DVO (Dimensão Vertical de Oclusão) está correta', checked: false },
  { key: 'linha_media', label: 'Linha média centralizada', checked: false },
  { key: 'corredor_bucal', label: 'Corredor bucal adequado', checked: false },
  { key: 'contorno_gengival', label: 'Contorno gengival harmonioso', checked: false },
  { key: 'contato_occlusal', label: 'Contatos oclusais adequados', checked: false },
  { key: 'estetica_sorriso', label: 'Estética do sorriso aprovada', checked: false },
  { key: 'fonetica', label: 'Fonética testada e aprovada', checked: false },
]

export function PhotoComparison({ ordemId, numeroProva, fotosExistentes = [], onSuccess }: PhotoComparisonProps) {
  const [foto1, setFoto1] = useState<string | null>(fotosExistentes.find(f => f.numeroProva === numeroProva - 1)?.url || null)
  const [foto2, setFoto2] = useState<string | null>(null)
  const [zoom, setZoom] = useState(100)
  const [rotation, setRotation] = useState(0)
  const [checklist, setChecklist] = useState(CHECKLIST_DENTISTA)
  const [observacoes, setObservacoes] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const fileInputRef1 = useRef<HTMLInputElement>(null)
  const fileInputRef2 = useRef<HTMLInputElement>(null)

  const handleUpload = async (file: File, isFoto1: boolean) => {
    setLoading(true)
    setError('')
    
    // Upload para Supabase Storage
    const { createClient } = await import('@/lib/supabase/client')
    const supabase = createClient()
    
    const fileName = `prova-${numeroProva}-${isFoto1 ? 'antes' : 'depois'}-${Date.now()}-${file.name}`
    const { data, error: uploadError } = await supabase.storage
      .from('ordens')
      .upload(`fotos-prova/${fileName}`, file)

    if (uploadError) {
      setError('Erro ao fazer upload: ' + uploadError.message)
      setLoading(false)
      return
    }

    const { data: urlData } = supabase.storage.from('ordens').getPublicUrl(`fotos-prova/${fileName}`)
    const fotoUrl = urlData.publicUrl

    if (isFoto1) {
      setFoto1(fotoUrl)
      await uploadFotoProva(ordemId, fotoUrl, numeroProva - 1, 'Foto de referência')
    } else {
      setFoto2(fotoUrl)
      await uploadFotoProva(ordemId, fotoUrl, numeroProva, `Prova ${numeroProva}`)
    }

    setLoading(false)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>, isFoto1: boolean) => {
    const file = e.target.files?.[0]
    if (file) handleUpload(file, isFoto1)
  }

  const handleChecklistChange = (index: number) => {
    const newChecklist = [...checklist]
    newChecklist[index].checked = !newChecklist[index].checked
    setChecklist(newChecklist)
  }

  const allChecked = checklist.every(item => item.checked)
  const aprovacaoParcial = checklist.filter(item => item.checked).length

  const handleSubmitAprovacao = async () => {
    if (!allChecked && !observacoes.trim()) {
      setError('Marque todos os itens do checklist ou adicione observações sobre os itens não aprovados')
      return
    }

    setLoading(true)
    // Aqui você pode chamar uma action para salvar a aprovação do dentista
    console.log('Aprovação enviada:', { ordemId, numeroProva, checklist, observacoes })
    
    // Simular sucesso
    setTimeout(() => {
      setLoading(false)
      onSuccess?.()
      alert('Aprovação enviada com sucesso!')
    }, 1000)
  }

  const resetView = () => {
    setZoom(100)
    setRotation(0)
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 rounded-xl">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Área de Upload */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Foto 1 - Referência */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            {numeroProva > 1 ? `Prova ${numeroProva - 1} (Referência)` : 'Foto de Referência'}
          </label>
          <div
            onClick={() => !foto1 && fileInputRef1.current?.click()}
            className={`relative aspect-square rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
              foto1
                ? 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20'
                : 'border-slate-300 dark:border-white/20 hover:border-indigo-400 dark:hover:border-indigo-500'
            }`}
          >
            {foto1 ? (
              <img
                src={foto1}
                alt="Prova anterior"
                className="w-full h-full object-cover rounded-2xl"
                style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)`, transformOrigin: 'center' }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                <Upload className="h-8 w-8 mb-2" />
                <span className="text-xs font-medium">Clique para upload</span>
              </div>
            )}
            <input
              ref={fileInputRef1}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileSelect(e, true)}
              className="hidden"
            />
            {foto1 && (
              <button
                onClick={(e) => { e.stopPropagation(); setFoto1(null) }}
                className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Foto 2 - Prova Atual */}
        <div className="space-y-2">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Prova {numeroProva} (Atual)
          </label>
          <div
            onClick={() => !foto2 && fileInputRef2.current?.click()}
            className={`relative aspect-square rounded-2xl border-2 border-dashed transition-all cursor-pointer ${
              foto2
                ? 'border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/20'
                : 'border-slate-300 dark:border-white/20 hover:border-indigo-400 dark:hover:border-indigo-500'
            }`}
          >
            {foto2 ? (
              <img
                src={foto2}
                alt="Prova atual"
                className="w-full h-full object-cover rounded-2xl"
                style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)`, transformOrigin: 'center' }}
              />
            ) : (
              <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
                <Upload className="h-8 w-8 mb-2" />
                <span className="text-xs font-medium">Clique para upload</span>
              </div>
            )}
            <input
              ref={fileInputRef2}
              type="file"
              accept="image/*"
              onChange={(e) => handleFileSelect(e, false)}
              className="hidden"
            />
            {foto2 && (
              <button
                onClick={(e) => { e.stopPropagation(); setFoto2(null) }}
                className="absolute top-2 right-2 p-1.5 bg-red-500 hover:bg-red-600 text-white rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Controles de Zoom */}
      {(foto1 || foto2) && (
        <div className="flex items-center gap-3 p-3 bg-slate-50 dark:bg-black/20 rounded-xl">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.max(50, zoom - 25))}
            className="h-8 w-8 p-0"
          >
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="text-xs font-bold text-slate-600 dark:text-slate-400 min-w-[3ch] text-center">
            {zoom}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setZoom(Math.min(200, zoom + 25))}
            className="h-8 w-8 p-0"
          >
            <ZoomIn className="h-4 w-4" />
          </Button>
          <div className="flex-1" />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setRotation((rotation + 90) % 360)}
            className="h-8 w-8 p-0"
          >
            <RotateCcw className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={resetView}
            className="h-8 px-3"
          >
            Reset
          </Button>
        </div>
      )}

      {/* Checklist */}
      <div className="p-5 bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Checklist de Aprovação
          </label>
          <span className={`text-xs font-bold ${
            allChecked
              ? 'text-emerald-600 dark:text-emerald-400'
              : 'text-slate-500'
          }`}>
            {aprovacaoParcial}/{checklist.length} itens
          </span>
        </div>
        {checklist.map((item, index) => (
          <label
            key={item.key}
            className="flex items-start gap-3 cursor-pointer group"
          >
            <Checkbox
              checked={item.checked}
              onCheckedChange={() => handleChecklistChange(index)}
            />
            <span className={`text-sm font-medium transition-colors ${
              item.checked
                ? 'text-emerald-700 dark:text-emerald-400 line-through opacity-70'
                : 'text-slate-700 dark:text-slate-300 group-hover:text-slate-900'
            }`}>
              {item.label}
            </span>
          </label>
        ))}
      </div>

      {/* Observações */}
      <div className="space-y-2">
        <label className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Observações (opcional)
        </label>
        <textarea
          value={observacoes}
          onChange={(e) => setObservacoes(e.target.value)}
          placeholder="Descreva ajustes necessários, problemas encontrados, ou comentários..."
          rows={4}
          className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
      </div>

      {/* Botão de Submit */}
      <div className="flex gap-3 justify-end pt-4 border-t border-black/5 dark:border-white/5">
        <Button
          type="button"
          variant="outline"
          onClick={() => {
            setFoto1(null)
            setFoto2(null)
            setChecklist(CHECKLIST_DENTISTA)
            setObservacoes('')
            setError('')
          }}
          className="rounded-xl"
        >
          Limpar
        </Button>
        <Button
          type="button"
          onClick={handleSubmitAprovacao}
          disabled={loading || (!foto2 && checklist.every(i => !i.checked))}
          className={`rounded-xl gap-2 ${
            allChecked
              ? 'bg-emerald-600 hover:bg-emerald-700 text-white'
              : 'bg-indigo-600 hover:bg-indigo-700 text-white'
          }`}
        >
          {loading ? (
            <span className="animate-spin">⏳</span>
          ) : allChecked ? (
            <>
              <Check className="h-4 w-4" />
              Aprovar Prova
            </>
          ) : (
            <>
              <AlertCircle className="h-4 w-4" />
              Enviar com Observações
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
