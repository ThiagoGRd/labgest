'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
} from 'lucide-react'

// Mock data
const servicos = [
  {
    id: 1,
    nome: 'Prótese Total Superior',
    categoria: 'Prótese Total',
    descricao: 'Prótese total removível superior em resina acrílica',
    preco: 850.00,
    tempoProducao: 7,
    materiais: ['PMMA', 'Dentes Artiplus', 'Cera Rosa'],
    custoMateriais: 320.00,
    margemLucro: 62,
    ativo: true,
    totalPedidos: 45,
  },
  {
    id: 2,
    nome: 'Prótese Total Inferior',
    categoria: 'Prótese Total',
    descricao: 'Prótese total removível inferior em resina acrílica',
    preco: 850.00,
    tempoProducao: 7,
    materiais: ['PMMA', 'Dentes Artiplus', 'Cera Rosa'],
    custoMateriais: 320.00,
    margemLucro: 62,
    ativo: true,
    totalPedidos: 38,
  },
  {
    id: 3,
    nome: 'PPR Esquelético',
    categoria: 'Parcial Removível',
    descricao: 'Prótese parcial removível com estrutura metálica',
    preco: 950.00,
    tempoProducao: 10,
    materiais: ['Liga NiCr', 'Dentes', 'Resina Rosa'],
    custoMateriais: 380.00,
    margemLucro: 60,
    ativo: true,
    totalPedidos: 32,
  },
  {
    id: 4,
    nome: 'PPR Flexível',
    categoria: 'Parcial Removível',
    descricao: 'Prótese parcial removível flexível sem grampos metálicos',
    preco: 750.00,
    tempoProducao: 7,
    materiais: ['Resina Flexível', 'Dentes'],
    custoMateriais: 280.00,
    margemLucro: 63,
    ativo: true,
    totalPedidos: 18,
  },
  {
    id: 5,
    nome: 'Protocolo Superior',
    categoria: 'Protocolo',
    descricao: 'Prótese protocolo sobre implantes - arcada superior',
    preco: 3500.00,
    tempoProducao: 15,
    materiais: ['Barra metálica', 'Dentes Premium', 'PMMA', 'Zircônia'],
    custoMateriais: 1200.00,
    margemLucro: 66,
    ativo: true,
    totalPedidos: 12,
  },
  {
    id: 6,
    nome: 'Protocolo Inferior',
    categoria: 'Protocolo',
    descricao: 'Prótese protocolo sobre implantes - arcada inferior',
    preco: 3500.00,
    tempoProducao: 15,
    materiais: ['Barra metálica', 'Dentes Premium', 'PMMA', 'Zircônia'],
    custoMateriais: 1200.00,
    margemLucro: 66,
    ativo: true,
    totalPedidos: 10,
  },
  {
    id: 7,
    nome: 'Provisório Unitário',
    categoria: 'Provisório',
    descricao: 'Coroa provisória unitária em resina',
    preco: 180.00,
    tempoProducao: 2,
    materiais: ['Resina Bis-acrílica'],
    custoMateriais: 45.00,
    margemLucro: 75,
    ativo: true,
    totalPedidos: 85,
  },
  {
    id: 8,
    nome: 'Ponte Adesiva',
    categoria: 'Ponte Adesiva',
    descricao: 'Ponte fixa adesiva para substituição de dente anterior',
    preco: 420.00,
    tempoProducao: 5,
    materiais: ['Resina Composta', 'Fibra de Vidro'],
    custoMateriais: 120.00,
    margemLucro: 71,
    ativo: true,
    totalPedidos: 22,
  },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

const categorias = ['Todos', 'Prótese Total', 'Parcial Removível', 'Protocolo', 'Provisório', 'Ponte Adesiva']

export default function ServicosPage() {
  const [search, setSearch] = useState('')
  const [categoriaFilter, setCategoriaFilter] = useState('Todos')

  const filteredServicos = servicos.filter(servico => {
    const matchSearch = 
      servico.nome.toLowerCase().includes(search.toLowerCase()) ||
      servico.descricao.toLowerCase().includes(search.toLowerCase())
    const matchCategoria = categoriaFilter === 'Todos' || servico.categoria === categoriaFilter
    return matchSearch && matchCategoria
  })

  const totalServicos = servicos.length
  const servicosAtivos = servicos.filter(s => s.ativo).length
  const faturamentoPotencial = servicos.reduce((acc, s) => acc + (s.preco * s.totalPedidos), 0)

  return (
    <DashboardLayout>
      <Header 
        title="Serviços" 
        subtitle={`${servicosAtivos} serviços ativos`}
        action={{
          label: 'Novo Serviço',
          onClick: () => console.log('Novo serviço'),
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
                <p className="text-2xl font-bold text-slate-900">Provisório</p>
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
                <p className="text-2xl font-bold text-slate-900">8 dias</p>
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
                <p className="text-2xl font-bold text-slate-900">65%</p>
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
                    <h3 className="font-semibold text-lg text-slate-900">{servico.nome}</h3>
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

                <div className="pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400 mb-2">Materiais:</p>
                  <div className="flex flex-wrap gap-1">
                    {servico.materiais.slice(0, 3).map((mat, i) => (
                      <span key={i} className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                        {mat}
                      </span>
                    ))}
                    {servico.materiais.length > 3 && (
                      <span className="px-2 py-1 bg-slate-100 rounded text-xs text-slate-600">
                        +{servico.materiais.length - 3}
                      </span>
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
        </div>
      </div>
    </DashboardLayout>
  )
}
