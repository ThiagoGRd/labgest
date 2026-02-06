'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import {
  Building2,
  Users,
  Palette,
  Bell,
  Shield,
  Workflow,
  Save,
  Loader2,
  Plus,
  Edit,
  Trash2,
  GripVertical,
} from 'lucide-react'

// Dados mockados
const etapasProducao = [
  { id: 1, nome: 'Recebimento', cor: '#6366f1', ordem: 1 },
  { id: 2, nome: 'Planejamento/CAD', cor: '#8b5cf6', ordem: 2 },
  { id: 3, nome: 'Impressão/Fresagem', cor: '#a855f7', ordem: 3 },
  { id: 4, nome: 'Acabamento', cor: '#d946ef', ordem: 4 },
  { id: 5, nome: 'Conferência', cor: '#ec4899', ordem: 5 },
  { id: 6, nome: 'Pronto para Entrega', cor: '#22c55e', ordem: 6 },
]

const usuarios = [
  { id: 1, nome: 'Thiago Cruz', email: 'admin@labgest.com', tipo: 'admin', ativo: true },
  { id: 2, nome: 'João Silva', email: 'joao@labgest.com', tipo: 'operador', ativo: true },
  { id: 3, nome: 'Marcos Santos', email: 'marcos@labgest.com', tipo: 'operador', ativo: true },
]

