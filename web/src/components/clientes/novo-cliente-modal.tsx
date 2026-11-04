'use client'

import { useRef, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Loader2 } from 'lucide-react'
import { createCliente, updateCliente } from '@/actions/clientes'
import { validarCliente, type ClienteCampos } from '@/lib/clientes-utils'

interface NovoClienteModalProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
  cliente?: ClienteCampos & { id: number }
}

export function NovoClienteModal({ isOpen, onClose, onSuccess, cliente }: NovoClienteModalProps) {
  const [loading, setLoading] = useState(false)
  const pending = useRef(false)
  const close = () => { if (!pending.current) onClose() }
  const [error, setError] = useState('')
  const [formData, setFormData] = useState(cliente ? { nome: cliente.nome, telefone: cliente.telefone, email: cliente.email, cro: cliente.cro, endereco: cliente.endereco, observacoes: cliente.observacoes } : {
    nome: '',
    telefone: '',
    email: '',
    cro: '',
    endereco: '',
    observacoes: '',
  })

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setFormData(prev => ({ ...prev, [e.target.name]: e.target.value }))
    if (error) setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pending.current) return
    pending.current = true
    setLoading(true)
    setError('')
    
    try {
      const data = validarCliente(formData)
      const result = cliente ? await updateCliente(cliente.id, data) : await createCliente(data)
      
      if (result.success) {
        onSuccess?.()
        onClose()
        setFormData({ nome: '', telefone: '', email: '', cro: '', endereco: '', observacoes: '' })
      } else {
        setError(result.error || 'Erro ao criar cliente')
      }
    } catch {
      setError('Não foi possível salvar. Verifique os dados e tente novamente.')
    } finally {
      pending.current = false
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={close}
      title={cliente ? 'Editar Cliente' : 'Novo Cliente'}
      description={cliente ? 'Atualize os dados do dentista' : 'Cadastre um novo dentista'}
      size="md"
      dismissible={!loading}
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div role="alert" className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
            {error}
          </div>
        )}
        
        <div>
          <label htmlFor="cliente-nome" className="block text-sm font-medium text-slate-700 mb-1.5">
            Nome Completo *
          </label>
          <Input
            id="cliente-nome"
            name="nome"
            value={formData.nome}
            onChange={handleChange}
            placeholder="Dr. João Silva"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="cliente-cro" className="block text-sm font-medium text-slate-700 mb-1.5">
              CRO *
            </label>
            <Input
              id="cliente-cro"
              name="cro"
              value={formData.cro}
              onChange={handleChange}
              placeholder="CRO-AL 1234"
              required
            />
          </div>
          <div>
            <label htmlFor="cliente-telefone" className="block text-sm font-medium text-slate-700 mb-1.5">
              Telefone *
            </label>
            <Input
              id="cliente-telefone"
              name="telefone"
              value={formData.telefone}
              onChange={handleChange}
              placeholder="(82) 99999-9999"
              required
            />
          </div>
        </div>

        <div>
          <label htmlFor="cliente-email" className="block text-sm font-medium text-slate-700 mb-1.5">
            Email
          </label>
          <Input
            type="email"
            id="cliente-email"
            name="email"
            value={formData.email}
            onChange={handleChange}
            placeholder="email@exemplo.com"
          />
        </div>

        <div>
          <label htmlFor="cliente-endereco" className="block text-sm font-medium text-slate-700 mb-1.5">
            Endereço
          </label>
          <Input
            id="cliente-endereco"
            name="endereco"
            value={formData.endereco}
            onChange={handleChange}
            placeholder="Rua, número, bairro, cidade"
          />
        </div>

        <div>
          <label htmlFor="cliente-observacoes" className="block text-sm font-medium text-slate-700 mb-1.5">
            Observações
          </label>
          <textarea
            id="cliente-observacoes"
            name="observacoes"
            value={formData.observacoes}
            onChange={handleChange}
            rows={3}
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder="Informações adicionais..."
          />
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button type="button" variant="outline" onClick={close} disabled={loading}>
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
