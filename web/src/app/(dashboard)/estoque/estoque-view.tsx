'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useReactToPrint } from 'react-to-print'
import { toast } from 'sonner'
import {
  AlertTriangle, ArrowDownToLine, ArrowLeftRight, ArrowUpFromLine,
  Calendar, Download, Edit, FileClock, FileSpreadsheet, MapPin, Package,
  Printer, Search, SlidersHorizontal, Tags,
} from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/ui/empty-state'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { NovoItemEstoqueModal } from '@/components/estoque/novo-item-estoque-modal'
import { MovimentarEstoqueModal } from '@/components/estoque/movimentar-estoque-modal'
import { RelatorioEstoque, type TipoRelatorioEstoque } from '@/components/estoque/relatorio-estoque'
import type { GestaoEstoqueData, ItemEstoque, MovimentacaoEstoque } from '@/components/estoque/types'

const moeda = (valor: number) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(valor)
const numero = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 3 })
const data = (valor: string | null) => valor ? new Date(valor).toLocaleDateString('pt-BR', { timeZone: 'UTC' }) : '—'
const dataHora = (valor: string) => new Date(valor).toLocaleString('pt-BR', { timeZone: 'America/Maceio' })

function mesAtual() {
  const agora = new Date()
  return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}`
}

function mesMaceio(valor: string) {
  const partes = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit' }).formatToParts(new Date(valor))
  return `${partes.find(parte => parte.type === 'year')?.value}-${partes.find(parte => parte.type === 'month')?.value}`
}

function statusEstoque(item: ItemEstoque) {
  if (!item.ativo) return { label: 'Arquivado', variant: 'secondary' as const }
  if (item.quantidade <= 0) return { label: 'Esgotado', variant: 'destructive' as const }
  if (item.quantidade <= item.quantidadeMinima) return { label: 'Crítico', variant: 'destructive' as const }
  if (item.quantidade <= item.quantidadeMinima * 1.5) return { label: 'Baixo', variant: 'warning' as const }
  return { label: 'Normal', variant: 'success' as const }
}

function statusValidade(item: ItemEstoque) {
  if (!item.dataValidade) return null
  const hoje = new Date(); hoje.setHours(0, 0, 0, 0)
  const validade = new Date(`${item.dataValidade.slice(0, 10)}T00:00:00`)
  const dias = Math.ceil((validade.getTime() - hoje.getTime()) / 86_400_000)
  if (dias < 0) return { label: `Vencido há ${Math.abs(dias)}d`, className: 'text-red-700' }
  if (dias === 0) return { label: 'Vence hoje', className: 'text-red-700' }
  if (dias <= 30) return { label: `Vence em ${dias}d`, className: 'text-amber-700' }
  return null
}

function csvCampo(valor: string | number) {
  return `"${String(valor).replaceAll('"', '""')}"`
}

function baixarCsv(nome: string, cabecalho: string[], linhas: Array<Array<string | number>>) {
  const conteudo = [cabecalho, ...linhas].map(linha => linha.map(csvCampo).join(';')).join('\n')
  const url = URL.createObjectURL(new Blob([`\uFEFF${conteudo}`], { type: 'text/csv;charset=utf-8' }))
  const link = document.createElement('a'); link.href = url; link.download = nome; link.click(); URL.revokeObjectURL(url)
}