export default function ConfiguracoesPage() {
  const [activeSection, setActiveSection] = useState('laboratorio')
  const [saving, setSaving] = useState(false)
  
  const [labConfig, setLabConfig] = useState({
    nome: 'Laboratório de Prótese',
    telefone: '(82) 99999-9999',
    email: 'contato@laboratorio.com',
    endereco: 'Rua Principal, 123 - Maceió, AL',
    cnpj: '12.345.678/0001-99',
  })

  const handleSave = async () => {
    setSaving(true)
    await new Promise(resolve => setTimeout(resolve, 1500))
    setSaving(false)
    alert('Configurações salvas!')
  }

  const sections = [
    { id: 'laboratorio', label: 'Laboratório', icon: Building2 },
    { id: 'usuarios', label: 'Usuários', icon: Users },
    { id: 'etapas', label: 'Etapas de Produção', icon: Workflow },
    { id: 'notificacoes', label: 'Notificações', icon: Bell },
    { id: 'aparencia', label: 'Aparência', icon: Palette },
    { id: 'seguranca', label: 'Segurança', icon: Shield },
  ]

  return (
    <DashboardLayout>
      <Header 
        title="Configurações" 
        subtitle="Personalize o sistema"
      />
      
      <div className="p-6">
        <div className="flex gap-6">
          {/* Sidebar */}
          <div className="w-64 flex-shrink-0">
            <Card>
              <CardContent className="p-2">
                <nav className="space-y-1">
                  {sections.map((section) => (
                    <button
                      key={section.id}
                      onClick={() => setActiveSection(section.id)}
                      className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                        activeSection === section.id
                          ? 'bg-indigo-100 text-indigo-700'
                          : 'text-slate-600 hover:bg-slate-100'
                      }`}
                    >
                      <section.icon className="h-5 w-5" />
                      {section.label}
                    </button>
                  ))}
                </nav>
              </CardContent>
            </Card>
          </div>

          {/* Content */}
          <div className="flex-1">
            {/* Laboratório */}
            {activeSection === 'laboratorio' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Building2 className="h-5 w-5" />
                    Dados do Laboratório
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Nome do Laboratório
                      </label>
                      <Input
                        value={labConfig.nome}
                        onChange={(e) => setLabConfig(prev => ({ ...prev, nome: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        CNPJ
                      </label>
                      <Input
                        value={labConfig.cnpj}
                        onChange={(e) => setLabConfig(prev => ({ ...prev, cnpj: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Telefone
                      </label>
                      <Input
                        value={labConfig.telefone}
                        onChange={(e) => setLabConfig(prev => ({ ...prev, telefone: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Email
                      </label>
                      <Input
                        value={labConfig.email}
                        onChange={(e) => setLabConfig(prev => ({ ...prev, email: e.target.value }))}
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Endereço
                      </label>
                      <Input
                        value={labConfig.endereco}
                        onChange={(e) => setLabConfig(prev => ({ ...prev, endereco: e.target.value }))}
                      />
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSave} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4" />
                          Salvar Alterações
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Usuários */}
            {activeSection === 'usuarios' && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Users className="h-5 w-5" />
                    Usuários do Sistema
                  </CardTitle>
                  <Button>
                    <Plus className="h-4 w-4" />
                    Novo Usuário
                  </Button>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {usuarios.map((user) => (
                      <div
                        key={user.id}
                        className="flex items-center justify-between p-4 bg-slate-50 rounded-lg"
                      >
                        <div className="flex items-center gap-4">
                          <div className="h-10 w-10 rounded-full bg-indigo-500 flex items-center justify-center text-white font-medium">
                            {user.nome.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </div>
                          <div>
                            <p className="font-medium text-slate-900">{user.nome}</p>
                            <p className="text-sm text-slate-500">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            user.tipo === 'admin' 
                              ? 'bg-purple-100 text-purple-700' 
                              : 'bg-blue-100 text-blue-700'
                          }`}>
                            {user.tipo === 'admin' ? 'Administrador' : 'Operador'}
                          </span>
                          <div className="flex gap-1">
                            <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg">
                              <Edit className="h-4 w-4" />
                            </button>
                            <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Etapas de Produção */}
            {activeSection === 'etapas' && (
              <Card>
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Workflow className="h-5 w-5" />
                    Etapas de Produção
                  </CardTitle>
                  <Button>
                    <Plus className="h-4 w-4" />
                    Nova Etapa
                  </Button>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-slate-500 mb-4">
                    Arraste para reordenar as etapas do Kanban de produção.
                  </p>
                  <div className="space-y-2">
                    {etapasProducao.map((etapa) => (
                      <div
                        key={etapa.id}
                        className="flex items-center gap-4 p-4 bg-slate-50 rounded-lg cursor-move hover:bg-slate-100 transition-colors"
                      >
                        <GripVertical className="h-5 w-5 text-slate-400" />
                        <div
                          className="w-4 h-4 rounded-full"
                          style={{ backgroundColor: etapa.cor }}
                        />
                        <span className="flex-1 font-medium text-slate-900">{etapa.nome}</span>
                        <input
                          type="color"
                          value={etapa.cor}
                          className="w-8 h-8 rounded cursor-pointer"
                          title="Alterar cor"
                        />
                        <button className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-slate-100 rounded-lg">
                          <Edit className="h-4 w-4" />
                        </button>
                        <button className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Notificações */}
            {activeSection === 'notificacoes' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Bell className="h-5 w-5" />
                    Configurações de Notificações
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-4">
                    {[
                      { label: 'Notificar quando ordem for criada', checked: true },
                      { label: 'Notificar quando ordem estiver atrasada', checked: true },
                      { label: 'Notificar quando estoque estiver baixo', checked: true },
                      { label: 'Notificar dentista quando ordem for finalizada', checked: false },
                      { label: 'Resumo diário por email', checked: false },
                    ].map((item, index) => (
                      <label key={index} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                        <span className="text-slate-700">{item.label}</span>
                        <input
                          type="checkbox"
                          defaultChecked={item.checked}
                          className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                        />
                      </label>
                    ))}
                  </div>
                  
                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSave} disabled={saving}>
                      <Save className="h-4 w-4" />
                      Salvar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Aparência */}
            {activeSection === 'aparencia' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Palette className="h-5 w-5" />
                    Aparência
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Tema
                    </label>
                    <div className="flex gap-4">
                      {['light', 'dark', 'auto'].map((tema) => (
                        <button
                          key={tema}
                          className={`flex-1 p-4 rounded-xl border-2 transition-colors ${
                            tema === 'light' 
                              ? 'border-indigo-500 bg-indigo-50' 
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className={`h-12 rounded-lg mb-2 ${
                            tema === 'light' ? 'bg-white border' : tema === 'dark' ? 'bg-slate-800' : 'bg-gradient-to-r from-white to-slate-800'
                          }`} />
                          <p className="font-medium text-slate-900 capitalize">{tema === 'auto' ? 'Automático' : tema === 'light' ? 'Claro' : 'Escuro'}</p>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-3">
                      Cor Principal
                    </label>
                    <div className="flex gap-3">
                      {['#6366f1', '#8b5cf6', '#ec4899', '#ef4444', '#f59e0b', '#22c55e', '#06b6d4'].map((cor) => (
                        <button
                          key={cor}
                          className={`w-10 h-10 rounded-full ${cor === '#6366f1' ? 'ring-2 ring-offset-2 ring-indigo-500' : ''}`}
                          style={{ backgroundColor: cor }}
                        />
                      ))}
                    </div>
                  </div>
                  
                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSave} disabled={saving}>
                      <Save className="h-4 w-4" />
                      Salvar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Segurança */}
            {activeSection === 'seguranca' && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" />
                    Segurança
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <h4 className="font-medium text-slate-900 mb-4">Alterar Senha</h4>
                    <div className="space-y-4 max-w-md">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Senha Atual
                        </label>
                        <Input type="password" placeholder="••••••••" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Nova Senha
                        </label>
                        <Input type="password" placeholder="••••••••" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1.5">
                          Confirmar Nova Senha
                        </label>
                        <Input type="password" placeholder="••••••••" />
                      </div>
                      <Button>Alterar Senha</Button>
                    </div>
                  </div>

                  <div className="pt-6 border-t">
                    <h4 className="font-medium text-slate-900 mb-4">Sessões Ativas</h4>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div>
                          <p className="font-medium text-slate-900">MacBook Air - Chrome</p>
                          <p className="text-sm text-slate-500">Maceió, AL • Agora</p>
                        </div>
                        <span className="text-xs text-emerald-600 font-medium">Sessão atual</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
