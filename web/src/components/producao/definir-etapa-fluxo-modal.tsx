'use client'

import { useState } from 'react'
import { AlertTriangle, CheckCircle2 } from 'lucide-react'
import { definirEtapaFluxoProtese } from '@/actions/workflow-protese'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  FLUXOS_PROTESE,
  TIPOS_PROTESE,
  getFluxoProtese,
  isTipoProtese,
  type TipoProteseId,
} from '@/lib/workflow-config'

interface OrdemParaDefinirEtapa {
  id: number
  paciente: string
  servico: string
  tipoWorkflow?: string | null
}

interface DefinirEtapaFluxoModalProps {
  ordem: OrdemParaDefinirEtapa
  onClose: () => void
  onSuccess: () => void
}

export function DefinirEtapaFluxoModal({ ordem, onClose, onSuccess }: DefinirEtapaFluxoModalProps) {
  const tipoSugerido = isTipoProtese(ordem.tipoWorkflow) ? ordem.tipoWorkflow : null
  const [tipo, setTipo] = useState<TipoProteseId | null>(tipoSugerido)
  const [passoId, setPassoId] = useState('')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const fluxo = tipo ? getFluxoProtese(tipo) : null
  const passo = fluxo?.passos.find((item) => item.id === passoId) ?? null

  const salvar = async () => {
    if (!tipo || !passoId) {
      setErro('Selecione o tipo de prótese e a etapa atual')
      return
    }

    setSalvando(true)
    setErro('')
    const resultado = await definirEtapaFluxoProtese(ordem.id, tipo, passoId)
    setSalvando(false)
    if (!resultado.success) {
      setErro(resultado.error || 'Não foi possível definir a etapa')
      return
    }
    onSuccess()
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Definir fluxo e etapa"
      description={`OS #${ordem.id} · ${ordem.paciente}`}
      size="sm"
      dismissible={!salvando}
    >
      <div className="space-y-5">
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 dark:border-zinc-800 dark:bg-zinc-900/50">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-500">Serviço da ordem</p>
          <p className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">{ordem.servico}</p>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Tipo de prótese</label>
          <Select
            value={tipo ?? undefined}
            onValueChange={(valor) => {
              setTipo(valor as TipoProteseId)
              setPassoId('')
              setErro('')
            }}
          >
            <SelectTrigger className="h-12"><SelectValue placeholder="Selecione o fluxo correto" /></SelectTrigger>
            <SelectContent>
              {TIPOS_PROTESE.map((item) => (
                <SelectItem key={item} value={item}>{FLUXOS_PROTESE[item].nome}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-slate-700 dark:text-slate-300">Etapa atual</label>
          <Select value={passoId || undefined} disabled={!fluxo} onValueChange={(valor) => { setPassoId(valor); setErro('') }}>
            <SelectTrigger className="h-12"><SelectValue placeholder={fluxo ? 'Onde esta OS está agora?' : 'Selecione primeiro o tipo'} /></SelectTrigger>
            <SelectContent>
              {fluxo?.passos.map((item, indice) => (
                <SelectItem key={item.id} value={item.id}>{indice + 1}. {item.nome} · {item.responsavel}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {passo && (
          <div className={`flex items-start gap-2 rounded-xl border p-3 text-sm ${passo.entregaFinal ? 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300' : 'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/20 dark:text-emerald-300'}`}>
            {passo.entregaFinal ? <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />}
            <p>
              {passo.entregaFinal
                ? 'Esta escolha encerra a produção laboratorial e deixa a entrega para confirmação da clínica.'
                : `A ordem será posicionada em “${passo.nome}” e o prazo desta etapa começará agora.`}
            </p>
          </div>
        )}

        {erro && <p role="alert" className="text-sm font-medium text-red-600">{erro}</p>}

        <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={salvando}>Cancelar</Button>
          <Button type="button" onClick={salvar} disabled={salvando || !tipo || !passoId} className="bg-indigo-600 text-white hover:bg-indigo-700">
            {salvando ? 'Salvando...' : 'Confirmar etapa'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
