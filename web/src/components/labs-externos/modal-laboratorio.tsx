'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'

export interface LaboratorioFormData {
  nome: string
  cidade: string
  telefone: string
  contato: string
}

interface ModalLaboratorioProps {
  onClose: () => void
  onSave: (dados: LaboratorioFormData) => void
  isPending: boolean
}

const campoClasse = 'w-full bg-slate-50 dark:bg-white/10 border border-slate-200 dark:border-white/20 rounded-lg px-3 py-2 text-slate-900 dark:text-white text-sm placeholder-slate-400 dark:placeholder-gray-500 focus:outline-none focus:border-blue-400'
const rotuloClasse = 'text-xs font-medium text-slate-500 dark:text-gray-400 mb-1 block'

export function ModalLaboratorio({ onClose, onSave, isPending }: ModalLaboratorioProps) {
  const [form, setForm] = useState<LaboratorioFormData>({ nome: '', cidade: '', telefone: '', contato: '' })
  const atualizar = (campo: keyof LaboratorioFormData, valor: string) => setForm((atual) => ({ ...atual, [campo]: valor }))

  return (
    <Modal isOpen onClose={onClose} title="Novo laboratório" description="Cadastre um laboratório parceiro para enviar pedidos" size="md" dismissible={!isPending} mobileFullscreen>
      <form
        className="space-y-4"
        onSubmit={(evento) => {
          evento.preventDefault()
          if (form.nome.trim()) onSave(form)
        }}
      >
        <div>
          <label htmlFor="lab-nome" className={rotuloClasse}>Nome do laboratório *</label>
          <input id="lab-nome" required autoFocus value={form.nome} onChange={(e) => atualizar('nome', e.target.value)} placeholder="Ex.: Laboratório Sorriso" className={campoClasse} />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label htmlFor="lab-cidade" className={rotuloClasse}>Cidade</label>
            <input id="lab-cidade" value={form.cidade} onChange={(e) => atualizar('cidade', e.target.value)} className={campoClasse} />
          </div>
          <div>
            <label htmlFor="lab-telefone" className={rotuloClasse}>Telefone</label>
            <input id="lab-telefone" type="tel" value={form.telefone} onChange={(e) => atualizar('telefone', e.target.value)} placeholder="(82) 90000-0000" className={campoClasse} />
          </div>
        </div>
        <div>
          <label htmlFor="lab-contato" className={rotuloClasse}>Pessoa de contato</label>
          <input id="lab-contato" value={form.contato} onChange={(e) => atualizar('contato', e.target.value)} className={campoClasse} />
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} disabled={isPending} className="flex-1 rounded-xl border border-slate-200 py-2.5 text-sm text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-900 dark:border-white/20 dark:text-gray-400 dark:hover:border-white/40 dark:hover:text-white">
            Cancelar
          </button>
          <button type="submit" disabled={isPending || !form.nome.trim()} className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60">
            {isPending ? 'Salvando...' : 'Cadastrar laboratório'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
