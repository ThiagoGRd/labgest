'use client'

import { useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { editarConta } from '@/actions/financeiro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'

interface ContaEdicao {
  id: number
  tipo: 'receber' | 'pagar'
  descricao: string
  valor: number
  vencimento: string
  categoria?: string
  fornecedor?: string
  observacoes: string
}

export function EditarContaModal({ conta, onClose }: { conta: ContaEdicao; onClose: () => void }) {
  const id = useId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    const resultado = await editarConta(conta.id, conta.tipo, {
      descricao: String(formData.get('descricao') || ''),
      valor: Number(formData.get('valor')),
      vencimento: String(formData.get('vencimento') || ''),
      categoria: String(formData.get('categoria') || ''),
      fornecedor: String(formData.get('fornecedor') || ''),
      observacoes: String(formData.get('observacoes') || ''),
    })
    setLoading(false)
    if (!resultado.success) return setError(resultado.error || 'Não foi possível salvar.')
    onClose()
  }

  return <Modal isOpen onClose={onClose} title="Editar lançamento" description="Valores já liquidados ficam protegidos" mobileFullscreen dismissible={!loading}>
    <form action={handleSubmit} className="space-y-4">
      {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      <div><label htmlFor={`${id}-descricao`} className="mb-1 block text-sm font-semibold">Descrição</label><Input id={`${id}-descricao`} name="descricao" defaultValue={conta.descricao} required minLength={3} /></div>
      <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor={`${id}-valor`} className="mb-1 block text-sm font-semibold">Valor total</label><Input id={`${id}-valor`} name="valor" type="number" min="0.01" step="0.01" defaultValue={conta.valor} required /></div><div><label htmlFor={`${id}-vencimento`} className="mb-1 block text-sm font-semibold">Vencimento</label><Input id={`${id}-vencimento`} name="vencimento" type="date" defaultValue={conta.vencimento.slice(0, 10)} required /></div></div>
      {conta.tipo === 'pagar' && <div className="grid gap-4 sm:grid-cols-2"><div><label htmlFor={`${id}-fornecedor`} className="mb-1 block text-sm font-semibold">Fornecedor</label><Input id={`${id}-fornecedor`} name="fornecedor" defaultValue={conta.fornecedor} /></div><div><label htmlFor={`${id}-categoria`} className="mb-1 block text-sm font-semibold">Categoria</label><Input id={`${id}-categoria`} name="categoria" defaultValue={conta.categoria} /></div></div>}
      <div><label htmlFor={`${id}-observacoes`} className="mb-1 block text-sm font-semibold">Observações</label><textarea id={`${id}-observacoes`} name="observacoes" defaultValue={conta.observacoes} rows={3} className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" /></div>
      <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button><Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? 'Salvando...' : 'Salvar alterações'}</Button></div>
    </form>
  </Modal>
}
