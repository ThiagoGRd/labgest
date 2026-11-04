'use client'

import { useEffect, useRef, useState } from 'react'
import { getHistoricoArquivo, type LabExternoPedido, type ResultadoAcao } from '@/actions/labs-externos'
import type { ArchiveEvent, ArchiveInput } from '@/lib/labs-externos-arquivo'
import { Modal } from '@/components/ui/modal'
import { botaoPrimario, botaoSecundario, campoClasse, rotuloClasse } from './campos'

interface Props {
  pedido: LabExternoPedido
  action: 'archive' | 'restore' | 'history'
  onClose: () => void
  onConfirm: (input: ArchiveInput) => Promise<ResultadoAcao>
}

export function ModalArquivo({ pedido, action, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('')
  const [review, setReview] = useState({ financial: 'unknown', stock: 'unknown', externalCommitment: 'unknown' })
  const [confirmed, setConfirmed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [history, setHistory] = useState<ArchiveEvent[]>([])
  const [historyError, setHistoryError] = useState('')
  const [loadingHistory, setLoadingHistory] = useState(true)
  const lock = useRef(false)
  useEffect(() => {
    let active = true
    getHistoricoArquivo(pedido.id).then(events => { if (active) setHistory(events) })
      .catch(() => { if (active) setHistoryError('Não foi possível carregar o histórico. Feche e tente novamente.') })
      .finally(() => { if (active) setLoadingHistory(false) })
    return () => { active = false }
  }, [pedido.id])
  const clear = Object.values(review).every(value => value === 'clear')
  const verb = action === 'restore' ? 'Restaurar' : 'Arquivar'
  async function submit(event: React.FormEvent) {
    event.preventDefault()
    if (lock.current || action === 'history' || !confirmed || !clear || reason.trim().length < 5) return
    lock.current = true
    setSaving(true)
    setError('')
    try {
      const result = await onConfirm({ id: pedido.id, action, reason, review, confirmed,
        expectedRevision: pedido.revisao, expectedVersion: pedido.arquivoVersao })
      if (!result.success) setError(result.error)
    } catch {
      setError('Não foi possível confirmar o resultado. Atualize a página antes de tentar novamente.')
    } finally {
      lock.current = false
      setSaving(false)
    }
  }
  return (
    <Modal isOpen onClose={onClose} dismissible={!saving} size="lg"
      title={action === 'history' ? `Histórico do registro #${pedido.id}` : `${verb} o registro #${pedido.id}?`}>
      <div className="space-y-4">
        <div className="rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
          <p className="font-semibold">{pedido.paciente} · {pedido.labNome}</p>
          <p>{pedido.servico || 'Peça não informada'} · {pedido.situacao}</p>
          <p>{pedido.dentista || 'Dentista não informado'}</p>
          <p>Envio: {pedido.dataEnvio ? new Date(pedido.dataEnvio).toISOString().slice(0, 10) : '—'} · Prazo: {pedido.prazo ? new Date(pedido.prazo).toISOString().slice(0, 10) : '—'}</p>
        </div>
        {action !== 'history' && (
          <form onSubmit={submit} className="space-y-4">
            <p className="text-sm">{action === 'archive' ? 'O registro ficará no histórico e poderá ser restaurado.' : 'O registro voltará às listas e indicadores, mantendo a situação original.'} Isso não cancela nem restaura produção no laboratório, pagamentos ou movimentações de estoque.</p>
            <p className="text-sm">Confira as obrigações fora deste registro. Se houver pendência ou dúvida, resolva a conciliação antes de continuar.</p>
            {([['financial', 'Financeiro'], ['stock', 'Estoque'], ['externalCommitment', 'Produção no laboratório']] as const).map(([field, label]) => (
              <div key={field}>
                <label className={rotuloClasse} htmlFor={`arquivo-${field}`}>{label}</label>
                <select id={`arquivo-${field}`} className={campoClasse} value={review[field]} disabled={saving}
                  onChange={e => setReview(old => ({ ...old, [field]: e.target.value }))}>
                  <option value="unknown">Não sei / ainda não conferi</option>
                  <option value="pending">Requer conciliação</option>
                  <option value="clear">Conferido, sem pendências</option>
                </select>
              </div>
            ))}
            <label className={rotuloClasse} htmlFor="arquivo-motivo">Motivo e conferência realizada</label>
            <textarea id="arquivo-motivo" className={campoClasse} required minLength={5} maxLength={2000}
              value={reason} disabled={saving} onChange={e => setReason(e.target.value)}
              placeholder="Identifique a duplicidade ou o motivo da restauração e como conferiu as pendências." />
            <label className="flex gap-2 text-sm"><input type="checkbox" checked={confirmed} disabled={saving} onChange={e => setConfirmed(e.target.checked)} />
              Confirmo que conferi o registro #{pedido.id} e entendi que esta ação altera apenas seu arquivamento.
            </label>
            {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3">
              <button type="button" className={botaoSecundario} disabled={saving} onClick={onClose}>Voltar</button>
              <button type="submit" className={botaoPrimario} disabled={saving || !clear || !confirmed || reason.trim().length < 5}>
                {saving ? 'Salvando...' : action === 'restore' ? 'Confirmar restauração' : 'Confirmar arquivamento'}
              </button>
            </div>
          </form>
        )}
        <section aria-label="Histórico de arquivamento" className="space-y-2">
          <h3 className="font-semibold">Histórico</h3>
          {loadingHistory && <p className="text-sm">Carregando histórico...</p>}
          {historyError && <p role="alert" className="text-sm text-red-600">{historyError}</p>}
          {!loadingHistory && !historyError && history.length === 0 && <p className="text-sm">Nenhum arquivamento ou restauração registrado.</p>}
          {history.map(event => (
            <details key={event.id} className="rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
              <summary>{event.action === 'archive' ? 'Arquivado' : 'Restaurado'} por {event.actor_name} · {new Date(event.occurred_at).toLocaleString('pt-BR')} · versão {event.version}</summary>
              <p className="mt-2 whitespace-pre-wrap">{event.reason}</p>
              <p className="mt-2">Registro na ocasião: {String(event.snapshot.paciente ?? '')} · {String(event.snapshot.lab_nome ?? '')} · {String(event.snapshot.situacao ?? '')}</p>
              <p>{String(event.snapshot.servico ?? '')}</p>
              <p>Conferências registradas: financeiro, estoque e produção sem pendências.</p>
            </details>
          ))}
        </section>
      </div>
    </Modal>
  )
}
