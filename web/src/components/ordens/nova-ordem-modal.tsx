'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AlertCircle, CheckCircle2, Layers, Link2, Loader2, Package, Plus, Trash2 } from 'lucide-react'
import { createBatchOrdens, verificarOrdemAtivaPaciente } from '@/actions/ordens'
import { addDaysSkippingSundays, formatCurrency, formatDate, toDateInputValue } from '@/lib/date-utils'
import { formatarCpf } from '@/lib/cpf'
import { FLUXOS_PROTESE, TIPOS_PROTESE, inferirTipoProtese } from '@/lib/workflow-config'

interface NovaOrdemModalProps {
  isOpen: boolean
  onClose: () => void
  clientes: { id: number; nome: string }[]
  servicos: { id: number; nome: string; preco: number; tempoProducao?: number; tipoWorkflow?: string | null }[]
  onSuccess?: () => void
}

type ArcadaOpcao = 'Superior' | 'Inferior' | 'Superior + Inferior'
const ARCADAS_OPCOES: ArcadaOpcao[] = ['Superior', 'Inferior', 'Superior + Inferior']
const cores = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D2', 'D3', 'D4']

interface ItemPedido {
  id: string
  servicoId: string
  servicoNome: string
  elementos: string
  corDentes: string
  material: string
  arcadas: number
  arcada: ArcadaOpcao
  tipoProtese: string
  preco: number
}

type OrdemAtivaDetectada = Awaited<ReturnType<typeof verificarOrdemAtivaPaciente>>

