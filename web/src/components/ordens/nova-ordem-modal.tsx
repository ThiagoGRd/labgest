'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Upload, X } from 'lucide-react'
import { createOrdem } from '@/actions/ordens'
import { createClient } from '@/lib/supabase/client'

interface NovaOrdemModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  clientes: { id: number; nome: string }[]
  servicos: { id: number; nome: string; preco: any }[]
}

const cores = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D2', 'D3', 'D4']

export function NovaOrdemModal({ isOpen, onClose, onSuccess, clientes, servicos }: NovaOrdemModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [files, setFiles] = useState<File[]>([])
  const [uploading, setUploading] = useState(false)
  const [formData, setFormData] = useState({
    clienteId: '',
    servicoId: '',
    paciente: '',
    dataEntrega: '',
    prioridade: 'Normal',
    corDentes: '',
    material: '',
    observacoes: '',
  })

  const supabase = createClient()

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    if (error) setError('')
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setFiles(prev => [...prev, ...Array.from(e.target.files!)])
    }
  }

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index))
  }

  const uploadFiles = async () => {
    if (files.length === 0) return []
    
    setUploading(true)
    const uploadedUrls: string[] = []

    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop()
        const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`
        const filePath = `${fileName}`

        const { error: uploadError } = await supabase.storage
          .from('lab-files')
          .upload(filePath, file)

        if (uploadError) throw uploadError

        const { data } = supabase.storage
          .from('lab-files')
          .getPublicUrl(filePath)

        uploadedUrls.push(data.publicUrl)
      }
    } catch (err) {
      console.error('Erro no upload:', err)
      throw new Error('Falha ao enviar arquivos. Tente novamente.')
    } finally {
      setUploading(false)
    }

    return uploadedUrls
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      let uploadedUrls: string[] = []
      
      if (files.length > 0) {
        uploadedUrls = await uploadFiles()
      }

      const result = await createOrdem({
        clienteId: formData.clienteId,
        servicoId: formData.servicoId,
        paciente: formData.paciente,
        dataEntrega: formData.dataEntrega,
        prioridade: formData.prioridade,
        corDentes: formData.corDentes,
        material: formData.material,
        observacoes: formData.observacoes,
        arquivos: uploadedUrls,
      })
      
      if (result.success) {
        onSuccess?.()
        onClose()
        setFormData({
          clienteId: '',
          servicoId: '',
          paciente: '',
          dataEntrega: '',
          prioridade: 'Normal',
          corDentes: '',
          material: '',
          observacoes: '',
        })
        setFiles([])
      } else {
        setError(result.error || 'Erro ao criar ordem')
      }
    } catch (err: any) {
      setError(err.message || 'Ocorreu um erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  const servicoSelecionado = servicos.find(s => s.id.toString() === formData.servicoId)

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Nova Ordem de Serviço"
      description="Preencha os dados para criar uma nova ordem"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cliente */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Dentista *
            </label>
            <Select
              name="clienteId"
              value={formData.clienteId}
              onValueChange={(val) => setFormData(prev => ({ ...prev, clienteId: val }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {clientes.map(c => (
                  <SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Paciente */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nome do Paciente *
            </label>
            <Input
              name="paciente"
              value={formData.paciente}
              onChange={handleChange}
              placeholder="Ex: Maria Silva"
              required
            />
          </div>

          {/* Serviço */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Serviço *
            </label>
            <Select
              name="servicoId"
              value={formData.servicoId}
              onValueChange={(val) => setFormData(prev => ({ ...prev, servicoId: val }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {servicos.map(s => (
                  <SelectItem key={s.id} value={s.id.toString()}>{s.nome} - R$ {Number(s.preco).toFixed(2)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Data Entrega */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Data de Entrega *
            </label>
            <Input
              type="date"
              name="dataEntrega"
              value={formData.dataEntrega}
              onChange={handleChange}
              min={new Date().toISOString().split('T')[0]}
              required
            />
          </div>

          {/* Prioridade */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Prioridade
            </label>
            <Select
              name="prioridade"
              value={formData.prioridade}
              onValueChange={(val) => setFormData(prev => ({ ...prev, prioridade: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Normal" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Baixa">Baixa</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Alta">Alta</SelectItem>
                <SelectItem value="Urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Cor dos Dentes */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Cor dos Dentes
            </label>
            <Select
              name="corDentes"
              value={formData.corDentes}
              onValueChange={(val) => setFormData(prev => ({ ...prev, corDentes: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {cores.map(cor => (
                  <SelectItem key={cor} value={cor}>{cor}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Material */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Material
            </label>
            <Input
              name="material"
              value={formData.material}
              onChange={handleChange}
              placeholder="Ex: PMMA Rosa, Dentes Artiplus..."
            />
          </div>

          {/* Arquivos STL */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Arquivos do Caso (.stl, .obj, .ply)
            </label>
            <div className="border-2 border-dashed border-slate-300 rounded-lg p-4 hover:bg-slate-50 transition-colors text-center cursor-pointer relative">
              <input
                type="file"
                multiple
                accept=".stl,.obj,.ply"
                onChange={handleFileChange}
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
              />
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-8 w-8 text-slate-400" />
                <p className="text-sm text-slate-600">
                  Clique ou arraste arquivos para anexar
                </p>
              </div>
            </div>
            
            {files.length > 0 && (
              <div className="mt-3 space-y-2">
                {files.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-slate-100 p-2 rounded text-sm">
                    <span className="truncate max-w-[90%]">{file.name}</span>
                    <button type="button" onClick={() => removeFile(idx)} className="text-slate-500 hover:text-red-500">
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Observações */}
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Observações
            </label>
            <textarea
              name="observacoes"
              value={formData.observacoes}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Informações adicionais..."
            />
          </div>
        </div>

        {/* Resumo do valor */}
        {servicoSelecionado && (
          <div className="bg-indigo-50 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Valor do Serviço:</span>
              <span className="text-2xl font-bold text-indigo-600">
                R$ {Number(servicoSelecionado.preco).toFixed(2)}
              </span>
            </div>
          </div>
        )}

        {/* Botões */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading || uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {uploading ? 'Enviando arquivos...' : 'Criando...'}
              </>
            ) : (
              'Criar Ordem'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
