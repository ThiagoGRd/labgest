'use client'

import { useRef, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { createCliente, updateCliente } from '@/actions/clientes'
import { validarCadastroCliente, type CadastroCliente } from '@/lib/clientes-cadastro'

interface NovoClienteModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: (dados?: CadastroCliente) => void
  cliente?: CadastroCliente & { id: number; email: string }
}

export function NovoClienteModal({ isOpen, onClose, onSuccess, cliente }: NovoClienteModalProps) {
  const saving = useRef(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    nome: cliente?.nome ?? '',
    telefone: cliente?.telefone ?? '',
    email: cliente?.email ?? '',
    cro: cliente?.cro ?? '',
    endereco: cliente?.endereco ?? '',
    observacoes: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (saving.current) return
    const cadastro = { nome: formData.nome, telefone: formData.telefone, cro: formData.cro, endereco: formData.endereco }
    if (cliente && !validarCadastroCliente(cadastro)) {
      setError('Dados inválidos. Confira nome, telefone, CRO e endereço.')
      return
    }
    saving.current = true
    setLoading(true)
    setError('')
    
    try {
      const result: { success: boolean; error?: string; cliente?: CadastroCliente } = cliente ? await updateCliente(cliente.id, cadastro) : await createCliente(formData)
      
      if (result.success) {
        onSuccess?.(result.cliente)
        onClose()
        setFormData({ nome: '', telefone: '', email: '', cro: '', endereco: '', observacoes: '' })
      } else {
        setError(result.error || 'Erro ao salvar cliente')
      }
    } catch {
      setError('Ocorreu um erro inesperado')
    } finally {
      saving.current = false
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={cliente ? "Editar Cliente" : "Novo Cliente"}
      description={cliente ? "Atualize os dados de cadastro" : "Cadastre um novo dentista"}
      size="md"
      dismissible={!loading}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
            {error}
          </div>
        )}
        
        <fieldset disabled={loading} className="space-y-4 min-w-0">
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Nome Completo *
            </label>
            <Input
              name="nome"
              maxLength={cliente ? 255 : undefined}
              aria-label="Nome Completo"
              value={formData.nome}
              onChange={handleChange}
              placeholder="Dr. João Silva"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                CRO *
              </label>
              <Input
                name="cro"
                maxLength={cliente ? 50 : undefined}
                aria-label="CRO"
                value={formData.cro}
                onChange={handleChange}
                placeholder="CRO-AL 1234"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">
                Telefone *
              </label>
              <Input
                name="telefone"
                maxLength={cliente ? 20 : undefined}
                aria-label="Telefone"
                value={formData.telefone}
                onChange={handleChange}
                placeholder="(82) 99999-9999"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Email
            </label>
            <Input
              readOnly={Boolean(cliente)}
              type="email"
              name="email"
              aria-label="Email"
              value={formData.email}
              onChange={handleChange}
              placeholder="email@exemplo.com"
            />
            {cliente && <p className="mt-1 text-xs text-slate-500">Email vinculado ao portal. Alterações de acesso são tratadas separadamente.</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Endereço
            </label>
            <Input
              name="endereco"
              aria-label="Endereço"
              value={formData.endereco}
              onChange={handleChange}
              placeholder="Rua, número, bairro, cidade"
            />
          </div>

          {!cliente && <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Observações
            </label>
            <textarea
              name="observacoes"
              value={formData.observacoes}
              onChange={handleChange}
              rows={3}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Informações adicionais..."
            />
          </div>}
        </fieldset>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>
            Cancelar
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              cliente ? 'Salvar alterações' : 'Cadastrar'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
