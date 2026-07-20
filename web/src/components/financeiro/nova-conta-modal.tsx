'use client'

import { useId, useState } from 'react'
import { Loader2 } from 'lucide-react'
import { createConta } from '@/actions/financeiro'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'

interface NovaContaModalProps {
  isOpen: boolean
  onClose: () => void
  tipoInicial: 'receber' | 'pagar'
  clientes: Array<{ id: number; nome: string }>
}

const categorias = ['Materiais', 'Laboratório externo', 'Folha de pagamento', 'Impostos', 'Estrutura', 'Manutenção', 'Marketing', 'Administrativo', 'Outros']

export function NovaContaModal({ isOpen, onClose, tipoInicial, clientes }: NovaContaModalProps) {
  const formId = useId()
  const [tipo, setTipo] = useState(tipoInicial)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [parcelado, setParcelado] = useState(false)
  const [parcelas, setParcelas] = useState(2)
  const [valorTotal, setValorTotal] = useState('')

  async function handleSubmit(formData: FormData) {
    setLoading(true)
    setError('')
    const resultado = await createConta({
      tipo,
      descricao: String(formData.get('descricao') || ''),
      valor: Number(formData.get('valor')),
      vencimento: String(formData.get('vencimento') || ''),
      competencia: String(formData.get('competencia') || ''),
      clienteId: tipo === 'receber' ? Number(formData.get('clienteId')) : undefined,
      categoria: tipo === 'pagar' ? String(formData.get('categoria') || '') : undefined,
      fornecedor: tipo === 'pagar' ? String(formData.get('fornecedor') || '') : undefined,
      observacoes: String(formData.get('observacoes') || ''),
      parcelas: tipo === 'pagar' && parcelado ? parcelas : 1,
    })
    setLoading(false)
    if (!resultado.success) return setError(resultado.error || 'Não foi possível salvar.')
    onClose()
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={tipo === 'receber' ? 'Nova conta a receber' : 'Nova conta a pagar'} description="Previsão financeira" mobileFullscreen dismissible={!loading}>
      <form id={formId} action={handleSubmit} className="space-y-5">
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
        <div className="grid grid-cols-2 rounded-xl bg-slate-100 p-1 dark:bg-zinc-800">
          <Button type="button" variant={tipo === 'receber' ? 'default' : 'ghost'} onClick={() => setTipo('receber')}>A receber</Button>
          <Button type="button" variant={tipo === 'pagar' ? 'default' : 'ghost'} onClick={() => setTipo('pagar')}>A pagar</Button>
        </div>
        <Field label="Descrição" htmlFor={`${formId}-descricao`}>
          <Input id={`${formId}-descricao`} name="descricao" placeholder={tipo === 'receber' ? 'Ex.: Ajuste adicional da OS 123' : 'Ex.: Compra de resina'} required minLength={3} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={tipo === 'pagar' && parcelado ? 'Valor total da compra' : 'Valor'} htmlFor={`${formId}-valor`}>
            <Input id={`${formId}-valor`} name="valor" value={valorTotal} onChange={(event) => setValorTotal(event.target.value)} type="number" min="0.01" step="0.01" placeholder="R$ 0,00" required />
          </Field>
          <Field label="Vencimento" htmlFor={`${formId}-vencimento`}>
            <Input id={`${formId}-vencimento`} name="vencimento" type="date" required />
          </Field>
        </div>
        <Field label="Competência" htmlFor={`${formId}-competencia`} hint="Mês em que a receita ou despesa foi gerada">
          <Input id={`${formId}-competencia`} name="competencia" type="date" />
        </Field>
        {tipo === 'receber' ? (
          <Field label="Dentista ou clínica" htmlFor={`${formId}-cliente`}>
            <Select name="clienteId" required>
              <SelectTrigger id={`${formId}-cliente`}><SelectValue placeholder="Selecione um cliente real" /></SelectTrigger>
              <SelectContent>{clientes.map((cliente) => <SelectItem key={cliente.id} value={String(cliente.id)}>{cliente.nome}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
        ) : (
          <>
            <div className="rounded-xl border border-slate-200 p-4 dark:border-white/10">
              <label className="flex cursor-pointer items-start gap-3" htmlFor={`${formId}-parcelado`}>
                <input id={`${formId}-parcelado`} type="checkbox" checked={parcelado} onChange={(event) => setParcelado(event.target.checked)} className="mt-1 h-4 w-4 rounded border-slate-300 text-indigo-600" />
                <span><span className="block text-sm font-semibold text-slate-800 dark:text-slate-100">Compra parcelada</span><span className="block text-xs text-slate-500">Cria uma conta a pagar para cada vencimento mensal.</span></span>
              </label>
              {parcelado && (
                <div className="mt-4 grid gap-4 border-t pt-4 sm:grid-cols-2">
                  <Field label="Quantidade de parcelas" htmlFor={`${formId}-parcelas`}>
                    <Input id={`${formId}-parcelas`} type="number" min="2" max="60" value={parcelas} onChange={(event) => setParcelas(Math.max(2, Math.min(60, Number(event.target.value) || 2)))} required />
                  </Field>
                  <div className="rounded-xl bg-slate-50 p-3 dark:bg-white/5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Valor aproximado por parcela</p>
                    <p className="mt-1 font-bold text-slate-900 dark:text-white">{valorTotal && Number(valorTotal) > 0 ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(valorTotal) / parcelas) : 'R$ 0,00'}</p>
                  </div>
                </div>
              )}
            </div>
            <Field label="Fornecedor" htmlFor={`${formId}-fornecedor`}><Input id={`${formId}-fornecedor`} name="fornecedor" placeholder="Nome do fornecedor" /></Field>
            <Field label="Categoria" htmlFor={`${formId}-categoria`}>
              <Select name="categoria" defaultValue="Outros"><SelectTrigger id={`${formId}-categoria`}><SelectValue /></SelectTrigger><SelectContent>{categorias.map((categoria) => <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>)}</SelectContent></Select>
            </Field>
          </>
        )}
        <Field label="Observações" htmlFor={`${formId}-observacoes`}>
          <textarea id={`${formId}-observacoes`} name="observacoes" rows={3} className="w-full resize-none rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 dark:border-white/10 dark:bg-white/5" />
        </Field>
        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" disabled={loading}>{loading && <Loader2 className="h-4 w-4 animate-spin" />}{loading ? 'Salvando...' : 'Salvar lançamento'}</Button>
        </div>
      </form>
    </Modal>
  )
}

function Field({ label, htmlFor, hint, children }: { label: string; htmlFor: string; hint?: string; children: React.ReactNode }) {
  return <div><label htmlFor={htmlFor} className="mb-1.5 block text-sm font-semibold text-slate-700 dark:text-slate-200">{label}</label>{children}{hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}</div>
}
