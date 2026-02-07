'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { createOrdem } from '@/actions/ordens'

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

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const result = await createOrdem({
        clienteId: formData.clienteId,
        servicoId: formData.servicoId,
        paciente: formData.paciente,
        dataEntrega: formData.dataEntrega,
        prioridade: formData.prioridade,
        corDentes: formData.corDentes,
        material: formData.material,
        observacoes: formData.observacoes,
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
      } else {
        setError(result.error || 'Erro ao criar ordem')
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado')
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
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Criando...
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
