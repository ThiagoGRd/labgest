'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { NovoItemEstoqueModal } from '@/components/estoque/novo-item-estoque-modal'
import {
  Search,
  Filter,
  Download,
  Edit,
  AlertTriangle,
  Package,
  TrendingDown,
  Calendar,
  MapPin,
  Barcode,
} from 'lucide-react'

// Types
interface ItemEstoque {
  id: number
  nome: string
  categoria: string
  quantidade: number
  quantidadeMinima: number
  unidade: string
  precoUnitario: number
  fornecedor: string
  localizacao: string
  dataValidade: string | null
  codigoBarras: string
}

interface EstoqueViewProps {
  initialData: ItemEstoque[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(dateStr: string | null) {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR')
}

function getStockStatus(quantidade: number, minimo: number) {
  if (quantidade <= 0) return { label: 'Esgotado', color: 'destructive' as const, icon: AlertTriangle }
  if (quantidade <= minimo) return { label: 'Crítico', color: 'destructive' as const, icon: TrendingDown }
  if (quantidade <= minimo * 1.5) return { label: 'Baixo', color: 'warning' as const, icon: TrendingDown }
  return { label: 'OK', color: 'success' as const, icon: Package }
}

const categorias = ['Todos', 'Resina', 'Dentes', 'Gesso', 'Metal', 'Cera', 'Líquidos', 'CAD/CAM']

export function EstoqueView({ initialData }: EstoqueViewProps) {
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('Todos')
  const [showOnlyLow, setShowOnlyLow] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const estoque = initialData || []

  const filteredEstoque = estoque.filter(item => {
    const matchSearch =
      item.nome.toLowerCase().includes(search.toLowerCase()) ||
      item.fornecedor.toLowerCase().includes(search.toLowerCase()) ||
      item.codigoBarras.includes(search)
    const matchCategoria = categoriaFilter === 'Todos' || item.categoria === categoriaFilter
    const matchLow = !showOnlyLow || item.quantidade <= item.quantidadeMinima
    return matchSearch && matchCategoria && matchLow
  })

  const totalValor = filteredEstoque.reduce((acc, item) => acc + (item.quantidade * item.precoUnitario), 0)
  const itensEmAlerta = estoque.filter(item => item.quantidade <= item.quantidadeMinima).length

  return (
    <DashboardLayout>
      <NovoItemEstoqueModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          setModalOpen(false)
        }}
      />

      <Header
        title="Estoque"
        subtitle={`${estoque.length} itens cadastrados`}
        action={{
          label: 'Novo Item',
          onClick: () => setModalOpen(true),
        }}
      />

      <div className="p-6 space-y-6">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-indigo-100">
                <Package className="h-6 w-6 text-indigo-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Total de Itens</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{estoque.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-red-100">
                <AlertTriangle className="h-6 w-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Em Alerta</p>
                <p className="text-2xl font-bold text-red-600">{itensEmAlerta}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-100">
                <TrendingDown className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Categorias</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">-</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-100">
                <Package className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Valor Total</p>
                <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalValor).split(',')[0]}</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nome, fornecedor ou código..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2 flex-wrap">
                {categorias.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategoriaFilter(cat)}
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${categoriaFilter === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                      }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
              <label className="flex items-center gap-2 px-3 py-2 bg-red-50 rounded-lg cursor-pointer border border-red-200">
                <input
                  type="checkbox"
                  checked={showOnlyLow}
                  onChange={(e) => setShowOnlyLow(e.target.checked)}
                  className="rounded border-red-300 text-red-600"
                />
                <span className="text-sm text-red-700 font-medium">Apenas críticos</span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/50">
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                    Material
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                    Categoria
                  </th>
                  <th className="text-center text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                    Quantidade
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                    Status
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                    Preço Unit.
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                    Fornecedor
                  </th>
                  <th className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                    Validade
                  </th>
                  <th className="text-right text-xs font-medium text-muted-foreground uppercase tracking-wider px-6 py-4">
                    Ações
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredEstoque.map((item) => {
                  const status = getStockStatus(item.quantidade, item.quantidadeMinima)
                  return (
                    <tr key={item.id} className="hover:bg-muted/50 transition-colors border-b border-border">
                      <td className="px-6 py-4">
                        <div>
                          <p className="font-bold text-foreground">{item.nome}</p>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                            <MapPin className="h-3 w-3" />
                            <span>{item.localizacao}</span>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant="secondary" className="font-medium">{item.categoria}</Badge>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div>
                          <span className={`text-lg font-bold ${item.quantidade <= item.quantidadeMinima ? 'text-destructive' : 'text-foreground'
                            }`}>
                            {item.quantidade}
                          </span>
                          <span className="text-muted-foreground text-sm ml-1">{item.unidade}</span>
                          <p className="text-xs text-muted-foreground">min: {item.quantidadeMinima}</p>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <Badge variant={status.color}>
                          {status.label}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-foreground">{formatCurrency(item.precoUnitario)}</span>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-muted-foreground font-medium">{item.fornecedor}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <span className="text-muted-foreground">{formatDate(item.dataValidade)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button className="p-2 text-muted-foreground hover:text-primary hover:bg-muted rounded-lg transition-colors">
                          <Edit className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>
    </DashboardLayout>
  )
}
