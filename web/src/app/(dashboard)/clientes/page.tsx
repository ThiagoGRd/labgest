'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import {
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  Phone,
  Mail,
  MapPin,
  FileText,
  DollarSign,
  UserPlus,
  MoreVertical,
} from 'lucide-react'

// Mock data
const clientes = [
  {
    id: 1,
    nome: 'Dr. João Santos',
    telefone: '(82) 99999-1234',
    email: 'joao.santos@clinica.com',
    cro: 'CRO-AL 1234',
    endereco: 'Rua das Flores, 123 - Maceió, AL',
    ativo: true,
    totalPedidos: 45,
    valorTotal: 38500.00,
    ultimoPedido: '2026-02-03',
  },
  {
    id: 2,
    nome: 'Dra. Ana Lima',
    telefone: '(82) 99998-5678',
    email: 'ana.lima@odonto.com',
    cro: 'CRO-AL 5678',
    endereco: 'Av. Principal, 456 - Maceió, AL',
    ativo: true,
    totalPedidos: 28,
    valorTotal: 24200.00,
    ultimoPedido: '2026-02-05',
  },
  {
    id: 3,
    nome: 'Dr. Paulo Costa',
    telefone: '(82) 99997-9012',
    email: 'paulo.costa@dental.com',
    cro: 'CRO-AL 9012',
    endereco: 'Rua da Paz, 789 - Arapiraca, AL',
    ativo: true,
    totalPedidos: 32,
    valorTotal: 27800.00,
    ultimoPedido: '2026-02-01',
  },
  {
    id: 4,
    nome: 'Dra. Carla Melo',
    telefone: '(82) 99996-3456',
    email: 'carla.melo@sorriso.com',
    cro: 'CRO-AL 3456',
    endereco: 'Rua do Sol, 321 - Maceió, AL',
    ativo: true,
    totalPedidos: 18,
    valorTotal: 15600.00,
    ultimoPedido: '2026-01-28',
  },
  {
    id: 5,
    nome: 'Dr. Marcos Alves',
    telefone: '(82) 99995-7890',
    email: 'marcos.alves@oral.com',
    cro: 'CRO-AL 7890',
    endereco: 'Av. da Praia, 654 - Maceió, AL',
    ativo: true,
    totalPedidos: 12,
    valorTotal: 10200.00,
    ultimoPedido: '2026-01-15',
  },
  {
    id: 6,
    nome: 'Dra. Fernanda Reis',
    telefone: '(82) 99994-1122',
    email: 'fernanda.reis@dente.com',
    cro: 'CRO-AL 1122',
    endereco: 'Rua Nova, 987 - Palmeira, AL',
    ativo: false,
    totalPedidos: 5,
    valorTotal: 4500.00,
    ultimoPedido: '2025-11-20',
  },
]

function formatCurrency(value: number) {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr)
  return date.toLocaleDateString('pt-BR')
}

export default function ClientesPage() {
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')

  const filteredClientes = clientes.filter(cliente => {
    const matchSearch = 
      cliente.nome.toLowerCase().includes(search.toLowerCase()) ||
      cliente.email.toLowerCase().includes(search.toLowerCase()) ||
      cliente.cro.toLowerCase().includes(search.toLowerCase())
    const matchStatus = showInactive || cliente.ativo
    return matchSearch && matchStatus
  })

  return (
    <DashboardLayout>
      <Header 
        title="Clientes" 
        subtitle={`${clientes.filter(c => c.ativo).length} dentistas ativos`}
        action={{
          label: 'Novo Cliente',
          onClick: () => console.log('Novo cliente'),
        }}
      />
      
      <div className="p-6 space-y-6">
        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder="Buscar por nome, email ou CRO..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-9"
                />
              </div>
              <div className="flex gap-2">
                <label className="flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showInactive}
                    onChange={(e) => setShowInactive(e.target.checked)}
                    className="rounded border-slate-300"
                  />
                  <span className="text-sm text-slate-600">Mostrar inativos</span>
                </label>
                <Button variant="outline" size="icon">
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Grid View */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredClientes.map((cliente) => (
            <Card key={cliente.id} className={`hover:shadow-md transition-shadow ${!cliente.ativo ? 'opacity-60' : ''}`}>
              <CardContent className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <Avatar name={cliente.nome} size="lg" />
                    <div>
                      <h3 className="font-semibold text-slate-900">{cliente.nome}</h3>
                      <p className="text-sm text-slate-500">{cliente.cro}</p>
                    </div>
                  </div>
                  <Badge variant={cliente.ativo ? 'success' : 'secondary'}>
                    {cliente.ativo ? 'Ativo' : 'Inativo'}
                  </Badge>
                </div>

                <div className="space-y-2 mb-4">
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Phone className="h-4 w-4 text-slate-400" />
                    <span>{cliente.telefone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <Mail className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{cliente.email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-slate-600">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    <span className="truncate">{cliente.endereco}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-slate-100">
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                      <FileText className="h-4 w-4" />
                    </div>
                    <p className="text-xl font-bold text-slate-900">{cliente.totalPedidos}</p>
                    <p className="text-xs text-slate-500">Pedidos</p>
                  </div>
                  <div className="text-center">
                    <div className="flex items-center justify-center gap-1 text-slate-400 mb-1">
                      <DollarSign className="h-4 w-4" />
                    </div>
                    <p className="text-xl font-bold text-slate-900">
                      {formatCurrency(cliente.valorTotal).replace('R$', '').trim().split(',')[0]}
                    </p>
                    <p className="text-xs text-slate-500">Total</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 pt-4 border-t border-slate-100">
                  <p className="text-xs text-slate-400">
                    Último pedido: {formatDate(cliente.ultimoPedido)}
                  </p>
                  <div className="flex items-center gap-1">
                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors">
                      <Eye className="h-4 w-4" />
                    </button>
                    <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg transition-colors">
                      <Edit className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}

          {/* Add New Card */}
          <Card className="border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors cursor-pointer">
            <CardContent className="p-6 flex flex-col items-center justify-center h-full min-h-[300px]">
              <div className="p-4 rounded-full bg-indigo-100 mb-4">
                <UserPlus className="h-8 w-8 text-indigo-600" />
              </div>
              <p className="font-medium text-slate-900 mb-1">Adicionar Cliente</p>
              <p className="text-sm text-slate-500">Cadastre um novo dentista</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  )
}
