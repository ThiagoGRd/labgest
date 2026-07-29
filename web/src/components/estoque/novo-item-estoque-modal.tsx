'use client'

import { useState } from 'react'
import { Archive, Loader2, PackageCheck, RotateCcw } from 'lucide-react'
import { alterarStatusItemEstoque, createItemEstoque, updateItemEstoque } from '@/actions/estoque'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import type { ItemEstoque } from '@/components/estoque/types'

interface ItemEstoqueModalProps {
  item?: ItemEstoque | null
  onClose: () => void
  onSuccess: () => void
}

const categorias = ['Resina', 'Metal', 'Dentes', 'Gesso', 'Cerâmica', 'Cera', 'Líquidos', 'CAD/CAM', 'Descartável', 'Equipamento', 'Outro']
const unidades = ['g', 'kg', 'ml', 'L', 'unidade', 'caixa', 'kit', 'placa', 'frasco']

export function NovoItemEstoqueModal({ item, onClose, onSuccess }: ItemEstoqueModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    nome: item?.nome || '',
    marca: item?.marca || '',
    categoria: item?.categoria || '',
    quantidade: item ? String(item.quantidade) : '',
    unidade: item?.unidade || '',
    minimo: item ? String(item.quantidadeMinima) : '',
    preco: item ? String(item.precoUnitario) : '',
    validade: item?.dataValidade?.slice(0, 10) || '',
    fornecedor: item?.fornecedor || '',
    localizacao: item?.localizacao || '',
    codigoBarras: item?.codigoBarras || '',
  })

  const handleChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(previous => ({ ...previous, [event.target.name]: event.target.value }))
    setError('')
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const dados = {
      nome: formData.nome,
      marca: formData.marca,
      categoria: formData.categoria,
      unidade: formData.unidade,
      quantidadeMinima: Number(formData.minimo) || 0,
      precoUnitario: Number(formData.preco) || 0,
      fornecedor: formData.fornecedor,
      localizacao: formData.localizacao,
      dataValidade: formData.validade,
      codigoBarras: formData.codigoBarras,
    }
    const resultado = item
      ? await updateItemEstoque(item.id, dados)
      : await createItemEstoque({ ...dados, quantidade: Number(formData.quantidade) || 0 })
    setLoading(false)
    if (!resultado.success) {
      setError(resultado.error || 'Não foi possível salvar o item.')
      return
    }
    onSuccess()
  }

  async function alterarStatus() {
    if (!item) return
    setLoading(true)
    setError('')
    const resultado = await alterarStatusItemEstoque(item.id, !item.ativo)
    setLoading(false)
    if (!resultado.success) {
      setError(resultado.error || 'Não foi possível alterar o status.')
      return
    }
    onSuccess()
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={item ? `Editar ${item.nome}` : 'Novo item de estoque'}
      description={item ? 'Atualize o cadastro; o saldo é alterado em Movimentar' : 'Cadastre um material ou produto'}
      size="lg"
      mobileFullscreen
      dismissible={!loading}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}

        <div className="grid gap-4 sm:grid-cols-2">
          <Campo label="Nome do item" obrigatorio className="sm:col-span-2"><Input name="nome" value={formData.nome} onChange={handleChange} placeholder="Ex.: Resina acrílica rosa" maxLength={255} required /></Campo>
          <Campo label="Marca"><Input name="marca" value={formData.marca} onChange={handleChange} placeholder="Ex.: Vipi" maxLength={120} /></Campo>
          <Campo label="Categoria" obrigatorio>
            <Select value={formData.categoria} onValueChange={categoria => setFormData(previous => ({ ...previous, categoria }))} required>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{categorias.map(categoria => <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>)}</SelectContent>
            </Select>
          </Campo>
          {!item ? <Campo label="Quantidade inicial" obrigatorio><Input name="quantidade" type="number" min="0" step="0.001" value={formData.quantidade} onChange={handleChange} required /></Campo> : (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-3 dark:border-indigo-500/20 dark:bg-indigo-500/10">
              <p className="text-xs font-semibold uppercase text-indigo-600">Saldo atual</p>
              <p className="mt-1 text-xl font-bold">{item.quantidade} {item.unidade}</p>
            </div>
          )}
          <Campo label="Unidade" obrigatorio>
            <Select value={formData.unidade} onValueChange={unidade => setFormData(previous => ({ ...previous, unidade }))} required>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>{unidades.map(unidade => <SelectItem key={unidade} value={unidade}>{unidade}</SelectItem>)}</SelectContent>
            </Select>
          </Campo>
          <Campo label="Estoque mínimo"><Input name="minimo" type="number" min="0" step="0.001" value={formData.minimo} onChange={handleChange} placeholder="0" /></Campo>
          <Campo label="Preço unitário (R$)"><Input name="preco" type="number" min="0" step="0.01" value={formData.preco} onChange={handleChange} placeholder="0,00" /></Campo>
          <Campo label="Fornecedor"><Input name="fornecedor" value={formData.fornecedor} onChange={handleChange} maxLength={255} /></Campo>
          <Campo label="Código de barras"><Input name="codigoBarras" value={formData.codigoBarras} onChange={handleChange} maxLength={100} /></Campo>
          <Campo label="Data de validade"><Input name="validade" type="date" value={formData.validade} onChange={handleChange} /></Campo>
          <Campo label="Localização física"><Input name="localizacao" value={formData.localizacao} onChange={handleChange} placeholder="Armário A · Prateleira 2" maxLength={255} /></Campo>
        </div>

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:items-center sm:justify-between">
          <div>{item ? <Button type="button" variant="outline" onClick={alterarStatus} disabled={loading}>{item.ativo ? <Archive className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}{item.ativo ? 'Arquivar item' : 'Reativar item'}</Button> : null}</div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row"><Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <PackageCheck className="h-4 w-4" />}{loading ? 'Salvando...' : 'Salvar item'}</Button></div>
        </div>
      </form>
    </Modal>
  )
}

function Campo({ label, obrigatorio = false, className = '', children }: { label: string; obrigatorio?: boolean; className?: string; children: React.ReactNode }) {
  return <label className={className}><span className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}{obrigatorio ? ' *' : ''}</span>{children}</label>
}
