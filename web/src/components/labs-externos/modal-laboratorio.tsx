'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { botaoPrimario, botaoSecundario, campoClasse, rotuloClasse } from './campos'

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
          <button type="button" onClick={onClose} disabled={isPending} className={botaoSecundario}>
            Cancelar
          </button>
          <button type="submit" disabled={isPending || !form.nome.trim()} className={botaoPrimario}>
            {isPending ? 'Salvando...' : 'Cadastrar laboratório'}
          </button>
        </div>
      </form>
    </Modal>
  )
}
