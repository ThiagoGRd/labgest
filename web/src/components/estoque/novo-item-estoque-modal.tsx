'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2 } from 'lucide-react'
import { createItemEstoque } from '@/actions/estoque'

interface NovoItemEstoqueModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

const categorias = ['Resina', 'Metal', 'Dentes', 'Gesso', 'Cerâmica', 'Descartável', 'Equipamento', 'Outro']
const unidades = ['g', 'kg', 'ml', 'L', 'unidade', 'caixa', 'kit']

export function NovoItemEstoqueModal({ isOpen, onClose, onSuccess }: NovoItemEstoqueModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    nome: '',
    marca: '',
    categoria: '',
    quantidade: '',
    unidade: '',
    minimo: '',
    preco: '',
    validade: '',
    fornecedor: '',
    localizacao: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    
    try {
      const result = await createItemEstoque({
        nome: formData.nome,
        categoria: formData.categoria,
        quantidade: Number(formData.quantidade),
        unidade: formData.unidade,
        quantidadeMinima: Number(formData.minimo) || 0,
        precoUnitario: Number(formData.preco) || 0,
        fornecedor: formData.fornecedor,
        localizacao: formData.localizacao,
        dataValidade: formData.validade,
        // TODO: Adicionar campo codigoBarras se necessário
      })
      
      if (result.success) {
        onSuccess?.()
        onClose()
        setFormData({
          nome: '',
          marca: '',
          categoria: '',
          quantidade: '',
          unidade: '',
          minimo: '',
          preco: '',
          validade: '',
          fornecedor: '',
          localizacao: '',
        })
      } else {
        setError(result.error || 'Erro ao criar item')
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
      title="Novo Item de Estoque"
      description="Cadastre um novo material ou produto"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
            {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nome do Item *
            </label>
            <Input
              name="nome"
              value={formData.nome}
              onChange={handleChange}
              placeholder="Ex: Resina Acrílica Rosa"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Marca
            </label>
            <Input
              name="marca"
              value={formData.marca}
              onChange={handleChange}
              placeholder="Ex: Vipi"
            />
          </div>

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
              Quantidade Atual *
            </label>
            <Input
              type="number"
              name="quantidade"
              value={formData.quantidade}
              onChange={handleChange}
              placeholder="0"
              min="0"
              required
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Unidade de Medida *
            </label>
            <Select
              name="unidade"
              value={formData.unidade}
              onValueChange={(val) => setFormData(prev => ({ ...prev, unidade: val }))}
              required
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione..." />
              </SelectTrigger>
              <SelectContent>
                {unidades.map(un => (
                  <SelectItem key={un} value={un}>{un}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Estoque Mínimo
            </label>
            <Input
              type="number"
              name="minimo"
              value={formData.minimo}
              onChange={handleChange}
              placeholder="Alertar quando chegar em..."
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Preço Unitário (R$)
            </label>
            <Input
              type="number"
              name="preco"
              value={formData.preco}
              onChange={handleChange}
              placeholder="0.00"
              step="0.01"
              min="0"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Data de Validade
            </label>
            <Input
              type="date"
              name="validade"
              value={formData.validade}
              onChange={handleChange}
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Localização Física
            </label>
            <Input
              name="localizacao"
              value={formData.localizacao}
              onChange={handleChange}
              placeholder="Ex: Armário A, Prateleira 2"
            />
          </div>
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
              'Cadastrar Item'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
