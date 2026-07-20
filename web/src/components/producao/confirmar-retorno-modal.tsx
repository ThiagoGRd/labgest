'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { confirmarRetorno } from '@/actions/ciclos'
import { PackageCheck, Clock, MessageSquare, CheckCircle2, RotateCcw } from 'lucide-react'

interface ConfirmarRetornoModalProps {
  isOpen: boolean
  onClose: () => void
  cicloId: number
  paciente: string
  decisaoDentista?: string | null
  observacoesDentista?: string | null
  fotosProva?: string[]
}

export function ConfirmarRetornoModal({
  isOpen,
  onClose,
  cicloId,
  paciente,
  decisaoDentista,
  observacoesDentista,
  fotosProva = []
}: ConfirmarRetornoModalProps) {
  const router = useRouter()
  const [novoPrazo, setNovoPrazo] = useState(7)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const isAprovado = decisaoDentista === 'aprovado'
  const observacaoAjusteAusente = decisaoDentista === 'ajustes' && !observacoesDentista?.trim()
  const retornoInvalido = !decisaoDentista || observacaoAjusteAusente

  const handleConfirmar = async () => {
    setLoading(true)
    setError('')
    try {
      const result = await confirmarRetorno(cicloId, novoPrazo)
      if (!result.success) {
        setError(('error' in result && result.error) || 'Não foi possível confirmar o retorno')
        return
      }
      router.refresh()
      onClose()
    } catch {
      setError('Não foi possível confirmar o retorno')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Registrar Retorno do Trabalho"
      description={`Paciente: ${paciente}`}
      dismissible={!loading}
    >
      <div className="space-y-5">

        {/* Feedback do Dentista */}
        <div className={`p-4 rounded-xl border ${
          isAprovado
            ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-900/30'
            : 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-900/30'
        }`}>
          <div className="flex items-center gap-2 mb-2">
            {isAprovado
              ? <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              : <RotateCcw className="h-5 w-5 text-amber-600" />
            }
            <span className={`text-sm font-bold ${isAprovado ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}`}>
              {isAprovado ? 'Dentista aprovou — seguir para acabamento' : 'Dentista solicitou ajustes'}
            </span>
          </div>
          {observacoesDentista && (
            <p className="text-sm text-slate-700 dark:text-slate-300 bg-white/60 dark:bg-black/20 rounded-lg p-3">
              <MessageSquare className="h-3.5 w-3.5 inline mr-1.5 text-slate-400" />
              {observacoesDentista}
            </p>
          )}
          {observacaoAjusteAusente && (
            <p role="alert" className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm font-medium text-red-700 dark:border-red-900/40 dark:bg-red-900/20 dark:text-red-400">
              O retorno para ajustes exige uma observação descrevendo o que deve ser corrigido.
            </p>
          )}
          {!decisaoDentista && (
            <p role="alert" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm font-medium text-amber-700 dark:border-amber-900/40 dark:bg-amber-900/20 dark:text-amber-400">
              Aguardando o dentista registrar o resultado da prova.
            </p>
          )}
        </div>

        {error && <p role="alert" className="text-sm font-medium text-red-600 dark:text-red-400">{error}</p>}

        {/* Fotos da prova */}
        {fotosProva.length > 0 && (
          <div>
            <p className="text-xs font-bold uppercase text-slate-500 mb-2">📷 Fotos da Prova ({fotosProva.length})</p>
            <div className="flex gap-2 overflow-x-auto">
              {fotosProva.map((foto, i) => (
                <a key={i} href={foto} target="_blank" rel="noreferrer">
                  <img src={foto} alt={`Prova ${i + 1}`} className="h-20 w-20 object-cover rounded-lg border border-slate-200 dark:border-zinc-700 hover:opacity-80 transition-opacity flex-shrink-0" />
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Prazo do próximo ciclo — só se for ajuste */}
        {!isAprovado && (
          <div>
            <label className="block text-xs font-bold uppercase text-slate-500 mb-1.5 flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Prazo para os Ajustes
            </label>
            <div className="flex items-center gap-3">
              {[5, 7, 10, 14].map((d) => (
                <button
                  key={d}
                  onClick={() => setNovoPrazo(d)}
                  className={`flex-1 py-2.5 rounded-xl border text-sm font-bold transition-all ${
                    novoPrazo === d
                      ? 'bg-indigo-600 border-indigo-600 text-white'
                      : 'bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700 text-slate-700 dark:text-slate-300 hover:border-indigo-400'
                  }`}
                >
                  {d}d
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button variant="outline" onClick={onClose} disabled={loading} className="flex-1">Cancelar</Button>
          <Button
            onClick={handleConfirmar}
            disabled={loading || retornoInvalido}
            className={`flex-1 text-white ${isAprovado ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-indigo-600 hover:bg-indigo-700'}`}
          >
            <PackageCheck className="h-4 w-4 mr-2" />
            {loading ? 'Registrando...' : isAprovado ? 'Confirmar retorno e iniciar acabamento' : 'Confirmar retorno e iniciar ajustes'}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
