'use client'

import { useEffect, useState } from 'react'
import { PortalLayout } from '@/components/layout/portal-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileUpload } from '@/components/ui/file-upload'
import { CameraUpload } from '@/components/ui/camera-upload'
import { criarPedidoBatch } from '@/actions/pedidos'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Camera,
  Check,
  ChevronDown,
  Loader2,
  Package,
  Plus,
  Save,
  Send,
  Trash2,
  User,
  X,
} from 'lucide-react'
import { VoiceInput } from '@/components/ui/voice-input'
import { addDaysSkippingSundays, toDateInputValue } from '@/lib/utils'
import { formatarCpf, isCpfValido } from '@/lib/cpf'
import { FLUXOS_PROTESE, TIPOS_PROTESE, inferirTipoProtese } from '@/lib/workflow-config'

interface Servico {
  id: number
  nome: string
  categoria: string
  preco: number
  tempoProducao?: number
}

interface NovoPedidoViewProps {
  user: {
    nome: string
    email: string
    cro: string
  }
  servicos: Servico[]
}

interface ItemPedido {
  id: string
  servicoId: number
  servicoNome: string
  elementos: string
  corDentes: string
  arcadas: number
  tipoProtese: string
  preco: number
}

const DRAFT_KEY = 'labgest_novo_pedido_draft_v1'
const cores = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D2', 'D3', 'D4']

const initialGlobalData = {
  paciente: '',
  cpfPaciente: '',
  dataEntrega: '',
  observacoes: '',
  arquivos: [] as string[],
}

const initialDadosClinicos = {
  dvo: false,
  registroMordida: false,
  linhaMedia: false,
  oclusao: false,
  corredorBucal: false,
  corGengiva: '',
  moldeiraIndividual: false,
  planoCera: false,
  montagemDente: false,
  barraProtocolo: false,
  acrilizacao: false,
  conserto: false,
}

