'use client'

import { useState, useEffect } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { createConta } from '@/actions/financeiro'

interface NovaContaModalProps {
  isOpen: boolean
  onClose: () => void
  tipoInicial?: 'receber' | 'pagar'
  onSuccess?: () => void
}

const categoriasPagar = ['Material', 'Fixo', 'Manutenção', 'Impostos', 'Salários', 'Marketing', 'Outros']
const categoriasReceber = ['Serviço', 'Consultoria', 'Outros']
const clientes = ['Dr. João Santos', 'Dra. Ana Lima', 'Dr. Paulo Costa', 'Dra. Carla Melo']

export function NovaContaModal({ isOpen, onClose, tipoInicial = 'receber', onSuccess }: NovaContaModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [tipo, setTipo] = useState(tipoInicial)
  const [formData, setFormData] = useState({
    descricao: '',
    valor: '',
    vencimento: '',
    cliente: '',
    categoria: '',
    observacoes: '',
    recorrente: false,
  })

  useEffect(() => {
    if (isOpen) setTipo(tipoInicial)
  }, [isOpen, tipoInicial])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const result = await createConta({
        tipo,
        descricao: formData.descricao,
        valor: Number(formData.valor),
        vencimento: formData.vencimento,
        cliente: formData.cliente,
        categoria: formData.categoria,
        observacoes: formData.observacoes,
      })
      
      if (result.success) {
        onSuccess?.()
        onClose()
        setFormData({
          descricao: '',
          valor: '',
          vencimento: '',
          cliente: '',
          categoria: '',
          observacoes: '',
          recorrente: false,
        })
      } else {
        setError(result.error || 'Erro ao criar conta')
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={tipo === 'receber' ? 'Nova Conta a Receber' : 'Nova Conta a Pagar'}
      description={tipo === 'receber' ? 'Cadastre um novo recebimento' : 'Cadastre uma nova despesa'}
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        {/* Toggle Tipo */}
        <div className="flex bg-slate-100 p-1 rounded-lg mb-4">
          <button
            type="button"
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
              tipo === 'receber' 
                ? 'bg-white text-emerald-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setTipo('receber')}
          >
            A Receber
          </button>
          <button
            type="button"
            className={`flex-1 py-1.5 text-sm font-medium rounded-md transition-all ${
              tipo === 'pagar' 
                ? 'bg-white text-red-600 shadow-sm' 
                : 'text-slate-500 hover:text-slate-700'
            }`}
            onClick={() => setTipo('pagar')}
          >
            A Pagar
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Descrição *
          </label>
          <Input
            name="descricao"
            value={formData.descricao}
            onChange={handleChange}
            placeholder="Ex: OS #123 ou Compra de Material"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Valor (R$) *
            </label>
            <Input
              type="number"
              name="valor"
              value={formData.valor}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Vencimento *
            </label>
            <Input
              type="date"
              name="vencimento"
              value={formData.vencimento}
              onChange={handleChange}
              required
            />
          </div>
        </div>

        {tipo === 'receber' ? (
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Cliente *
            </label>
            <Select
              name="cliente"
              value={formData.cliente}
              onValueChange={(val) => setFormData(prev => ({ ...prev, cliente: val }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {clientes.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
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
                {categoriasPagar.map(cat => (
                  <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1.5">
            Observações
          </label>
          <textarea
            name="observacoes"
            value={formData.observacoes}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Detalhes adicionais..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading} className={tipo === 'receber' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-red-600 hover:bg-red-700'}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              'Salvar Conta'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
