'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { createServico } from '@/actions/servicos'

interface NovoServicoModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const categorias = [
  'Prótese Total',
  'Parcial Removível',
  'Protocolo',
  'Provisório',
  'Ponte Adesiva',
  'Geral',
]

export default function NovaServicoModal({ isOpen, onClose, onSuccess }: NovoServicoModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    nome: '',
    categoria: '',
    preco: '',
    tempoProducao: '',
    custoMateriais: '',
    descricao: '',
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
      const result = await createServico({
        nome: formData.nome,
        categoria: formData.categoria,
        preco: Number(formData.preco),
        tempoProducao: Number(formData.tempoProducao) || 0,
        custoMateriais: Number(formData.custoMateriais) || 0,
        descricao: formData.descricao,
      })
      
      if (result.success) {
        onSuccess?.()
        onClose()
        setFormData({ nome: '', categoria: '', preco: '', tempoProducao: '', custoMateriais: '', descricao: '' })
      } else {
        setError(result.error || 'Erro ao criar serviço')
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  const preco = parseFloat(formData.preco) || 0
  const custo = parseFloat(formData.custoMateriais) || 0
  const margem = preco > 0 ? ((preco - custo) / preco * 100).toFixed(1) : '0'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Novo Serviço"
      description="Cadastre um novo tipo de serviço"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Nome do Serviço *
          </label>
          <Input
            name="nome"
            value={formData.nome}
            onChange={handleChange}
            placeholder="Ex: Prótese Total Superior"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Categoria *
            </label>
            <Select
              name="categoria"
              value={formData.categoria}
              onValueChange={(val) => setFormData(prev => ({ ...prev, categoria: val }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {categorias.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Tempo de Produção (dias)
            </label>
            <Input
              type="number"
              name="tempoProducao"
              value={formData.tempoProducao}
              onChange={handleChange}
              placeholder="7"
              min="1"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Preço de Venda (R$) *
            </label>
            <Input
              type="number"
              name="preco"
              value={formData.preco}
              onChange={handleChange}
              placeholder="850.00"
              step="0.01"
              min="0"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Custo de Materiais (R$)
            </label>
            <Input
              type="number"
              name="custoMateriais"
              value={formData.custoMateriais}
              onChange={handleChange}
              placeholder="320.00"
              step="0.01"
              min="0"
            />
          </div>
        </div>

        {preco > 0 && (
          <div className="p-4 bg-emerald-50 rounded-lg">
            <div className="flex justify-between items-center">
              <span className="text-slate-600">Margem de Lucro Calculada:</span>
              <span className={`text-xl font-bold ${parseFloat(margem) >= 50 ? 'text-emerald-600' : 'text-amber-600'}`}>
                {margem}%
              </span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Descrição
          </label>
          <textarea
            name="descricao"
            value={formData.descricao}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Descrição detalhada do serviço..."
          />
        </div>

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
              'Cadastrar Serviço'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
