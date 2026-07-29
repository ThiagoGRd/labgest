'use client'

import { useState } from 'react'
import { ArrowDownToLine, ArrowUpFromLine, Loader2, SlidersHorizontal } from 'lucide-react'
import { registrarMovimentacaoEstoque } from '@/actions/estoque'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { ItemEstoque } from '@/components/estoque/types'

interface MovimentarEstoqueModalProps {
  item: ItemEstoque
  onClose: () => void
  onSuccess: () => void
}

type TipoMovimentacao = 'Entrada' | 'Saída' | 'Ajuste'

export function MovimentarEstoqueModal({ item, onClose, onSuccess }: MovimentarEstoqueModalProps) {
  const [tipo, setTipo] = useState<TipoMovimentacao>('Entrada')
  const [quantidade, setQuantidade] = useState('')
  const [motivo, setMotivo] = useState('')
  const [documento, setDocumento] = useState('')
  const [valorUnitario, setValorUnitario] = useState(String(item.precoUnitario || ''))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault()
    setLoading(true)
    setError('')
    const resultado = await registrarMovimentacaoEstoque({
      estoqueId: item.id,
      tipo,
      quantidade: Number(quantidade),
      motivo,
      documento,
      valorUnitario: tipo === 'Entrada' && valorUnitario ? Number(valorUnitario) : undefined,
    })
    setLoading(false)
    if (!resultado.success) {
      setError(resultado.error || 'Não foi possível registrar a movimentação.')
      return
    }
    onSuccess()
  }

  const opcoes: Array<{ tipo: TipoMovimentacao; label: string; icon: typeof ArrowDownToLine }> = [
    { tipo: 'Entrada', label: 'Entrada', icon: ArrowDownToLine },
    { tipo: 'Saída', label: 'Saída', icon: ArrowUpFromLine },
    { tipo: 'Ajuste', label: 'Ajuste', icon: SlidersHorizontal },
  ]

  return (
    <Modal isOpen onClose={onClose} title={`Movimentar ${item.nome}`} description={`Saldo atual: ${item.quantidade} ${item.unidade}`} dismissible={!loading} mobileFullscreen>
      <form onSubmit={handleSubmit} className="space-y-5">
        {error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div> : null}
        <div className="grid grid-cols-3 gap-2">
          {opcoes.map(opcao => {
            const Icone = opcao.icon
            return <button key={opcao.tipo} type="button" onClick={() => { setTipo(opcao.tipo); setError('') }} className={`rounded-xl border p-3 text-sm font-semibold transition-colors ${tipo === opcao.tipo ? 'border-indigo-500 bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-200' : 'border-slate-200 text-slate-600 dark:border-white/10 dark:text-slate-300'}`}><Icone className="mx-auto mb-1 h-5 w-5" />{opcao.label}</button>
          })}
        </div>
        <label><span className="mb-1.5 block text-sm font-semibold">{tipo === 'Ajuste' ? 'Novo saldo físico' : 'Quantidade'} *</span><Input type="number" min={tipo === 'Ajuste' ? '0' : '0.001'} step="0.001" value={quantidade} onChange={event => setQuantidade(event.target.value)} placeholder={`Em ${item.unidade}`} required /></label>
        {tipo === 'Entrada' ? <label><span className="mb-1.5 block text-sm font-semibold">Novo preço unitário (R$)</span><Input type="number" min="0" step="0.01" value={valorUnitario} onChange={event => setValorUnitario(event.target.value)} /></label> : null}
        <label><span className="mb-1.5 block text-sm font-semibold">Motivo *</span><Input value={motivo} onChange={event => setMotivo(event.target.value)} placeholder={tipo === 'Entrada' ? 'Ex.: Compra mensal' : tipo === 'Saída' ? 'Ex.: Uso extraordinário' : 'Ex.: Conferência física'} maxLength={255} required /></label>
        <label><span className="mb-1.5 block text-sm font-semibold">Documento / referência</span><Input value={documento} onChange={event => setDocumento(event.target.value)} placeholder="Nota fiscal, lote ou requisição" maxLength={100} /></label>
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end"><Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button><Button type="submit" disabled={loading}>{loading ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{loading ? 'Registrando...' : `Confirmar ${tipo.toLowerCase()}`}</Button></div>
      </form>
    </Modal>
  )
}