export function NovoPedidoView({ user, servicos }: NovoPedidoViewProps) {
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')
  const [draftReady, setDraftReady] = useState(false)
  const [draftRestored, setDraftRestored] = useState(false)
  const [cameraPath, setCameraPath] = useState('')
  const [globalData, setGlobalData] = useState(initialGlobalData)
  const [dadosClinicos, setDadosClinicos] = useState(initialDadosClinicos)
  const [itens, setItens] = useState<ItemPedido[]>([])
  const [currentItem, setCurrentItem] = useState({ servicoId: '', elementos: '', corDentes: '', arcadas: 1, tipoProtese: 'geral' })

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(DRAFT_KEY)
      if (saved) {
        const draft = JSON.parse(saved)
        if (draft.globalData) setGlobalData({ ...initialGlobalData, ...draft.globalData })
        if (draft.dadosClinicos) setDadosClinicos({ ...initialDadosClinicos, ...draft.dadosClinicos })
        if (Array.isArray(draft.itens)) setItens(draft.itens)
        if (draft.currentItem) setCurrentItem({ servicoId: '', elementos: '', corDentes: '', arcadas: 1, tipoProtese: 'geral', ...draft.currentItem })
        setDraftRestored(true)
      }
    } catch {
      window.localStorage.removeItem(DRAFT_KEY)
    } finally {
      setDraftReady(true)
    }
  }, [])

  useEffect(() => {
    if (!draftReady || success) return
    const hasContent = globalData.paciente || globalData.cpfPaciente || globalData.dataEntrega || itens.length > 0
    if (!hasContent) {
      window.localStorage.removeItem(DRAFT_KEY)
      return
    }

    window.localStorage.setItem(DRAFT_KEY, JSON.stringify({
      globalData,
      dadosClinicos,
      itens,
      currentItem,
    }))
  }, [currentItem, dadosClinicos, draftReady, globalData, itens, success])

  const total = itens.reduce((acc, item) => acc + item.preco, 0)
  const canSubmit = Boolean(
    globalData.paciente.trim() &&
    isCpfValido(globalData.cpfPaciente) &&
    globalData.dataEntrega &&
    itens.length > 0
  )

  const formatCurrency = (value: number) => new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)

  const handleAddItem = () => {
    if (!currentItem.servicoId) return
    const servico = servicos.find((item) => item.id.toString() === currentItem.servicoId)
    if (!servico) return

    setItens((prev) => [...prev, {
      id: crypto.randomUUID(),
      servicoId: servico.id,
      servicoNome: servico.nome,
      elementos: currentItem.elementos,
      corDentes: currentItem.corDentes,
      arcadas: currentItem.arcadas,
      tipoProtese: currentItem.tipoProtese,
      preco: servico.preco,
    }])

    if (servico.tempoProducao) {
      const dataSugerida = toDateInputValue(addDaysSkippingSundays(servico.tempoProducao))
      setGlobalData((prev) => ({
        ...prev,
        dataEntrega: !prev.dataEntrega || new Date(dataSugerida) > new Date(prev.dataEntrega)
          ? dataSugerida
          : prev.dataEntrega,
      }))
    }

    setCurrentItem({ servicoId: '', elementos: '', corDentes: '', arcadas: 1, tipoProtese: 'geral' })
  }

  const handleFileUpload = (path: string) => {
    if (!path) return
    setGlobalData((prev) => ({ ...prev, arquivos: [...prev.arquivos, path] }))
  }

  const handleCameraUpload = (path: string) => {
    setGlobalData((prev) => ({
      ...prev,
      arquivos: path
        ? [...prev.arquivos.filter((item) => item !== cameraPath), path]
        : prev.arquivos.filter((item) => item !== cameraPath),
    }))
    setCameraPath(path)
  }

  const clearDraft = () => {
    window.localStorage.removeItem(DRAFT_KEY)
    setGlobalData(initialGlobalData)
    setDadosClinicos(initialDadosClinicos)
    setItens([])
    setCurrentItem({ servicoId: '', elementos: '', corDentes: '', arcadas: 1, tipoProtese: 'geral' })
    setCameraPath('')
    setDraftRestored(false)
    setError('')
  }

  const handleSubmit = async () => {
    if (!canSubmit) {
      setError('Preencha paciente, CPF válido, data de entrega e pelo menos um serviço.')
      return
    }

    setLoading(true)
    setError('')
    try {
      const result = await criarPedidoBatch({
        paciente: globalData.paciente,
        cpfPaciente: globalData.cpfPaciente,
        dataEntrega: globalData.dataEntrega,
        observacoes: globalData.observacoes,
        arquivos: globalData.arquivos,
        dadosClinicos,
        itens: itens.map((item) => ({
          servicoId: item.servicoId,
          elementos: item.elementos,
          corDentes: item.corDentes,
          arcadas: item.arcadas,
          tipoProtese: item.tipoProtese,
        })),
      })

      if (!result.success) {
        setError(result.error || 'Erro ao criar pedido')
        return
      }

      window.localStorage.removeItem(DRAFT_KEY)
      setSuccess(true)
    } catch {
      setError('Ocorreu um erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <PortalLayout user={user}>
        <Card className="mx-auto max-w-xl dark:bg-zinc-900 dark:border-zinc-800">
          <CardContent className="p-8 text-center">
            <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 dark:bg-emerald-900/30">
              <Check className="h-10 w-10 text-emerald-600" />
            </div>
            <h1 className="mb-2 text-2xl font-bold text-slate-900 dark:text-white">Pedido enviado!</h1>
            <p className="mb-6 text-slate-500">Foram geradas {itens.length} ordens de serviço.</p>
            <div className="grid gap-3 sm:grid-cols-2">
              <Button variant="outline" onClick={() => window.location.href = '/pedidos'}>Ver pedidos</Button>
              <Button className="bg-emerald-600 text-white" onClick={() => window.location.reload()}>Novo pedido</Button>
            </div>
          </CardContent>
        </Card>
      </PortalLayout>
    )
  }

  return (
    <PortalLayout user={user}>
      <div className="mx-auto max-w-3xl pb-28 md:pb-4">
        <div className="mb-5 flex items-start justify-between gap-3 md:mb-8">
          <div>
            <p className="mb-1 text-xs font-bold uppercase tracking-widest text-emerald-500">Pedido rápido</p>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Nova ordem de serviço</h1>
            <p className="mt-1 text-sm text-slate-500">Preencha o essencial. Os detalhes clínicos são opcionais.</p>
          </div>
          {(draftRestored || globalData.paciente || itens.length > 0) && (
            <Button variant="ghost" size="sm" onClick={clearDraft} className="shrink-0 text-slate-500">
              <Trash2 className="mr-1 h-4 w-4" /> Limpar
            </Button>
          )}
        </div>

        {draftRestored && (
          <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-300">
            <Save className="h-4 w-4 shrink-0" /> Seu rascunho foi recuperado automaticamente.
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-600 dark:border-red-800 dark:bg-red-900/20 dark:text-red-400">{error}</div>
        )}

        <div className="space-y-4">
          <Card className="dark:bg-zinc-900 dark:border-zinc-800">
            <CardContent className="space-y-4 p-4 md:p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-emerald-100 p-2.5 dark:bg-emerald-900/30"><User className="h-5 w-5 text-emerald-600" /></div>
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">Paciente</h2>
                  <p className="text-xs text-slate-500">Identificação usada também na integração Clinicorp</p>
                </div>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">CPF *</label>
                  <Input
                    aria-label="CPF do paciente"
                    placeholder="000.000.000-00"
                    value={globalData.cpfPaciente}
                    onChange={(event) => setGlobalData((prev) => ({ ...prev, cpfPaciente: formatarCpf(event.target.value) }))}
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={14}
                  />
                  {globalData.cpfPaciente.length === 14 && !isCpfValido(globalData.cpfPaciente) && (
                    <p className="mt-1 text-xs text-red-500">Confira o CPF informado.</p>
                  )}
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Nome do paciente *</label>
                  <Input
                    aria-label="Nome do paciente"
                    placeholder="Ex.: Maria Silva"
                    value={globalData.paciente}
                    onChange={(event) => setGlobalData((prev) => ({ ...prev, paciente: event.target.value }))}
                    autoCapitalize="words"
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-zinc-900 dark:border-zinc-800">
            <CardContent className="space-y-4 p-4 md:p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-indigo-100 p-2.5 dark:bg-indigo-900/30"><Package className="h-5 w-5 text-indigo-600" /></div>
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">Serviço</h2>
                  <p className="text-xs text-slate-500">Adicione um ou mais trabalhos para o paciente</p>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Tipo de serviço *</label>
                <Select value={currentItem.servicoId} onValueChange={(value) => {
                  const servico = servicos.find((item) => item.id.toString() === value)
                  setCurrentItem((prev) => ({ ...prev, servicoId: value, tipoProtese: (servico && inferirTipoProtese(servico.nome)) || 'geral' }))
                }}>
                  <SelectTrigger className="h-12"><SelectValue placeholder="Selecione o serviço" /></SelectTrigger>
                  <SelectContent>
                    {servicos.map((servico) => (
                      <SelectItem key={servico.id} value={servico.id.toString()}>{servico.nome} — {formatCurrency(servico.preco)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Fluxo da prótese</label>
                <Select value={currentItem.tipoProtese} onValueChange={(value) => setCurrentItem((prev) => ({ ...prev, tipoProtese: value }))}>
                  <SelectTrigger className="h-12"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="geral">Fluxo geral</SelectItem>
                    {TIPOS_PROTESE.map((tipo) => <SelectItem key={tipo} value={tipo}>{FLUXOS_PROTESE[tipo].nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Dentes</label>
                  <Input
                    aria-label="Dentes ou elementos"
                    inputMode="numeric"
                    placeholder="11, 21..."
                    value={currentItem.elementos}
                    onChange={(event) => setCurrentItem((prev) => ({ ...prev, elementos: event.target.value }))}
                  />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Cor</label>
                  <Select value={currentItem.corDentes} onValueChange={(value) => setCurrentItem((prev) => ({ ...prev, corDentes: value }))}>
                    <SelectTrigger><SelectValue placeholder="Cor" /></SelectTrigger>
                    <SelectContent>{cores.map((cor) => <SelectItem key={cor} value={cor}>{cor}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Arcadas</label>
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2].map((quantidade) => (
                    <Button
                      key={quantidade}
                      type="button"
                      variant={currentItem.arcadas === quantidade ? 'default' : 'outline'}
                      onClick={() => setCurrentItem((prev) => ({ ...prev, arcadas: quantidade }))}
                    >
                      {quantidade === 1 ? 'Uma arcada' : 'Duas arcadas'}
                    </Button>
                  ))}
                </div>
                <p className="mt-1 text-xs text-slate-500">Etapas “por arcada” terão o prazo multiplicado automaticamente.</p>
              </div>

              <Button type="button" onClick={handleAddItem} disabled={!currentItem.servicoId} className="h-12 w-full bg-indigo-600 text-white hover:bg-indigo-700">
                <Plus className="mr-2 h-5 w-5" /> Adicionar serviço
              </Button>

              {itens.length > 0 && (
                <div className="space-y-2 border-t border-slate-200 pt-4 dark:border-zinc-800">
                  {itens.map((item) => (
                    <div key={item.id} className="flex items-center justify-between gap-3 rounded-xl bg-slate-50 p-3 dark:bg-zinc-800/70">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-bold text-slate-900 dark:text-white">{item.servicoNome}</p>
                        <p className="text-xs text-slate-500">
                          {[item.elementos && `Dentes ${item.elementos}`, item.corDentes && `Cor ${item.corDentes}`, item.tipoProtese !== 'geral' && FLUXOS_PROTESE[item.tipoProtese as keyof typeof FLUXOS_PROTESE]?.nomeCurto, `${item.arcadas} arcada${item.arcadas > 1 ? 's' : ''}`, formatCurrency(item.preco)].filter(Boolean).join(' • ')}
                        </p>
                      </div>
                      <Button variant="ghost" size="sm" aria-label={`Remover ${item.servicoNome}`} onClick={() => setItens((prev) => prev.filter((current) => current.id !== item.id))} className="shrink-0 text-red-500">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Data desejada *</label>
                <Input
                  aria-label="Data de entrega desejada"
                  type="date"
                  value={globalData.dataEntrega}
                  onChange={(event) => setGlobalData((prev) => ({ ...prev, dataEntrega: event.target.value }))}
                  min={new Date().toISOString().split('T')[0]}
                />
                <p className="mt-1 text-xs text-slate-500">A data é sugerida automaticamente conforme o serviço.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="dark:bg-zinc-900 dark:border-zinc-800">
            <CardContent className="space-y-5 p-4 md:p-6">
              <div className="flex items-center gap-3">
                <div className="rounded-xl bg-amber-100 p-2.5 dark:bg-amber-900/30"><Camera className="h-5 w-5 text-amber-600" /></div>
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">Fotos e observações</h2>
                  <p className="text-xs text-slate-500">Opcional, mas ajuda o laboratório a entender o caso</p>
                </div>
              </div>
              <CameraUpload onUploadComplete={handleCameraUpload} label="Fotografar o caso" instruction="Use boa iluminação. No celular, abriremos a câmera traseira." />
              <FileUpload onUploadComplete={handleFileUpload} label="Anexar STL, OBJ ou ZIP" />

              {globalData.arquivos.length > 0 && (
                <div className="space-y-2">
                  {globalData.arquivos.map((path) => (
                    <div key={path} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm dark:bg-zinc-800">
                      <span className="max-w-[80%] truncate">{path.split('/').pop()}</span>
                      <button type="button" aria-label="Remover arquivo" onClick={() => setGlobalData((prev) => ({ ...prev, arquivos: prev.arquivos.filter((item) => item !== path) }))}>
                        <X className="h-4 w-4 text-slate-400" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div>
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Observações</label>
                <div className="space-y-3">
                  <VoiceInput onTranscript={(text) => setGlobalData((prev) => ({ ...prev, observacoes: prev.observacoes ? `${prev.observacoes} ${text}` : text }))} />
                  <textarea
                    aria-label="Observações do pedido"
                    className="w-full rounded-lg border border-slate-300 px-3 py-3 text-base focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    rows={3}
                    placeholder="Informações adicionais..."
                    value={globalData.observacoes}
                    onChange={(event) => setGlobalData((prev) => ({ ...prev, observacoes: event.target.value }))}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <details className="group rounded-xl border border-slate-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <summary className="flex cursor-pointer list-none items-center justify-between p-4 font-semibold text-slate-900 dark:text-white">
              Detalhes clínicos opcionais
              <ChevronDown className="h-5 w-5 text-slate-400 transition-transform group-open:rotate-180" />
            </summary>
            <div className="grid gap-6 border-t border-slate-200 p-4 dark:border-zinc-800 md:grid-cols-2 md:p-6">
              <ClinicalChecks
                title="Dados clínicos"
                items={[
                  ['dvo', 'D.V.O.'],
                  ['registroMordida', 'Registro de mordida'],
                  ['linhaMedia', 'Linha média'],
                  ['oclusao', 'Oclusão'],
                  ['corredorBucal', 'Corredor bucal'],
                ]}
                values={dadosClinicos}
                onChange={(key, checked) => setDadosClinicos((prev) => ({ ...prev, [key]: checked }))}
              />
              <ClinicalChecks
                title="Solicitação específica"
                items={[
                  ['moldeiraIndividual', 'Moldeira individual'],
                  ['planoCera', 'Plano de cera'],
                  ['montagemDente', 'Montagem de dente'],
                  ['barraProtocolo', 'Barra de protocolo'],
                  ['acrilizacao', 'Acrilização'],
                  ['conserto', 'Conserto'],
                ]}
                values={dadosClinicos}
                onChange={(key, checked) => setDadosClinicos((prev) => ({ ...prev, [key]: checked }))}
              />
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-medium text-slate-700 dark:text-slate-300">Cor da gengiva</label>
                <Input placeholder="Ex.: STG, rosa médio..." value={dadosClinicos.corGengiva} onChange={(event) => setDadosClinicos((prev) => ({ ...prev, corGengiva: event.target.value }))} />
              </div>
            </div>
          </details>

          <div className="rounded-xl bg-slate-100 p-4 dark:bg-zinc-800/70">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm text-slate-500">Resumo</p>
                <p className="font-bold text-slate-900 dark:text-white">{itens.length} {itens.length === 1 ? 'serviço' : 'serviços'} • {formatCurrency(total)}</p>
              </div>
              <div className="flex items-center gap-1 text-xs text-slate-500"><Save className="h-3.5 w-3.5" /> Rascunho automático</div>
            </div>
          </div>

          <Button onClick={handleSubmit} disabled={loading || !canSubmit} className="hidden h-12 w-full bg-emerald-600 text-white hover:bg-emerald-700 md:flex">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="mr-2 h-5 w-5" /> Enviar ordem</>}
          </Button>
        </div>

        <div className="fixed inset-x-0 bottom-16 z-40 border-t border-slate-200 bg-white/95 p-3 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 md:hidden">
          <Button onClick={handleSubmit} disabled={loading || !canSubmit} className="h-12 w-full bg-emerald-600 text-base font-bold text-white hover:bg-emerald-700">
            {loading ? <Loader2 className="h-5 w-5 animate-spin" /> : <><Send className="mr-2 h-5 w-5" /> Enviar ordem • {formatCurrency(total)}</>}
          </Button>
        </div>
      </div>
    </PortalLayout>
  )
}

function ClinicalChecks({
  title,
  items,
  values,
  onChange,
}: {
  title: string
  items: string[][]
  values: Record<string, boolean | string>
  onChange: (key: string, checked: boolean) => void
}) {
  return (
    <div>
      <h3 className="mb-3 text-xs font-bold uppercase tracking-wide text-slate-500">{title}</h3>
      <div className="space-y-3">
        {items.map(([key, label]) => (
          <label key={key} className="flex min-h-8 items-center gap-3 text-sm text-slate-700 dark:text-slate-300">
            <Checkbox checked={Boolean(values[key])} onCheckedChange={(checked) => onChange(key, checked === true)} />
            {label}
          </label>
        ))}
      </div>
    </div>
  )
}