export function EstoqueView({ initialData }: { initialData: GestaoEstoqueData }) {
  const router = useRouter()
  const relatorioRef = useRef<HTMLDivElement>(null)
  const [search, setSearch] = useState('')
  const [categoria, setCategoria] = useState('Todos')
  const [somenteAlertas, setSomenteAlertas] = useState(false)
  const [mostrarArquivados, setMostrarArquivados] = useState(false)
  const [itemModal, setItemModal] = useState<ItemEstoque | 'novo' | null>(null)
  const [itemMovimentacao, setItemMovimentacao] = useState<ItemEstoque | null>(null)
  const [mesMovimentacoes, setMesMovimentacoes] = useState(mesAtual)
  const [tipoRelatorio, setTipoRelatorio] = useState<TipoRelatorioEstoque>('posicao')

  const itens = initialData.itens || []
  const movimentacoes = initialData.movimentacoes || []
  const itensAtivos = itens.filter(item => item.ativo)
  const categorias = ['Todos', ...Array.from(new Set(itens.map(item => item.categoria))).sort((a, b) => a.localeCompare(b, 'pt-BR'))]
  const busca = search.trim().toLocaleLowerCase('pt-BR')
  const itensFiltrados = itens.filter(item => {
    const correspondeBusca = !busca || [item.nome, item.marca, item.fornecedor, item.codigoBarras, item.localizacao].some(valor => valor.toLocaleLowerCase('pt-BR').includes(busca))
    return correspondeBusca && (categoria === 'Todos' || item.categoria === categoria) && (!somenteAlertas || item.quantidade <= item.quantidadeMinima || Boolean(statusValidade(item))) && (mostrarArquivados || item.ativo)
  })
  const movimentacoesFiltradas = movimentacoes.filter(item => mesMaceio(item.createdAt) === mesMovimentacoes && (!busca || item.itemNome.toLocaleLowerCase('pt-BR').includes(busca)))
  const itensCriticos = itensAtivos.filter(item => item.quantidade <= item.quantidadeMinima).length
  const itensValidade = itensAtivos.filter(item => Boolean(statusValidade(item))).length
  const valorTotal = itensAtivos.reduce((total, item) => total + item.quantidade * item.precoUnitario, 0)
  const periodoLabel = new Date(`${mesMovimentacoes}-01T00:00:00Z`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  const imprimir = useReactToPrint({ contentRef: relatorioRef, documentTitle: `estoque-${tipoRelatorio}-${mesMovimentacoes}` })
  function gerarRelatorio(tipo: TipoRelatorioEstoque) {
    setTipoRelatorio(tipo)
    window.setTimeout(() => imprimir(), 80)
  }
  function concluirAcao(mensagem: string) {
    setItemModal(null); setItemMovimentacao(null); toast.success(mensagem); router.refresh()
  }

  return (
    <DashboardLayout>
      {itemModal ? <NovoItemEstoqueModal key={itemModal === 'novo' ? 'novo' : itemModal.id} item={itemModal === 'novo' ? null : itemModal} onClose={() => setItemModal(null)} onSuccess={() => concluirAcao(itemModal === 'novo' ? 'Item cadastrado.' : 'Cadastro atualizado.')} /> : null}
      {itemMovimentacao ? <MovimentarEstoqueModal key={itemMovimentacao.id} item={itemMovimentacao} onClose={() => setItemMovimentacao(null)} onSuccess={() => concluirAcao('Movimentação registrada.')} /> : null}

      <Header title="Estoque" subtitle="Cadastro, movimentações, alertas e relatórios" action={{ label: 'Novo item', onClick: () => setItemModal('novo') }} />
      <div className="mx-auto max-w-[1600px] space-y-6 p-4 sm:p-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Indicador icon={Package} label="Itens ativos" valor={String(itensAtivos.length)} detalhe={`${itens.length - itensAtivos.length} arquivados`} cor="indigo" />
          <Indicador icon={AlertTriangle} label="Estoque crítico" valor={String(itensCriticos)} detalhe="No mínimo ou abaixo" cor="red" />
          <Indicador icon={Calendar} label="Validade" valor={String(itensValidade)} detalhe="Vencidos ou até 30 dias" cor="amber" />
          <Indicador icon={Tags} label="Valor em estoque" valor={moeda(valorTotal)} detalhe={`${categorias.length - 1} categorias`} cor="emerald" />
        </div>

        <Tabs defaultValue="itens" className="space-y-4">
          <TabsList className="h-auto w-full justify-start overflow-x-auto p-1 sm:w-auto"><TabsTrigger value="itens">Itens</TabsTrigger><TabsTrigger value="movimentacoes">Movimentações</TabsTrigger><TabsTrigger value="relatorios">Relatórios</TabsTrigger></TabsList>

          <TabsContent value="itens" className="space-y-4">
            <Card><CardContent className="flex flex-col gap-3 p-4 xl:flex-row xl:items-center"><Busca value={search} onChange={setSearch} /><div className="flex flex-wrap gap-2">{categorias.map(opcao => <button key={opcao} type="button" onClick={() => setCategoria(opcao)} className={`rounded-lg px-3 py-2 text-sm font-semibold ${categoria === opcao ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 dark:bg-white/5 dark:text-slate-300'}`}>{opcao}</button>)}</div><label className="flex shrink-0 items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700"><input type="checkbox" checked={somenteAlertas} onChange={event => setSomenteAlertas(event.target.checked)} /> Alertas</label><label className="flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold"><input type="checkbox" checked={mostrarArquivados} onChange={event => setMostrarArquivados(event.target.checked)} /> Arquivados</label></CardContent></Card>
            <Card>{itensFiltrados.length === 0 ? <EmptyState title="Nenhum item encontrado" description="Ajuste os filtros ou cadastre um novo material." /> : <div className="overflow-x-auto"><table className="w-full min-w-[1050px]"><thead><tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="px-5 py-4">Material</th><th className="px-5 py-4">Categoria</th><th className="px-5 py-4 text-center">Saldo</th><th className="px-5 py-4">Situação</th><th className="px-5 py-4 text-right">Custo unit.</th><th className="px-5 py-4">Fornecedor</th><th className="px-5 py-4">Validade</th><th className="px-5 py-4 text-right">Ações</th></tr></thead><tbody className="divide-y">{itensFiltrados.map(item => <LinhaItem key={item.id} item={item} onEditar={() => setItemModal(item)} onMovimentar={() => setItemMovimentacao(item)} />)}</tbody></table></div>}</Card>
          </TabsContent>

          <TabsContent value="movimentacoes" className="space-y-4">
            <Card><CardContent className="flex flex-col gap-3 p-4 sm:flex-row"><Busca value={search} onChange={setSearch} placeholder="Buscar material no histórico..." /><Input type="month" value={mesMovimentacoes} onChange={event => setMesMovimentacoes(event.target.value)} className="sm:w-48" /><Button variant="outline" onClick={() => exportarMovimentacoes(movimentacoesFiltradas, mesMovimentacoes)}><Download className="h-4 w-4" />Exportar CSV</Button></CardContent></Card>
            <Card>{movimentacoesFiltradas.length === 0 ? <EmptyState icon={FileClock} title="Sem movimentações neste período" description="Entradas, saídas, ajustes e consumos automáticos aparecerão aqui." /> : <div className="overflow-x-auto"><table className="w-full min-w-[980px]"><thead><tr className="border-b bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground"><th className="px-5 py-4">Data</th><th className="px-5 py-4">Material</th><th className="px-5 py-4">Tipo</th><th className="px-5 py-4">Quantidade</th><th className="px-5 py-4">Saldo</th><th className="px-5 py-4">Motivo</th><th className="px-5 py-4">Responsável</th></tr></thead><tbody className="divide-y">{movimentacoesFiltradas.map(item => <LinhaMovimentacao key={item.id} item={item} />)}</tbody></table></div>}</Card>
          </TabsContent>

          <TabsContent value="relatorios" className="space-y-4">
            <Card><CardHeader><CardTitle>Relatórios gerenciais</CardTitle></CardHeader><CardContent className="grid gap-4 md:grid-cols-3"><RelatorioCard icon={Package} titulo="Posição atual" descricao="Saldos, mínimos, validade, localização e valor total." onPrint={() => gerarRelatorio('posicao')} onCsv={() => exportarPosicao(itensAtivos)} /><RelatorioCard icon={AlertTriangle} titulo="Alertas" descricao="Itens críticos, esgotados, vencidos ou próximos da validade." onPrint={() => gerarRelatorio('alertas')} onCsv={() => exportarPosicao(itensAtivos.filter(item => item.quantidade <= item.quantidadeMinima || Boolean(statusValidade(item))), 'alertas-estoque.csv')} /><RelatorioCard icon={ArrowLeftRight} titulo="Movimentações" descricao={`Entradas, saídas e ajustes de ${periodoLabel}.`} onPrint={() => gerarRelatorio('movimentacoes')} onCsv={() => exportarMovimentacoes(movimentacoesFiltradas, mesMovimentacoes)} extra={<Input type="month" value={mesMovimentacoes} onChange={event => setMesMovimentacoes(event.target.value)} />} /></CardContent></Card>
            <Card><CardHeader><CardTitle>Leitura gerencial</CardTitle></CardHeader><CardContent className="grid gap-4 sm:grid-cols-3"><ResumoGestao titulo="Reposição imediata" valor={`${itensCriticos} itens`} texto="Priorize os materiais no estoque mínimo ou abaixo." /><ResumoGestao titulo="Risco de perda" valor={`${itensValidade} itens`} texto="Consuma primeiro os lotes vencidos ou com até 30 dias." /><ResumoGestao titulo="Capital imobilizado" valor={moeda(valorTotal)} texto="Custo estimado de todo o saldo ativo cadastrado." /></CardContent></Card>
          </TabsContent>
        </Tabs>
      </div>

      <div className="fixed left-[-10000px] top-0 bg-white"><RelatorioEstoque ref={relatorioRef} tipo={tipoRelatorio} itens={tipoRelatorio === 'alertas' ? itensAtivos.filter(item => item.quantidade <= item.quantidadeMinima || Boolean(statusValidade(item))) : itensAtivos} movimentacoes={movimentacoesFiltradas} periodo={periodoLabel} /></div>
    </DashboardLayout>
  )
}

function Busca({ value, onChange, placeholder = 'Buscar por nome, marca, fornecedor, código ou local...' }: { value: string; onChange: (value: string) => void; placeholder?: string }) { return <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><Input value={value} onChange={event => onChange(event.target.value)} placeholder={placeholder} className="pl-9" /></div> }

function Indicador({ icon: Icon, label, valor, detalhe, cor }: { icon: typeof Package; label: string; valor: string; detalhe: string; cor: 'indigo' | 'red' | 'amber' | 'emerald' }) { const cores = { indigo: 'bg-indigo-100 text-indigo-600', red: 'bg-red-100 text-red-600', amber: 'bg-amber-100 text-amber-700', emerald: 'bg-emerald-100 text-emerald-700' }; return <Card><CardContent className="flex items-center gap-4 p-4"><div className={`rounded-xl p-3 ${cores[cor]}`}><Icon className="h-6 w-6" /></div><div className="min-w-0"><p className="text-sm text-slate-500">{label}</p><p className="truncate text-2xl font-bold">{valor}</p><p className="text-xs text-slate-400">{detalhe}</p></div></CardContent></Card> }

function LinhaItem({ item, onEditar, onMovimentar }: { item: ItemEstoque; onEditar: () => void; onMovimentar: () => void }) { const status = statusEstoque(item); const validade = statusValidade(item); return <tr className={`transition-colors hover:bg-muted/40 ${!item.ativo ? 'opacity-60' : ''}`}><td className="px-5 py-4"><p className="font-bold">{item.nome}</p><p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{item.marca ? `${item.marca} · ` : ''}{item.localizacao || 'Sem localização'}{item.codigoBarras ? ` · ${item.codigoBarras}` : ''}</p></td><td className="px-5 py-4"><Badge variant="secondary">{item.categoria}</Badge></td><td className="px-5 py-4 text-center"><p className={`text-lg font-bold ${item.quantidade <= item.quantidadeMinima ? 'text-red-600' : ''}`}>{numero(item.quantidade)} <span className="text-sm font-normal text-muted-foreground">{item.unidade}</span></p><p className="text-xs text-muted-foreground">mín. {numero(item.quantidadeMinima)}</p></td><td className="px-5 py-4"><Badge variant={status.variant}>{status.label}</Badge></td><td className="px-5 py-4 text-right font-semibold">{moeda(item.precoUnitario)}</td><td className="px-5 py-4 text-sm text-muted-foreground">{item.fornecedor || '—'}</td><td className="px-5 py-4"><p className="text-sm">{data(item.dataValidade)}</p>{validade ? <p className={`text-xs font-semibold ${validade.className}`}>{validade.label}</p> : null}</td><td className="px-5 py-4"><div className="flex justify-end gap-1"><Button size="sm" variant="outline" onClick={onMovimentar} disabled={!item.ativo}><ArrowLeftRight className="h-4 w-4" />Movimentar</Button><Button size="icon" variant="ghost" onClick={onEditar} aria-label={`Editar ${item.nome}`}><Edit className="h-4 w-4" /></Button></div></td></tr> }

function LinhaMovimentacao({ item }: { item: MovimentacaoEstoque }) { const Icon = item.tipo === 'Entrada' ? ArrowDownToLine : item.tipo === 'Saída' ? ArrowUpFromLine : SlidersHorizontal; const variant = item.tipo === 'Entrada' ? 'success' : item.tipo === 'Saída' ? 'warning' : 'secondary'; return <tr className="hover:bg-muted/40"><td className="px-5 py-4 text-sm">{dataHora(item.createdAt)}</td><td className="px-5 py-4 font-semibold">{item.itemNome}</td><td className="px-5 py-4"><Badge variant={variant}><Icon className="mr-1 h-3 w-3" />{item.tipo}</Badge></td><td className="px-5 py-4">{numero(item.quantidade)} {item.unidade}</td><td className="px-5 py-4 text-sm">{numero(item.saldoAnterior)} → <strong>{numero(item.saldoPosterior)}</strong></td><td className="px-5 py-4 text-sm text-muted-foreground">{item.motivo}{item.ordemId ? <span className="block font-semibold text-indigo-600">OS #{item.ordemId}</span> : null}{item.documento ? <span className="block text-xs">Ref.: {item.documento}</span> : null}</td><td className="px-5 py-4 text-sm">{item.usuarioNome}</td></tr> }

function RelatorioCard({ icon: Icon, titulo, descricao, onPrint, onCsv, extra }: { icon: typeof Package; titulo: string; descricao: string; onPrint: () => void; onCsv: () => void; extra?: React.ReactNode }) { return <div className="flex flex-col rounded-2xl border bg-slate-50 p-5 dark:bg-white/5"><Icon className="h-7 w-7 text-indigo-600" /><h3 className="mt-3 font-bold">{titulo}</h3><p className="mt-1 flex-1 text-sm text-slate-500">{descricao}</p>{extra ? <div className="mt-4">{extra}</div> : null}<div className="mt-4 flex gap-2"><Button size="sm" onClick={onPrint}><Printer className="h-4 w-4" />Imprimir/PDF</Button><Button size="sm" variant="outline" onClick={onCsv}><FileSpreadsheet className="h-4 w-4" />CSV</Button></div></div> }
function ResumoGestao({ titulo, valor, texto }: { titulo: string; valor: string; texto: string }) { return <div className="rounded-xl border p-4"><p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</p><p className="mt-1 text-2xl font-bold">{valor}</p><p className="mt-2 text-sm text-slate-500">{texto}</p></div> }

function exportarPosicao(itens: ItemEstoque[], nome = 'posicao-estoque.csv') { baixarCsv(nome, ['Item', 'Marca', 'Categoria', 'Saldo', 'Unidade', 'Mínimo', 'Preço unitário', 'Valor total', 'Fornecedor', 'Localização', 'Validade', 'Código'], itens.map(item => [item.nome, item.marca, item.categoria, item.quantidade, item.unidade, item.quantidadeMinima, item.precoUnitario.toFixed(2), (item.quantidade * item.precoUnitario).toFixed(2), item.fornecedor, item.localizacao, item.dataValidade?.slice(0, 10) || '', item.codigoBarras])) }
function exportarMovimentacoes(itens: MovimentacaoEstoque[], mes: string) { baixarCsv(`movimentacoes-estoque-${mes}.csv`, ['Data', 'Item', 'Tipo', 'Quantidade', 'Unidade', 'Saldo anterior', 'Saldo posterior', 'Motivo', 'Documento', 'OS', 'Responsável'], itens.map(item => [dataHora(item.createdAt), item.itemNome, item.tipo, item.quantidade, item.unidade, item.saldoAnterior, item.saldoPosterior, item.motivo, item.documento, item.ordemId || '', item.usuarioNome])) }
