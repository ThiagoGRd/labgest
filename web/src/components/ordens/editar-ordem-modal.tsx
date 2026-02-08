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

  useEffect(() => {
    if (ordem) {
      setFormData({
        paciente: ordem.paciente || '',
        dataEntrega: ordem.dataEntrega ? new Date(ordem.dataEntrega).toISOString().split('T')[0] : '',
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
      description="Alteração das especificações do caso"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
            {error}
          </div>
        )}

        <div className="bg-slate-50 dark:bg-black/20 border border-black/5 dark:border-white/5 rounded-xl p-5 space-y-3">
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
            <span className="text-slate-400">Dentista</span>
            <span className="text-slate-900 dark:text-white">{ordem.cliente.nome}</span>
          </div>
          <div className="flex justify-between items-center text-xs font-bold uppercase tracking-widest">
            <span className="text-slate-400">Serviço</span>
            <span className="text-slate-900 dark:text-white">{ordem.servico}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Paciente</label>
            <Input
              name="paciente"
              value={formData.paciente}
              onChange={handleChange}
              className="h-11 rounded-xl"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Data de Entrega</label>
            <Input
              type="date"
              name="dataEntrega"
              value={formData.dataEntrega}
              onChange={handleChange}
              className="h-11 rounded-xl"
              required
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Status</label>
            <Select name="status" value={formData.status} onValueChange={(val) => setFormData(p => ({ ...p, status: val }))}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {statusOptions.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Etapa Atual</label>
            <Select name="etapaAtual" value={formData.etapaAtual} onValueChange={(val) => setFormData(p => ({ ...p, etapaAtual: val }))}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                {etapas.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Prioridade</label>
            <Select name="prioridade" value={formData.prioridade} onValueChange={(val) => setFormData(p => ({ ...p, prioridade: val }))}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="Baixa">Baixa</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Alta">Alta</SelectItem>
                <SelectItem value="Urgente">Urgente</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Cor dos Dentes</label>
            <Select name="corDentes" value={formData.corDentes} onValueChange={(val) => setFormData(p => ({ ...p, corDentes: val }))}>
              <SelectTrigger className="h-11 rounded-xl"><SelectValue placeholder="Selecione..." /></SelectTrigger>
              <SelectContent>
                {cores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Material</label>
            <Input name="material" value={formData.material} onChange={handleChange} className="h-11 rounded-xl" />
          </div>

          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">Observações</label>
            <textarea
              name="observacoes"
              value={formData.observacoes}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-xl border border-slate-300 dark:border-white/10 bg-white dark:bg-black/20 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-black/5 dark:border-white/5">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl px-6">Cancelar</Button>
          <Button type="submit" disabled={loading} className="rounded-xl px-8 bg-indigo-600 hover:bg-indigo-700 text-white font-bold">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Salvar Alterações'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
