'use client'

import { useState } from 'react'
import type { LabExterno, LabExternoPedido } from '@/actions/labs-externos'
import { Modal } from '@/components/ui/modal'
import { PRAZO_PADRAO_DIAS, SITUACOES, hojeIso, paraIso, prazoSugerido, type SituacaoPedido } from '@/lib/labs-externos-utils'
import { botaoPrimario, botaoSecundario, campoClasse, rotuloClasse } from './campos'
import { ETAPA_POR_SITUACAO } from './etapas'

export interface PedidoFormData {
  labId: number
  paciente: string
  dentista: string
  dataEnvio: string
  prazo: string
  servico: string
  situacao: SituacaoPedido
}

interface ModalPedidoProps {
  labs: LabExterno[]
  pedidoEdicao?: LabExternoPedido
  onClose: () => void
  onSave: (data: PedidoFormData) => void
  isPending: boolean
}

function Grupo({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <fieldset className="space-y-3 rounded-2xl border border-slate-200 p-4 dark:border-white/10">
      <legend className="px-2 text-sm font-bold text-slate-900 dark:text-white">{titulo}</legend>
      {children}
    </fieldset>
  )
}

export function ModalPedido({ labs, pedidoEdicao, onClose, onSave, isPending }: ModalPedidoProps) {
  const [form, setForm] = useState({
    labId: pedidoEdicao?.labId ? String(pedidoEdicao.labId) : String(labs[0]?.id ?? ''),
    paciente: pedidoEdicao?.paciente ?? '',
    dentista: pedidoEdicao?.dentista ?? '',
    // Novo pedido: envio hoje e prazo sugerido. Edição: mantém o que foi cadastrado.
    dataEnvio: pedidoEdicao ? (paraIso(pedidoEdicao.dataEnvio) ?? '') : hojeIso(),
    prazo: pedidoEdicao ? (paraIso(pedidoEdicao.prazo) ?? '') : prazoSugerido(hojeIso()),
    servico: pedidoEdicao?.servico ?? '',
    situacao: pedidoEdicao?.situacao ?? ('Enviado' as SituacaoPedido),
  })
  // Enquanto o prazo não for alterado à mão, ele acompanha a data de envio.
  const [prazoManual, setPrazoManual] = useState(Boolean(pedidoEdicao))

  function enviar(e: React.FormEvent) {
    e.preventDefault()
    if (!form.paciente.trim() || !form.labId) return
    onSave({ ...form, labId: Number(form.labId) })
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={pedidoEdicao ? 'Editar pedido' : 'Novo pedido'}
      description="Registre a peça enviada ao laboratório e acompanhe o prazo"
      size="lg"
      dismissible={!isPending}
      mobileFullscreen
    >
      <form onSubmit={enviar} className="space-y-4">
        <Grupo titulo="Paciente e peça">
          <div>
            <label htmlFor="ped-paciente" className={rotuloClasse}>Paciente *</label>
            <input id="ped-paciente" required autoFocus={!pedidoEdicao} value={form.paciente} onChange={(e) => setForm((f) => ({ ...f, paciente: e.target.value }))} placeholder="Nome completo do paciente" className={campoClasse} />
          </div>
          <div>
            <label htmlFor="ped-dentista" className={rotuloClasse}>Dentista</label>
            <input id="ped-dentista" value={form.dentista} onChange={(e) => setForm((f) => ({ ...f, dentista: e.target.value }))} placeholder="Dr(a). Nome" className={campoClasse} />
          </div>
          <div>
            <label htmlFor="ped-servico" className={rotuloClasse}>O que foi enviado</label>
            <textarea id="ped-servico" rows={3} value={form.servico} onChange={(e) => setForm((f) => ({ ...f, servico: e.target.value }))} placeholder="Ex.: coroa sobre implante do elemento 36, cor A2" className={`${campoClasse} resize-none`} />
          </div>
        </Grupo>

        <Grupo titulo="Laboratório e prazo">
          <div className={`grid grid-cols-1 gap-3 ${pedidoEdicao ? 'sm:grid-cols-2' : ''}`}>
            <div>
              <label htmlFor="ped-lab" className={rotuloClasse}>Laboratório *</label>
              <select id="ped-lab" value={form.labId} onChange={(e) => setForm((f) => ({ ...f, labId: e.target.value }))} className={campoClasse}>
                {labs.map((l) => <option key={l.id} value={l.id}>{l.nome}{l.cidade ? ` — ${l.cidade}` : ''}</option>)}
              </select>
              {labs.length === 0 && <p className="mt-1.5 text-xs text-amber-600 dark:text-amber-400">Cadastre um laboratório antes de criar pedidos.</p>}
            </div>
            {pedidoEdicao && (
              <div>
                <label htmlFor="ped-situacao" className={rotuloClasse}>Etapa</label>
                <select id="ped-situacao" value={form.situacao} onChange={(e) => setForm((f) => ({ ...f, situacao: e.target.value as SituacaoPedido }))} className={campoClasse}>
                  {SITUACOES.map((s) => <option key={s} value={s}>{ETAPA_POR_SITUACAO[s].rotulo}</option>)}
                </select>
              </div>
            )}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ped-envio" className={rotuloClasse}>Data de envio</label>
              <input id="ped-envio" type="date" value={form.dataEnvio} onChange={(e) => setForm((f) => ({ ...f, dataEnvio: e.target.value, prazo: !prazoManual && e.target.value ? prazoSugerido(e.target.value) : f.prazo }))} className={campoClasse} />
            </div>
            <div>
              <label htmlFor="ped-prazo" className={rotuloClasse}>Prazo de entrega</label>
              <input id="ped-prazo" type="date" value={form.prazo} onChange={(e) => { setPrazoManual(true); setForm((f) => ({ ...f, prazo: e.target.value })) }} className={campoClasse} />
              {!pedidoEdicao && <p className="mt-1.5 text-xs text-slate-500 dark:text-slate-400">Sugerido: {PRAZO_PADRAO_DIAS} dias após o envio</p>}
            </div>
          </div>
        </Grupo>

        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose} disabled={isPending} className={botaoSecundario}>Cancelar</button>
          <button type="submit" disabled={isPending || labs.length === 0} className={botaoPrimario}>
            {isPending ? 'Salvando...' : pedidoEdicao ? 'Salvar alterações' : 'Cadastrar pedido'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
