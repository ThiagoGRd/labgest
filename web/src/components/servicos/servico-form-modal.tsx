'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createServico, updateServico, type getMateriaisDisponiveis, type getServicos } from '@/actions/servicos'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { FLUXOS_PROTESE, SERVICE_CATEGORY, TIPOS_PROTESE, type TipoProteseId } from '@labgest/shared'
import { AlertCircle, Clock3, Factory, FlaskConical, Package, Truck } from 'lucide-react'
import { toast } from 'sonner'

type Servico = Awaited<ReturnType<typeof getServicos>>[number]
type MaterialDisponivel = Awaited<ReturnType<typeof getMateriaisDisponiveis>>[number]

interface ServicoFormModalProps {
  servico?: Servico | null
  materiaisDisponiveis: MaterialDisponivel[]
  onClose: () => void
}

const CATEGORIAS = Object.values(SERVICE_CATEGORY)

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}

export function ServicoFormModal({ servico, materiaisDisponiveis, onClose }: ServicoFormModalProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    nome: servico?.nome || '',
    categoria: servico?.categoria || '',
    tipoWorkflow: servico?.tipoWorkflow || 'geral',
    preco: servico?.preco.toString() || '',
    tempoProducao: servico?.tempoProducao.toString() || '',
    custoMateriais: servico?.custoMateriais.toString() || '',
    descricao: servico?.descricao || '',
  })
  const [materiais, setMateriais] = useState(
    servico?.materiais.map((material) => ({ id: material.id, quantidade: material.quantidade })) || [],
  )

  const fluxo = formData.tipoWorkflow === 'geral'
    ? null
    : FLUXOS_PROTESE[formData.tipoWorkflow as TipoProteseId]
  const custoCalculado = materiais.reduce((total, material) => {
    const item = materiaisDisponiveis.find((disponivel) => disponivel.id === material.id)
    return total + (item?.precoUnitario ?? 0) * material.quantidade
  }, 0)
  const custo = materiais.length > 0 ? custoCalculado : Number(formData.custoMateriais) || 0
  const preco = Number(formData.preco) || 0
  const margem = preco > 0 ? Math.round(((preco - custo) / preco) * 100) : 0

  const toggleMaterial = (id: number, selecionado: boolean) => {
    setMateriais((atuais) => selecionado
      ? [...atuais, { id, quantidade: 1 }]
      : atuais.filter((material) => material.id !== id))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()
    setLoading(true)
    setError('')

    const payload = {
      nome: formData.nome,
      categoria: formData.categoria,
      tipoWorkflow: formData.tipoWorkflow === 'geral' ? null : formData.tipoWorkflow as TipoProteseId,
      preco,
      tempoProducao: Number(formData.tempoProducao) || 0,
      custoMateriais: custo,
      descricao: formData.descricao,
      materiais,
    }

    try {
      const resultado = servico
        ? await updateServico(servico.id, payload)
        : await createServico(payload)
      if (!resultado.success) {
        setError(resultado.error || 'Não foi possível salvar o serviço.')
        return
      }
      toast.success(servico ? 'Serviço atualizado.' : 'Serviço cadastrado.')
      router.refresh()
      onClose()
    } catch {
      setError('Não foi possível salvar o serviço. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={servico ? 'Editar serviço' : 'Novo serviço'}
      description="Cadastro, fluxo, prazo e materiais"
      size="xl"
      mobileFullscreen
      dismissible={!loading}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div role="alert" className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <section className="space-y-4">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Identificação e preço</h3>
            <p className="text-xs text-slate-500">Informações exibidas para o laboratório e no Portal do Dentista.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="servico-nome">Nome do serviço *</Label>
              <Input id="servico-nome" value={formData.nome} onChange={(event) => setFormData((atual) => ({ ...atual, nome: event.target.value }))} className="mt-1.5" placeholder="Ex.: Prótese total superior" required />
            </div>
            <div>
              <Label htmlFor="servico-categoria">Categoria *</Label>
              <Select value={formData.categoria} onValueChange={(categoria) => setFormData((atual) => ({ ...atual, categoria }))}>
                <SelectTrigger id="servico-categoria" className="mt-1.5"><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>{CATEGORIAS.map((categoria) => <SelectItem key={categoria} value={categoria}>{categoria}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="servico-preco">Preço de venda *</Label>
              <Input id="servico-preco" type="number" inputMode="decimal" min="0.01" step="0.01" value={formData.preco} onChange={(event) => setFormData((atual) => ({ ...atual, preco: event.target.value }))} className="mt-1.5" required />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="servico-descricao">Descrição</Label>
              <textarea id="servico-descricao" value={formData.descricao} onChange={(event) => setFormData((atual) => ({ ...atual, descricao: event.target.value }))} rows={3} className="mt-1.5 w-full rounded-xl border border-slate-300 bg-transparent px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-500 dark:border-zinc-700" placeholder="O que está incluído neste serviço?" />
            </div>
          </div>
        </section>

        <section className="space-y-4 border-t border-slate-200 pt-6 dark:border-zinc-800">
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white">Fluxo e prazo</h3>
            <p className="text-xs text-slate-500">O fluxo escolhido passa a comandar as etapas do Kanban, sem depender do nome.</p>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="servico-fluxo">Fluxo da prótese</Label>
              <Select value={formData.tipoWorkflow} onValueChange={(tipoWorkflow) => setFormData((atual) => ({ ...atual, tipoWorkflow }))}>
                <SelectTrigger id="servico-fluxo" className="mt-1.5"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="geral">Fluxo geral</SelectItem>
                  {TIPOS_PROTESE.map((tipo) => <SelectItem key={tipo} value={tipo}>{FLUXOS_PROTESE[tipo].nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="servico-prazo">Prazo comercial estimado (dias)</Label>
              <Input id="servico-prazo" type="number" min="0" max="365" step="1" value={formData.tempoProducao} onChange={(event) => setFormData((atual) => ({ ...atual, tempoProducao: event.target.value }))} className="mt-1.5" />
              <p className="mt-1 text-xs text-slate-500">A execução de cada etapa continua respeitando o expediente configurado.</p>
            </div>
          </div>
          {fluxo && (
            <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4 dark:border-indigo-500/20 dark:bg-indigo-500/10">
              <div className="flex flex-wrap gap-4 text-xs font-medium text-indigo-800 dark:text-indigo-300">
                <span className="flex items-center gap-1"><Clock3 className="h-4 w-4" /> {fluxo.passos.length} etapas</span>
                <span className="flex items-center gap-1"><Factory className="h-4 w-4" /> {fluxo.passos.filter((passo) => passo.responsavel === 'laboratorio').length} laboratoriais</span>
                <span className="flex items-center gap-1"><FlaskConical className="h-4 w-4" /> {fluxo.passos.filter((passo) => passo.prova).length} provas</span>
                {fluxo.passos.some((passo) => passo.responsavel === 'fornecedor') && <span className="flex items-center gap-1"><Truck className="h-4 w-4" /> fornecedor externo</span>}
              </div>
            </div>
          )}
        </section>

        <section className="space-y-4 border-t border-slate-200 pt-6 dark:border-zinc-800">
          <div>
            <h3 className="flex items-center gap-2 font-bold text-slate-900 dark:text-white"><Package className="h-4 w-4 text-indigo-500" /> Materiais e custo</h3>
            <p className="text-xs text-slate-500">As quantidades serão baixadas do estoque quando a ordem for finalizada.</p>
          </div>
          {materiaisDisponiveis.length === 0 ? (
            <p className="rounded-xl bg-amber-50 p-3 text-sm text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">Cadastre materiais no Estoque para vinculá-los ao serviço.</p>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto rounded-xl border border-slate-200 p-2 dark:border-zinc-800">
              {materiaisDisponiveis.map((item) => {
                const selecionado = materiais.find((material) => material.id === item.id)
                return (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg p-2 hover:bg-slate-50 dark:hover:bg-zinc-800/50">
                    <Checkbox id={`material-${item.id}`} checked={Boolean(selecionado)} onCheckedChange={(checked) => toggleMaterial(item.id, checked === true)} />
                    <Label htmlFor={`material-${item.id}`} className="min-w-0 flex-1 cursor-pointer">
                      <span className="block truncate">{item.nome}</span>
                      <span className="text-xs font-normal text-slate-500">{formatCurrency(item.precoUnitario)}/{item.unidade} · saldo {item.quantidadeDisponivel}</span>
                    </Label>
                    {selecionado && (
                      <Input
                        aria-label={`Quantidade de ${item.nome}`}
                        type="number"
                        min="0.001"
                        step="0.001"
                        value={selecionado.quantidade}
                        onChange={(event) => setMateriais((atuais) => atuais.map((material) => material.id === item.id ? { ...material, quantidade: Number(event.target.value) } : material))}
                        className="h-9 w-24"
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {materiais.length === 0 && (
            <div className="max-w-sm">
              <Label htmlFor="servico-custo">Custo estimado de materiais</Label>
              <Input id="servico-custo" type="number" min="0" step="0.01" value={formData.custoMateriais} onChange={(event) => setFormData((atual) => ({ ...atual, custoMateriais: event.target.value }))} className="mt-1.5" />
            </div>
          )}
          <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-50 p-4 dark:bg-zinc-800/50 sm:max-w-md">
            <div><p className="text-xs text-slate-500">Custo estimado</p><p className="font-bold text-slate-900 dark:text-white">{formatCurrency(custo)}</p></div>
            <div><p className="text-xs text-slate-500">Margem estimada</p><p className={`font-bold ${margem >= 50 ? 'text-emerald-600' : margem >= 30 ? 'text-amber-600' : 'text-red-600'}`}>{margem}%</p></div>
          </div>
        </section>

        <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-slate-200 bg-white/95 px-4 pt-4 backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/95 sm:static sm:mx-0 sm:flex-row sm:justify-end sm:bg-transparent sm:px-0">
          <Button type="button" variant="outline" onClick={onClose} disabled={loading}>Cancelar</Button>
          <Button type="submit" loading={loading}>{servico ? 'Salvar alterações' : 'Cadastrar serviço'}</Button>
        </div>
      </form>
    </Modal>
  )
}
