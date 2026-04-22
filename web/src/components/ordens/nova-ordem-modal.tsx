'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Loader2, Plus, Trash2, Package } from 'lucide-react'
import { createBatchOrdens } from '@/actions/ordens'
import { addDaysSkippingSundays, toDateInputValue } from '@/lib/date-utils'

interface NovaOrdemModalProps {
  isOpen: boolean
  onClose: () => void
  clientes: { id: number; nome: string }[]
  servicos: { id: number; nome: string; preco: number; tempoProducao?: number }[]
  onSuccess?: () => void
}

const cores = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D2', 'D3', 'D4']

interface ItemPedido {
  id: string
  servicoId: string
  servicoNome: string
  elementos: string
  corDentes: string
  material: string
  preco: number
}

export function NovaOrdemModal({ isOpen, onClose, clientes, servicos, onSuccess }: NovaOrdemModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Dados Globais
  const [globalData, setGlobalData] = useState({
    clienteId: '',
    paciente: '',
    dataEntrega: '',
    prioridade: 'Normal',
    observacoes: '',
  })

  // Lista de Itens
  const [itens, setItens] = useState<ItemPedido[]>([])

  // Estado do Item Atual (Sendo adicionado)
  const [currentItem, setCurrentItem] = useState({
    servicoId: '',
    elementos: '',
    corDentes: '',
    material: '',
  })

  const handleAddItem = () => {
    if (!currentItem.servicoId) return
    const servico = servicos.find(s => s.id.toString() === currentItem.servicoId)
    
    setItens(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        servicoId: currentItem.servicoId,
        servicoNome: servico?.nome || '',
        elementos: currentItem.elementos,
        corDentes: currentItem.corDentes,
        material: currentItem.material,
        preco: servico?.preco || 0
      }
    ])

    // Auto-calcula a data de entrega baseada no tempoProducao (se globalData estiver vazia ou for menor que a calculada)
    if (servico && servico.tempoProducao) {
      const dataSugerida = toDateInputValue(addDaysSkippingSundays(servico.tempoProducao))
      // Se não tem dataEntrega ou a nova data for maior que a atual, atualiza
      setGlobalData(prev => {
        if (!prev.dataEntrega || new Date(dataSugerida) > new Date(prev.dataEntrega)) {
          return { ...prev, dataEntrega: dataSugerida }
        }
        return prev
      })
    }

    // Limpar campos do item (mantendo cor e material pois geralmente repetem)
    setCurrentItem(prev => ({
      ...prev,
      servicoId: '',
      elementos: '',
    }))
  }

  const handleRemoveItem = (id: string) => {
    setItens(prev => prev.filter(i => i.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (itens.length === 0) {
      setError('Adicione pelo menos um serviço ao pedido')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await createBatchOrdens({
        ...globalData,
        itens: itens.map(i => ({
          servicoId: i.servicoId,
          elementos: i.elementos,
          corDentes: i.corDentes,
          material: i.material
        }))
      })

      if (result.success) {
        setGlobalData({ clienteId: '', paciente: '', dataEntrega: '', prioridade: 'Normal', observacoes: '' })
        setItens([])
        setCurrentItem({ servicoId: '', elementos: '', corDentes: '', material: '' })
        onSuccess?.()
        onClose()
      } else {
        setError(result.error || 'Erro ao criar ordens')
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Novo Pedido"
      description="Adicione múltiplos serviços para o mesmo paciente"
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="p-4 text-sm font-medium text-red-600 bg-red-50 dark:bg-red-500/10 rounded-xl border border-red-200 dark:border-red-500/20">
            {error}
          </div>
        )}

        {/* Seção 1: Dados do Paciente */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="md:col-span-2">
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Dentista / Clínica</label>
            <Select 
              value={globalData.clienteId} 
              onValueChange={(val) => setGlobalData(p => ({ ...p, clienteId: val }))}
            >
              <SelectTrigger className="h-10 rounded-lg bg-slate-50 dark:bg-zinc-800/50 border-slate-200 dark:border-zinc-700">
                <SelectValue placeholder="Selecione o dentista..." />
              </SelectTrigger>
              <SelectContent>
                {clientes.map(c => <SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Nome do Paciente</label>
            <Input
              value={globalData.paciente}
              onChange={e => setGlobalData(p => ({ ...p, paciente: e.target.value }))}
              className="h-10 rounded-lg bg-slate-50 dark:bg-zinc-800/50"
              placeholder="Ex: Maria Silva"
            />
          </div>

          <div>
            <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Entrega Prevista</label>
            <Input
              type="date"
              value={globalData.dataEntrega}
              onChange={e => setGlobalData(p => ({ ...p, dataEntrega: e.target.value }))}
              className="h-10 rounded-lg bg-slate-50 dark:bg-zinc-800/50"
            />
          </div>
        </div>

        <div className="border-t border-slate-200 dark:border-zinc-800 my-4" />

        {/* Seção 2: Adicionar Serviços */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="h-4 w-4 text-indigo-500" />
              Serviços do Caso
            </h3>
            <span className="text-xs text-slate-500">{itens.length} itens adicionados</span>
          </div>

          {/* Formulário de Item (Card de Entrada) */}
          <div className="p-4 bg-slate-50 dark:bg-zinc-800/30 rounded-xl border border-slate-200 dark:border-zinc-800/50 space-y-4">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-5">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Serviço</label>
                <Select 
                  value={currentItem.servicoId} 
                  onValueChange={(val) => setCurrentItem(p => ({ ...p, servicoId: val }))}
                >
                  <SelectTrigger className="h-9 bg-white dark:bg-zinc-900 border-slate-200">
                    <SelectValue placeholder="Selecione o serviço..." />
                  </SelectTrigger>
                  <SelectContent>
                    {servicos.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-6 md:col-span-3">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Dentes / Elementos</label>
                <Input
                  value={currentItem.elementos}
                  onChange={e => setCurrentItem(p => ({ ...p, elementos: e.target.value }))}
                  className="h-9 bg-white dark:bg-zinc-900"
                  placeholder="Ex: 11, 21, Sup..."
                />
              </div>

              <div className="col-span-6 md:col-span-2">
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Cor</label>
                <Select 
                  value={currentItem.corDentes} 
                  onValueChange={(val) => setCurrentItem(p => ({ ...p, corDentes: val }))}
                >
                  <SelectTrigger className="h-9 bg-white dark:bg-zinc-900 border-slate-200">
                    <SelectValue placeholder="Cor" />
                  </SelectTrigger>
                  <SelectContent>
                    {cores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-12 md:col-span-2 flex items-end">
                <Button 
                  type="button"
                  onClick={handleAddItem}
                  disabled={!currentItem.servicoId}
                  className="w-full h-9 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <Plus className="h-4 w-4 mr-1" />
                  Add
                </Button>
              </div>
            </div>
          </div>

          {/* Lista de Itens Adicionados */}
          {itens.length > 0 ? (
            <div className="space-y-2">
              {itens.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-lg shadow-sm group hover:border-indigo-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 font-bold text-xs">
                      {itens.indexOf(item) + 1}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-slate-900 dark:text-white">{item.servicoNome}</p>
                      <div className="flex gap-2 text-xs text-slate-500">
                        {item.elementos && <span className="bg-slate-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-slate-600 dark:text-slate-400">Elem: {item.elementos}</span>}
                        {item.corDentes && <span>Cor: {item.corDentes}</span>}
                      </div>
                    </div>
                  </div>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="icon" 
                    onClick={() => handleRemoveItem(item.id)}
                    className="text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 border-2 border-dashed border-slate-200 dark:border-zinc-800 rounded-xl bg-slate-50/50 dark:bg-zinc-900/20">
              <p className="text-sm text-slate-500">Nenhum serviço adicionado ainda.</p>
              <p className="text-xs text-slate-400">Preencha acima e clique em "Add"</p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-6 border-t border-slate-200 dark:border-zinc-800">
          <Button type="button" variant="outline" onClick={onClose} className="rounded-xl px-6">Cancelar</Button>
          <Button 
            type="submit" 
            disabled={loading || itens.length === 0} 
            className="rounded-xl px-8 bg-emerald-600 hover:bg-emerald-700 text-white font-bold"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Gerar ${itens.length > 1 ? itens.length + ' Ordens' : 'Ordem'}`}
          </Button>
        </div>
      </form>
    </Modal>
  )
}