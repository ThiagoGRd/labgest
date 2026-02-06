'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar } from '@/components/ui/avatar'
import { NovoClienteModal } from '@/components/clientes/novo-cliente-modal'
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

// Tipo dos dados vindo do servidor
interface Cliente {
  id: number
  nome: string
  telefone: string
  email: string
  cro: string
  endereco: string
  ativo: boolean | null
  totalPedidos: number
  valorTotal: number
  ultimoPedido: string | null
}

interface ClientesViewProps {
  initialData: Cliente[]
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

export function ClientesView({ initialData }: ClientesViewProps) {
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  // Usar dados reais se existirem, senão usar lista vazia
  const clientes = initialData || []

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
      <NovoClienteModal 
        isOpen={modalOpen} 
        onClose={() => setModalOpen(false)}
        onSuccess={() => {
          // A página será revalidada automaticamente pelo Server Action
          setModalOpen(false)
          alert('Cliente cadastrado com sucesso!')
        }}
      />
      
      <Header 
        title="Clientes" 
        subtitle={`${clientes.filter(c => c.ativo).length} dentistas ativos`}
        action={{
          label: 'Novo Cliente',
          onClick: () => setModalOpen(true),
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
          <Card 
            className="border-2 border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50/50 transition-colors cursor-pointer"
            onClick={() => setModalOpen(true)}
          >
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
