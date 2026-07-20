'use client'

import { useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { liquidarConta } from '@/actions/financeiro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { formatCurrency } from '@/lib/date-utils'

interface BaixaContaModalProps {
  conta: { id: number; tipo: 'receber' | 'pagar'; descricao: string; restante: number } | null
  contasFinanceiras: Array<{ id: number; nome: string }>
  onClose: () => void
}

const formas = ['PIX', 'Boleto', 'Transferência', 'Cartão', 'Dinheiro', 'Cheque', 'Outro']

export function BaixaContaModal({ conta, contasFinanceiras, onClose }: BaixaContaModalProps) {
  const id = useId()
  const [valor, setValor] = useState(conta ? String(conta.restante.toFixed(2)) : '')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  async function handleSubmit(formData: FormData) {
    if (!conta) return
    setLoading(true)
    const resultado = await liquidarConta({
      id: conta.id,
      tipo: conta.tipo,
      valor: Number(valor),
      data: String(formData.get('data')),
      formaPagamento: String(formData.get('formaPagamento')),
      contaFinanceiraId: Number(formData.get('contaFinanceiraId')) || undefined,
      observacoes: String(formData.get('observacoes') || ''),
    })
    setLoading(false)
    if (!resultado.success) return setError(resultado.error || 'Não foi possível registrar a baixa.')
    onClose()
  }

  return (
    <Modal isOpen={Boolean(conta)} onClose={onClose} title={conta?.tipo === 'receber' ? 'Registrar recebimento' : 'Registrar pagamento'} description={conta?.descricao} size="sm" mobileFullscreen dismissible={!loading}>
      <form action={handleSubmit} className="space-y-4">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="rounded-xl bg-slate-50 p-4 dark:bg-white/5"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Saldo em aberto</p><p className="mt-1 text-2xl font-bold">{formatCurrency(conta?.restante || 0)}</p></div>
        <div><label htmlFor={`${id}-valor`} className="mb-1 block text-sm font-semibold">Valor desta baixa</label><Input id={`${id}-valor`} value={valor} onChange={(event) => setValor(event.target.value)} type="number" min="0.01" max={conta?.restante} step="0.01" required /></div>
        <div><label htmlFor={`${id}-data`} className="mb-1 block text-sm font-semibold">Data real</label><Input id={`${id}-data`} name="data" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required /></div>
        <div><label htmlFor={`${id}-forma`} className="mb-1 block text-sm font-semibold">Forma</label><Select name="formaPagamento" required><SelectTrigger id={`${id}-forma`}><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{formas.map((forma) => <SelectItem key={forma} value={forma}>{forma}</SelectItem>)}</SelectContent></Select></div>
        <div><label htmlFor={`${id}-conta`} className="mb-1 block text-sm font-semibold">Conta financeira</label><Select name="contaFinanceiraId" defaultValue={contasFinanceiras[0] ? String(contasFinanceiras[0].id) : undefined}><SelectTrigger id={`${id}-conta`}><SelectValue placeholder="Selecione" /></SelectTrigger><SelectContent>{contasFinanceiras.map((item) => <SelectItem key={item.id} value={String(item.id)}>{item.nome}</SelectItem>)}</SelectContent></Select></div>
        <div><label htmlFor={`${id}-obs`} className="mb-1 block text-sm font-semibold">Observações</label><textarea id={`${id}-obs`} name="observacoes" rows={2} className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/5" /></div>
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button><Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? 'Registrando...' : 'Confirmar baixa'}</Button></div>
      </form>
    </Modal>
  )
}