export function NovaOrdemModal({ isOpen, onClose, clientes, servicos, onSuccess }: NovaOrdemModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [globalData, setGlobalData] = useState({
    clienteId: '',
    paciente: '',
    cpfPaciente: '',
    dataEntrega: '',
    prioridade: 'Normal',
    observacoes: '',
  })

  const [itens, setItens] = useState<ItemPedido[]>([])
  const [unificarEmUnicaOs, setUnificarEmUnicaOs] = useState(true)
  const [ordemAtiva, setOrdemAtiva] = useState<OrdemAtivaDetectada>(null)
  const [anexarOrdemId, setAnexarOrdemId] = useState<number | null>(null)

  const [currentItem, setCurrentItem] = useState<{
    servicoId: string
    elementos: string
    corDentes: string
    material: string
    arcadas: number
    arcada: ArcadaOpcao
    tipoProtese: string
  }>({
    servicoId: '',
    elementos: '',
    corDentes: '',
    material: '',
    arcadas: 1,
    arcada: 'Superior',
    tipoProtese: 'geral',
  })

  useEffect(() => {
    if (!isOpen) return
    const cpfLimpo = globalData.cpfPaciente.replace(/\D/g, '')
    const nomeLimpo = globalData.paciente.trim()
    if (cpfLimpo.length !== 11 && nomeLimpo.length < 3) {
      setOrdemAtiva(null)
      setAnexarOrdemId(null)
      return
    }

    let cancelado = false
    const timer = setTimeout(async () => {
      try {
        const encontrada = await verificarOrdemAtivaPaciente({
          clienteId: globalData.clienteId ? Number(globalData.clienteId) : undefined,
          nomePaciente: nomeLimpo,
          cpfPaciente: cpfLimpo,
        })
        if (!cancelado) {
          setOrdemAtiva(encontrada)
          if (!encontrada) setAnexarOrdemId(null)
        }
      } catch {
        if (!cancelado) setOrdemAtiva(null)
      }
    }, 350)

    return () => {
      cancelado = true
      clearTimeout(timer)
    }
  }, [isOpen, globalData.clienteId, globalData.paciente, globalData.cpfPaciente])

  const handleAddItem = () => {
    if (!currentItem.servicoId) return
    const servico = servicos.find((s) => s.id.toString() === currentItem.servicoId)

    setItens((prev) => [
      ...prev,
      {
        id: Math.random().toString(36).slice(2, 11),
        servicoId: currentItem.servicoId,
        servicoNome: servico?.nome || '',
        elementos: currentItem.elementos,
        corDentes: currentItem.corDentes,
        material: currentItem.material,
        arcadas: currentItem.arcada === 'Superior + Inferior' ? 2 : currentItem.arcadas,
        arcada: currentItem.arcada,
        tipoProtese: currentItem.tipoProtese,
        preco: servico?.preco || 0,
      },
    ])

    if (servico && servico.tempoProducao) {
      const dataSugerida = toDateInputValue(addDaysSkippingSundays(servico.tempoProducao))
      setGlobalData((prev) => {
        if (!prev.dataEntrega || new Date(dataSugerida) > new Date(prev.dataEntrega)) {
          return { ...prev, dataEntrega: dataSugerida }
        }
        return prev
      })
    }

    setCurrentItem((prev) => ({
      ...prev,
      servicoId: '',
      elementos: '',
      arcada: prev.arcada === 'Superior' ? 'Inferior' : prev.arcada,
      arcadas: prev.arcada === 'Superior + Inferior' ? 2 : 1,
    }))
  }

  const handleRemoveItem = (id: string) => {
    setItens((prev) => prev.filter((i) => i.id !== id))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const itemPendente = currentItem.servicoId
      ? (() => {
          const srv = servicos.find((s) => s.id.toString() === currentItem.servicoId)
          return {
            id: 'pendente',
            servicoId: currentItem.servicoId,
            servicoNome: srv?.nome || '',
            elementos: currentItem.elementos,
            corDentes: currentItem.corDentes,
            material: currentItem.material,
            arcadas: currentItem.arcada === 'Superior + Inferior' ? 2 : currentItem.arcadas,
            arcada: currentItem.arcada,
            tipoProtese: currentItem.tipoProtese,
            preco: srv?.preco || 0,
          }
        })()
      : null
    const itensParaEnviar = itemPendente ? [...itens, itemPendente] : itens

    if (itensParaEnviar.length === 0) {
      setError('Adicione pelo menos um serviço ao pedido')
      return
    }

    setLoading(true)
    setError('')

    try {
      const result = await createBatchOrdens({
        ...globalData,
        unificarEmUnicaOs,
        anexarOrdemId: anexarOrdemId ?? undefined,
        itens: itensParaEnviar.map((i) => ({
          servicoId: i.servicoId,
          elementos: i.elementos,
          corDentes: i.corDentes,
          material: i.material,
          arcadas: i.arcadas,
          arcada: i.arcada,
          tipoProtese: i.tipoProtese,
        })),
      })

      if (result.success) {
        setGlobalData({ clienteId: '', paciente: '', cpfPaciente: '', dataEntrega: '', prioridade: 'Normal', observacoes: '' })
        setItens([])
        setUnificarEmUnicaOs(true)
        setOrdemAtiva(null)
        setAnexarOrdemId(null)
        setCurrentItem({ servicoId: '', elementos: '', corDentes: '', material: '', arcadas: 1, arcada: 'Superior', tipoProtese: 'geral' })
        onSuccess?.()
        onClose()
      } else {
        setError(result.error || 'Erro ao criar ordens')
      }
    } catch {
      setError('Ocorreu um erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  const totalItens = itens.length + (currentItem.servicoId ? 1 : 0)
  const valorEstimado = itens.reduce((acc, item) => acc + item.preco, 0)
    + (currentItem.servicoId ? (servicos.find((s) => s.id.toString() === currentItem.servicoId)?.preco || 0) : 0)

  const rotuloBotaoEnviar = anexarOrdemId
    ? `Anexar à OS #${anexarOrdemId}`
    : totalItens > 1 && unificarEmUnicaOs
      ? 'Gerar OS Unificada'
      : totalItens > 1
        ? `Gerar ${totalItens} Ordens`
        : 'Gerar Ordem'

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Novo Pedido"
      description="Crie uma OS unificada para múltiplas arcadas ou serviços do mesmo paciente"
      size="lg"
      dismissible={!loading}
      mobileFullscreen
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {error && (
          <div className="p-3.5 text-sm font-medium text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300 rounded-xl border border-red-200 dark:border-red-900">
            {error}
          </div>
        )}

        {/* Seção 1: Dados do Paciente */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-3">
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Dentista / Clínica</label>
            <Select
              value={globalData.clienteId}
              onValueChange={(val) => setGlobalData((p) => ({ ...p, clienteId: val }))}
            >
              <SelectTrigger className="h-10 rounded-xl bg-slate-50 dark:bg-slate-950/60 border-slate-200 dark:border-slate-700">
                <SelectValue placeholder="Selecione o dentista..." />
              </SelectTrigger>
              <SelectContent>
                {clientes.map((c) => <SelectItem key={c.id} value={c.id.toString()}>{c.nome}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Nome do Paciente</label>
            <Input
              value={globalData.paciente}
              onChange={(e) => setGlobalData((p) => ({ ...p, paciente: e.target.value }))}
              placeholder="Ex: Maria Silva"
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">CPF do Paciente</label>
            <Input
              value={globalData.cpfPaciente}
              onChange={(e) => setGlobalData((p) => ({ ...p, cpfPaciente: formatarCpf(e.target.value) }))}
              placeholder="000.000.000-00"
              inputMode="numeric"
              maxLength={14}
              required
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1.5">Entrega Prevista</label>
            <Input
              type="date"
              value={globalData.dataEntrega}
              onChange={(e) => setGlobalData((p) => ({ ...p, dataEntrega: e.target.value }))}
              min={toDateInputValue(new Date())}
              max={`${new Date().getFullYear() + 2}-12-31`}
              required
            />
          </div>
        </div>

        {ordemAtiva && (
          <div className="rounded-xl border border-amber-300 bg-amber-50/90 p-3.5 dark:border-amber-500/30 dark:bg-amber-500/10">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <div className="text-xs">
                  <p className="font-bold text-amber-950 dark:text-amber-100">
                    Paciente já possui OS aberta (#{ordemAtiva.id} · {ordemAtiva.status})
                  </p>
                  <p className="mt-0.5 text-amber-800 dark:text-amber-300">
                    {ordemAtiva.servico} · Entrega {formatDate(ordemAtiva.dataEntrega)} · {formatCurrency(ordemAtiva.valor)}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {anexarOrdemId === ordemAtiva.id ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setAnexarOrdemId(null)}
                    className="border-amber-300 text-amber-900 dark:border-amber-500/40 dark:text-amber-200"
                  >
                    Criar nova OS mesmo assim
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setAnexarOrdemId(ordemAtiva.id)}
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    <Link2 className="h-3.5 w-3.5" />
                    Anexar nesta OS (#{ordemAtiva.id})
                  </Button>
                )}
              </div>
            </div>
            {anexarOrdemId === ordemAtiva.id && (
              <p className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Os serviços abaixo serão adicionados dentro da OS #{ordemAtiva.id} para evitar duplicidade.
              </p>
            )}
          </div>
        )}

        <div className="border-t border-slate-200 dark:border-slate-800" />

        {/* Seção 2: Adicionar Serviços / Arcadas */}
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <Package className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
              Serviços e Arcadas do Caso
            </h3>
            <span className="text-xs font-medium text-slate-500 dark:text-slate-400 tabular-nums">
              {totalItens} {totalItens === 1 ? 'serviço' : 'serviços'} · {formatCurrency(valorEstimado)}
            </span>
          </div>

          <div className="p-4 bg-slate-50 dark:bg-slate-950/60 rounded-xl border border-slate-200 dark:border-slate-800 space-y-4">
            <div className="grid grid-cols-12 gap-3">
              <div className="col-span-12 md:col-span-5">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Serviço</label>
                <Select
                  value={currentItem.servicoId}
                  onValueChange={(val) => {
                    const servico = servicos.find((item) => item.id.toString() === val)
                    setCurrentItem((anterior) => ({
                      ...anterior,
                      servicoId: val,
                      tipoProtese: servico?.tipoWorkflow || (servico && inferirTipoProtese(servico.nome)) || 'geral',
                    }))
                  }}
                >
                  <SelectTrigger className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Selecione o serviço..." />
                  </SelectTrigger>
                  <SelectContent>
                    {servicos.map((s) => <SelectItem key={s.id} value={s.id.toString()}>{s.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-6 md:col-span-3">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Dentes / Elementos</label>
                <Input
                  value={currentItem.elementos}
                  onChange={(e) => setCurrentItem((p) => ({ ...p, elementos: e.target.value }))}
                  className="h-9 bg-white dark:bg-slate-900"
                  placeholder="Ex: 11, 21, Sup..."
                />
              </div>

              <div className="col-span-6 md:col-span-2">
                <label className="block text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1">Cor</label>
                <Select
                  value={currentItem.corDentes}
                  onValueChange={(val) => setCurrentItem((p) => ({ ...p, corDentes: val }))}
                >
                  <SelectTrigger className="h-9 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700">
                    <SelectValue placeholder="Cor" />
                  </SelectTrigger>
                  <SelectContent>
                    {cores.map((c) => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-12 md:col-span-2 flex items-end">
                <Button
                  type="button"
                  onClick={handleAddItem}
                  disabled={!currentItem.servicoId}
                  className="w-full h-9"
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Arcada</p>
                <div className="grid grid-cols-3 gap-1.5">
                  {ARCADAS_OPCOES.map((arcada) => (
                    <Button
                      key={arcada}
                      type="button"
                      size="sm"
                      variant={currentItem.arcada === arcada ? 'default' : 'outline'}
                      onClick={() =>
                        setCurrentItem((anterior) => ({
                          ...anterior,
                          arcada,
                          arcadas: arcada === 'Superior + Inferior' ? 2 : 1,
                        }))
                      }
                      className="text-xs px-2"
                    >
                      {arcada === 'Superior + Inferior' ? 'Sup + Inf' : arcada}
                    </Button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">Fluxo da prótese</p>
                <Select value={currentItem.tipoProtese} onValueChange={(valor) => setCurrentItem((anterior) => ({ ...anterior, tipoProtese: valor }))}>
                  <SelectTrigger className="h-8 bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-700 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Fluxo geral</SelectItem>
                    {TIPOS_PROTESE.map((tipo) => <SelectItem key={tipo} value={tipo}>{FLUXOS_PROTESE[tipo].nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {itens.length > 0 ? (
            <div className="space-y-2">
              {itens.map((item, idx) => (
                <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-2xs hover:border-indigo-300 dark:hover:border-indigo-500/40 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="h-7 w-7 shrink-0 rounded-lg bg-indigo-50 dark:bg-indigo-500/15 flex items-center justify-center text-indigo-600 dark:text-indigo-300 font-bold text-xs tabular-nums">
                      {idx + 1}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 dark:text-white truncate">{item.servicoNome}</p>
                      <div className="flex flex-wrap gap-2 text-xs text-slate-500 dark:text-slate-400">
                        <span className="rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] font-semibold text-indigo-700 dark:bg-indigo-500/15 dark:text-indigo-300">
                          {item.arcada}
                        </span>
                        {item.elementos && <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-slate-700 dark:text-slate-300">Elem: {item.elementos}</span>}
                        {item.corDentes && <span>Cor: {item.corDentes}</span>}
                        {item.tipoProtese !== 'geral' && <span>{FLUXOS_PROTESE[item.tipoProtese as keyof typeof FLUXOS_PROTESE]?.nomeCurto}</span>}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-bold tabular-nums text-slate-700 dark:text-slate-300">{formatCurrency(item.preco)}</span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => handleRemoveItem(item.id)}
                      className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 border border-dashed border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50/50 dark:bg-slate-950/30">
              <p className="text-sm font-medium text-slate-600 dark:text-slate-300">Adicione serviços ou arcadas acima (ex: Total Superior + Protocolo Inferior)</p>
              <p className="text-xs text-slate-400 mt-0.5">Você pode adicionar vários serviços e emitir tudo em 1 única OS</p>
            </div>
          )}

          {!anexarOrdemId && totalItens > 1 && (
            <label className="flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50/70 p-3.5 cursor-pointer dark:border-indigo-500/30 dark:bg-indigo-500/10">
              <input
                type="checkbox"
                checked={unificarEmUnicaOs}
                onChange={(e) => setUnificarEmUnicaOs(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              <div className="text-xs">
                <p className="font-bold text-indigo-950 dark:text-indigo-200 flex items-center gap-1.5">
                  <Layers className="h-3.5 w-3.5" />
                  Unificar todos os itens em 1 única OS (recomendado para Superior + Inferior)
                </p>
                <p className="mt-0.5 text-indigo-800/80 dark:text-indigo-300/80">
                  Evita ordens duplicadas no painel, soma os valores em uma única cobrança e mantém todas as arcadas juntas na ficha clínica.
                </p>
              </div>
            </label>
          )}
        </div>

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading} className="px-5">Cancelar</Button>
          <Button
            type="submit"
            disabled={loading || (itens.length === 0 && !currentItem.servicoId)}
            variant="success"
            className="px-6 font-bold"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : rotuloBotaoEnviar}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
