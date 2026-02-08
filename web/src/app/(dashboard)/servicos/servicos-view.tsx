'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import NovaServicoModal from '@/components/servicos/novo-servico-modal'
import {
  Search,
  Edit,
  Trash2,
  Clock,
  DollarSign,
  TrendingUp,
  Package,
  Eye,
  ToggleLeft,
  ToggleRight,
  Plus,
} from 'lucide-react'

// Types
interface Servico {
  id: number
  nome: string
  categoria: string
  descricao: string
  preco: number
  tempoProducao: number
  materiais: string[]
  custoMateriais: number
  margemLucro: number
  ativo: boolean | null
  totalPedidos: number
}

interface ServicosViewProps {
  initialData: Servico[]
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const categorias = ['Todos', 'Prótese Total', 'Parcial Removível', 'Protocolo', 'Provisório', 'Ponte Adesiva']

export function ServicosView({ initialData }: ServicosViewProps) {
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('Todos')
  const [modalOpen, setModalOpen] = useState(false)

  const servicos = initialData || []

  const filteredServicos = servicos.filter(servico => {
    const matchSearch = 
      servico.nome.toLowerCase().includes(search.toLowerCase()) ||
      servico.descricao.toLowerCase().includes(search.toLowerCase())
    const matchCategoria = categoriaFilter === 'Todos' || servico.categoria === categoriaFilter
    return matchSearch && matchCategoria
  })

  const totalServicos = servicos.length
  const servicosAtivos = servicos.filter(s => s.ativo).length
  // TODO: Fix mock data for stats or pass it from server action
  
  return (
    <DashboardLayout>
      <NovaServicoModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          setModalOpen(false)
          // Data is refreshed via server action revalidatePath
        }}
      />

      <Header 
        title="Serviços" 
        subtitle={`${servicosAtivos} serviços ativos`}
        action={{
          label: 'Novo Serviço',
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
                <p className="text-sm text-slate-500">Total de Serviços</p>
                <p className="text-2xl font-bold text-slate-900">{totalServicos}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-emerald-100">
                <TrendingUp className="h-6 w-6 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Mais Pedido</p>
                <p className="text-2xl font-bold text-slate-900">-</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-amber-100">
                <Clock className="h-6 w-6 text-amber-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Tempo Médio</p>
                <p className="text-2xl font-bold text-slate-900">-</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4 flex items-center gap-4">
              <div className="p-3 rounded-xl bg-violet-100">
                <DollarSign className="h-6 w-6 text-violet-600" />
              </div>
              <div>
                <p className="text-sm text-slate-500">Margem Média</p>
                <p className="text-2xl font-bold text-slate-900">-</p>
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
                  placeholder="Buscar por nome ou descrição..."
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
                    className={`px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                      categoriaFilter === cat
                        ? 'bg-indigo-600 text-white'
                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grid de Serviços */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredServicos.map((servico) => (
            <Card key={servico.id} className={`hover:shadow-md transition-shadow ${!servico.ativo ? 'opacity-60' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <Badge variant="secondary" className="mb-2">{servico.categoria}</Badge>
                    <h3 className="font-bold text-lg text-slate-900 dark:text-white">{servico.nome}</h3>
                  </div>
                  <button className={`p-1 rounded-lg ${servico.ativo ? 'text-emerald-600' : 'text-slate-400'}`}>
                    {servico.ativo ? <ToggleRight className="h-6 w-6" /> : <ToggleLeft className="h-6 w-6" />}
                  </button>
                </div>

                <p className="text-sm text-slate-500 mb-4 line-clamp-2">{servico.descricao}</p>

                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-2xl font-bold text-indigo-600">{formatCurrency(servico.preco)}</p>
                    <p className="text-xs text-slate-400">Custo: {formatCurrency(servico.custoMateriais)}</p>
                  </div>
                  <div className="text-right">
                    <div className="flex items-center gap-1 text-emerald-600 font-medium">
                      <TrendingUp className="h-4 w-4" />
                      <span>{servico.margemLucro}%</span>
                    </div>
                    <p className="text-xs text-slate-400">margem</p>
                  </div>
                </div>

                <div className="flex items-center gap-4 text-sm text-slate-500 mb-4">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    <span>{servico.tempoProducao} dias</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Package className="h-4 w-4" />
                    <span>{servico.totalPedidos} pedidos</span>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-100 dark:border-white/5">
                  <p className="text-xs text-slate-400 mb-2">Materiais:</p>
                  <div className="flex flex-wrap gap-1">
                    {servico.materiais.length > 0 ? (
                      <>
                        {servico.materiais.slice(0, 3).map((mat, i) => (
                          <span key={i} className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-300">
                            {mat}
                          </span>
                        ))}
                        {servico.materiais.length > 3 && (
                          <span key="more" className="px-2 py-1 bg-slate-100 dark:bg-slate-800 rounded text-xs text-slate-600 dark:text-slate-300">
                            +{servico.materiais.length - 3}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-xs text-slate-400 italic">Nenhum material cadastrado</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-1 mt-4 pt-4 border-t border-slate-100">
                  <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <Eye className="h-4 w-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors">
                    <Edit className="h-4 w-4" />
                  </button>
                  <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </CardContent>
            </Card>
          ))}
          
          {/* Add New Card */}
          <Card 
            className="border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors cursor-pointer"
            onClick={() => setModalOpen(true)}
          >
            <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
              <div className="p-4 rounded-full bg-indigo-100 mb-4">
                <Plus className="h-8 w-8 text-indigo-600" />
              </div>
              <p className="font-medium text-slate-900 mb-1">Adicionar Serviço</p>
              <p className="text-sm text-slate-500">Cadastre um novo serviço</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
