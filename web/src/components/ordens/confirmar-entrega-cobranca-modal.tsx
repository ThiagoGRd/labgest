'use client'

import { useId, useState } from 'react'
import { AlertTriangle, CheckCircle2, Loader2, ReceiptText } from 'lucide-react'
import { marcarEntregue } from '@/actions/ordens'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { formatCurrency } from '@/lib/date-utils'

interface OrdemEntrega {
  id: number
  paciente: string
  cliente: { nome: string }
  servico: string
  valor: number
  cobranca: {
    id: number
    valor: number
    valorRecebido: number
    vencimento: string
    status: string
    observacoes: string
  } | null
}

interface ConfirmarEntregaCobrancaModalProps {
  ordem: OrdemEntrega
  onClose: () => void
  onSuccess: (cobranca: { contaId: number; valor: number; vencimento: string; status: string }) => void
}

function dataInput(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
}

function vencimentoPadrao() {
  return dataInput(new Date())
}

export function ConfirmarEntregaCobrancaModal({ ordem, onClose, onSuccess }: ConfirmarEntregaCobrancaModalProps) {
  const id = useId()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [valor, setValor] = useState(String(ordem.cobranca?.valor ?? ordem.valor))

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError('')
    const resultado = await marcarEntregue(ordem.id, {
      valor: Number(valor),
      vencimento: String(formData.get('vencimento') || ''),
      observacoes: String(formData.get('observacoes') || ''),
    })
    setLoading(false)
    if (!resultado.success || !resultado.cobranca) {
      setError(resultado.error || 'Não foi possível confirmar a entrega e a cobrança.')
      return
    }
    onSuccess(resultado.cobranca)
  }

  const valorNumero = Number(valor) || 0

  return (
    <Modal isOpen onClose={onClose} title={`Entregar OS #${ordem.id} e gerar nota`} description="A entrega e o financeiro serão confirmados juntos" mobileFullscreen dismissible={!loading}>
      <form action={handleSubmit} className="space-y-5">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

        <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm dark:border-white/10 dark:bg-white/5 sm:grid-cols-2">
          <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Paciente</p><p className="mt-1 font-bold">{ordem.paciente}</p></div>
          <div><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Dentista / clínica</p><p className="mt-1 font-bold">{ordem.cliente.nome}</p></div>
          <div className="sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Serviço</p><p className="mt-1 font-bold">{ordem.servico}</p></div>
        </div>

        {ordem.cobranca ? (
          <div className="flex gap-3 rounded-xl border border-blue-200 bg-blue-50 p-3 text-sm text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/10 dark:text-blue-200">
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>A cobrança #{ordem.cobranca.id} já existe e será atualizada com os dados conferidos abaixo. Nenhuma duplicata será criada.</p>
          </div>
        ) : (
          <div className="flex gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Esta OS ainda não possui cobrança. Uma nova conta a receber será criada ao confirmar.</p>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <div><label htmlFor={`${id}-valor`} className="mb-1.5 block text-sm font-semibold">Valor da nota</label><Input id={`${id}-valor`} type="number" min={Math.max(0.01, ordem.cobranca?.valorRecebido || 0.01)} step="0.01" value={valor} onChange={(event) => setValor(event.target.value)} required />{ordem.cobranca && ordem.cobranca.valorRecebido > 0 && <p className="mt-1 text-xs text-slate-500">Já recebido: {formatCurrency(ordem.cobranca.valorRecebido)}</p>}</div>
          <div><label htmlFor={`${id}-vencimento`} className="mb-1.5 block text-sm font-semibold">Vencimento</label><Input id={`${id}-vencimento`} name="vencimento" type="date" min={dataInput(new Date())} defaultValue={ordem.cobranca?.vencimento.slice(0, 10) || vencimentoPadrao()} required /></div>
        </div>

        <div><label htmlFor={`${id}-observacoes`} className="mb-1.5 block text-sm font-semibold">Observação da cobrança</label><textarea id={`${id}-observacoes`} name="observacoes" defaultValue={ordem.cobranca?.observacoes || ''} rows={3} placeholder="Informações que devem constar na cobrança" className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5" /></div>

        <div className="flex items-center justify-between rounded-xl bg-emerald-50 p-4 dark:bg-emerald-500/10"><div><p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">Total a cobrar</p><p className="mt-1 text-2xl font-bold text-emerald-900 dark:text-emerald-100">{formatCurrency(valorNumero)}</p></div><ReceiptText className="h-8 w-8 text-emerald-600" /></div>

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose} disabled={loading}>Voltar</Button><Button type="submit" disabled={loading || valorNumero <= 0}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ReceiptText className="h-4 w-4" />}{loading ? 'Confirmando...' : 'Gerar nota e confirmar entrega'}</Button></div>
      </form>
    </Modal>
  )
}
