'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { updateOrdem } from '@/actions/ordens'

interface Ordem {
  id: number
  paciente: string
  cliente: { nome: string }
  clienteId?: number
  servico: string
  servicoId?: number
  status: string
  prioridade: string
  dataEntrega: string
  etapaAtual: string
  valor: number
  corDentes?: string
  material?: string
  observacoes?: string
}

interface EditarOrdemModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  ordem: Ordem | null
  clientes: { id: number; nome: string }[]
  servicos: { id: number; nome: string; preco: any }[]
}

const cores = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D2', 'D3', 'D4']
const statusOptions = ['Aguardando', 'Em Produção', 'Finalizado', 'Pausado', 'Cancelado']
const etapas = ['Recebimento', 'Modelagem', 'Impressão', 'Acabamento', 'Conferência', 'Pronto para Entrega']

export function EditarOrdemModal({ isOpen, onClose, onSuccess, ordem, clientes, servicos }: EditarOrdemModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    paciente: '',
    dataEntrega: '',
    prioridade: 'Normal',
    status: 'Aguardando',
    etapaAtual: 'Recebimento',
    corDentes: '',
    material: '',
    observacoes: '',
  })

  // Preencher form quando ordem mudar
  useEffect(() => {
    if (ordem) {
      setFormData({
        paciente: ordem.paciente || '',
        dataEntrega: ordem.dataEntrega ? ordem.dataEntrega.split('T')[0] : '',
        prioridade: ordem.prioridade || 'Normal',
        status: ordem.status || 'Aguardando',
        etapaAtual: ordem.etapaAtual || 'Recebimento',
        corDentes: ordem.corDentes || '',
        material: ordem.material || '',
        observacoes: ordem.observacoes || '',
      })
    }
  }, [ordem])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!ordem) return

    setLoading(true)
    setError('')

    try {
      const result = await updateOrdem(ordem.id, {
        paciente: formData.paciente,
        dataEntrega: formData.dataEntrega,
        prioridade: formData.prioridade,
        status: formData.status,
        etapaAtual: formData.etapaAtual,
        corDentes: formData.corDentes,
        material: formData.material,
        observacoes: formData.observacoes,
      })

      if (result.success) {
        onSuccess?.()
        onClose()
      } else {
        setError(result.error || 'Erro ao atualizar ordem')
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  if (!ordem) return null

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Editar Ordem #${ordem.id}`}
      description="Altere os dados da ordem de serviço"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {/* Info fixa (não editável) */}
        <div className="bg-slate-50 rounded-lg p-4 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Dentista:</span>
            <span className="font-medium text-slate-900">{ordem.cliente.nome}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-slate-500">Serviço:</span>
            <span className="font-medium text-slate-900">{ordem.servico}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
              required
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Status
            </label>
            <Select
              name="status"
              value={formData.status}
              onValueChange={(val) => setFormData(prev => ({ ...prev, status: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Etapa Atual */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Etapa Atual
            </label>
            <Select
              name="etapaAtual"
              value={formData.etapaAtual}
              onValueChange={(val) => setFormData(prev => ({ ...prev, etapaAtual: val }))}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {etapas.map(e => (
                  <SelectItem key={e} value={e}>{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
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

        {/* Botões */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Alterações'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
