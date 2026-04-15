'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { abrirCiclo } from '@/actions/ciclos'
import { SendHorizontal, Clock, Tag } from 'lucide-react'

interface AbrirCicloModalProps {
  isOpen: boolean
  onClose: () => void
  ordemId: number
  paciente: string
  numeroCicloAtual: number
}

const etapasOpcoes = [
  'Montagem de Dentes',
  'Prova de Dentes',
  'Acabamento e Polimento',
  'Acrilização',
  'Ajuste Final',
  'Outro',
]

export function AbrirCicloModal({ isOpen, onClose, ordemId, paciente, numeroCicloAtual }: AbrirCicloModalProps) {
  const [prazoDias, setPrazoDias] = useState(7)
  const [etapa, setEtapa] = useState(etapasOpcoes[0])
  const [loading, setLoading] = useState(false)

  const handleConfirmar = async () => {
    setLoading(true)
    try {
      await abrirCiclo(ordemId, prazoDias, etapa)
      onClose()
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const dataComprometida = new Date()
  dataComprometida.setDate(dataComprometida.getDate() + prazoDias)

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Entrada no Lab" description={`Paciente: ${paciente} — Ciclo ${numeroCicloAtual}`}>
      <div className="space-y-5">
        <div className="p-4 bg-indigo-50 dark:bg-indigo-900/10 rounded-xl border border-indigo-100 dark:border-indigo-900/30 text-sm text-indigo-700 dark:text-indigo-300">
          📥 Registre a entrada deste trabalho no laboratório e defina o prazo de entrega para esta etapa.
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5">Etapa deste Ciclo</label>
          <div className="grid grid-cols-2 gap-2">
            {etapasOpcoes.map((op) => (
              <button
                key={op}
                onClick={() => setEtapa(op)}
                className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-sm font-medium transition-all ${
                  etapa === op
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-md'
                    : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                }`}
              >
                <Tag className="h-3.5 w-3.5 opacity-70" />
                {op}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> Prazo do Laboratório
          </label>
          <div className="flex items-center gap-3">
            {[5, 7, 10, 14].map((d) => (
              <button
                key={d}
                onClick={() => setPrazoDias(d)}
                className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                  prazoDias === d
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                }`}
              >
                {d}d
              </button>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">
            Entrega comprometida: <strong className="text-slate-700 dark:text-slate-200">{dataComprometida.toLocaleDateString('pt-BR')}</strong>
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} className="flex-1">Cancelar</Button>
          <Button onClick={handleConfirmar} disabled={loading} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">
            <SendHorizontal className="h-4 w-4 mr-2" />
            {loading ? 'Registrando...' : 'Confirmar Entrada'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
