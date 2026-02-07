'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { updateLabConfig } from '@/actions/configuracoes'
import { criarUsuario, toggleStatusUsuario, excluirUsuario } from '@/actions/usuarios'
import { saveNotificacoesConfig } from '@/actions/notificacoes'
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
  CheckCircle2,
  XCircle,
} from 'lucide-react'

// Interfaces
interface Configuracao {
  id: number
  nome_laboratorio: string
  endereco: string | null
  telefone: string | null
  email: string | null
  cnpj: string | null
}

interface Usuario {
  id: number
  nome: string
  email: string
  tipo: string | null
  ativo: boolean | null
}

interface ConfiguracoesViewProps {
  initialConfig: Configuracao | null
  usuarios: Usuario[]
}

// Mock para etapas (implementaremos na próxima fase se desejar)
const etapasProducao = [
  { id: 1, nome: 'Recebimento', cor: '#6366f1', ordem: 1 },
  { id: 2, nome: 'Planejamento/CAD', cor: '#8b5cf6', ordem: 2 },
  { id: 3, nome: 'Impressão/Fresagem', cor: '#a855f7', ordem: 3 },
  { id: 4, nome: 'Acabamento', cor: '#d946ef', ordem: 4 },
  { id: 5, nome: 'Conferência', cor: '#ec4899', ordem: 5 },
  { id: 6, nome: 'Pronto para Entrega', cor: '#22c55e', ordem: 6 },
]

export function ConfiguracoesView({ initialConfig, usuarios }: ConfiguracoesViewProps) {
  const [activeSection, setActiveSection] = useState('laboratorio')
  const [saving, setSaving] = useState(false)
  const [showNewUser, setShowNewUser] = useState(false)
  
  // State Lab Config
  const [labConfig, setLabConfig] = useState({
    nome_laboratorio: initialConfig?.nome_laboratorio || 'Laboratório de Prótese',
    telefone: initialConfig?.telefone || '',
    email: initialConfig?.email || '',
    endereco: initialConfig?.endereco || '',
    cnpj: initialConfig?.cnpj || '',
  })

  // State New User
  const [newUser, setNewUser] = useState({
    nome: '',
    email: '',
    tipo: 'operador',
    senha: ''
  })

  // State Notificações
  const [notificacoes, setNotificacoes] = useState({
    novaOrdem: true,
    atrasos: true,
    estoqueBaixo: true,
    ordemFinalizada: false,
    resumoDiario: false
  })

  const handleSaveLab = async () => {
    setSaving(true)
    try {
      const result = await updateLabConfig(labConfig)
      if (!result.success) alert('Erro ao salvar')
    } finally {
      setSaving(false)
    }
  }

  const handleCreateUser = async () => {
    if (!newUser.nome || !newUser.email || !newUser.senha) return
    setSaving(true)
    try {
      const result = await criarUsuario({
        nome: newUser.nome,
        email: newUser.email,
        tipo: newUser.tipo,
        senhaProvisoria: newUser.senha
      })
      if (result.success) {
        setShowNewUser(false)
        setNewUser({ nome: '', email: '', tipo: 'operador', senha: '' })
      } else {
        alert(result.error)
      }
    } finally {
      setSaving(false)
    }
  }

  const handleSaveNotificacoes = async () => {
    setSaving(true)
    try {
      await saveNotificacoesConfig(notificacoes)
    } finally {
      setSaving(false)
    }
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
      <Header title="Configurações" subtitle="Personalize o sistema" />
      
      <div className="p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Sidebar */}
          <div className="w-full md:w-64 flex-shrink-0">
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
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Nome do Laboratório</label>
                      <Input value={labConfig.nome_laboratorio} onChange={(e) => setLabConfig({...labConfig, nome_laboratorio: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">CNPJ</label>
                      <Input value={labConfig.cnpj} onChange={(e) => setLabConfig({...labConfig, cnpj: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Telefone</label>
                      <Input value={labConfig.telefone} onChange={(e) => setLabConfig({...labConfig, telefone: e.target.value})} />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Email</label>
                      <Input value={labConfig.email} onChange={(e) => setLabConfig({...labConfig, email: e.target.value})} />
                    </div>
                    <div className="md:col-span-2">
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">Endereço</label>
                      <Input value={labConfig.endereco} onChange={(e) => setLabConfig({...labConfig, endereco: e.target.value})} />
                    </div>
                  </div>
                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSaveLab} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar Alterações
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
                  <Button onClick={() => setShowNewUser(!showNewUser)} variant={showNewUser ? "outline" : "default"}>
                    {showNewUser ? 'Cancelar' : <><Plus className="h-4 w-4 mr-2" /> Novo Usuário</>}
                  </Button>
                </CardHeader>
                <CardContent>
                  {showNewUser && (
                    <div className="mb-6 p-4 border border-indigo-100 bg-indigo-50 rounded-lg space-y-4">
                      <h4 className="font-medium text-indigo-900">Novo Cadastro</h4>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <Input placeholder="Nome Completo" value={newUser.nome} onChange={e => setNewUser({...newUser, nome: e.target.value})} />
                        <Input placeholder="Email" type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} />
                        <Select value={newUser.tipo || 'operador'} onValueChange={v => setNewUser({...newUser, tipo: v})}>
                          <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="operador">Operador (Acesso padrão)</SelectItem>
                            <SelectItem value="admin">Administrador (Acesso total)</SelectItem>
                          </SelectContent>
                        </Select>
                        <Input placeholder="Senha Provisória" type="password" value={newUser.senha} onChange={e => setNewUser({...newUser, senha: e.target.value})} />
                      </div>
                      <div className="flex justify-end">
                        <Button onClick={handleCreateUser} disabled={saving} className="bg-indigo-600 hover:bg-indigo-700">
                          {saving ? 'Criando...' : 'Cadastrar Usuário'}
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-3">
                    {usuarios.map((user) => (
                      <div key={user.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-lg">
                        <div className="flex items-center gap-4">
                          <div className={`h-10 w-10 rounded-full flex items-center justify-center text-white font-medium ${user.ativo ? 'bg-indigo-500' : 'bg-slate-400'}`}>
                            {user.nome.substring(0, 2).toUpperCase()}
                          </div>
                          <div>
                            <p className={`font-medium ${user.ativo ? 'text-slate-900' : 'text-slate-500'}`}>{user.nome}</p>
                            <p className="text-sm text-slate-500">{user.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                            user.tipo === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
                          }`}>
                            {user.tipo === 'admin' ? 'Admin' : 'Operador'}
                          </span>
                          <div className="flex gap-2">
                            <button 
                              onClick={() => toggleStatusUsuario(user.id, !!user.ativo)}
                              title={user.ativo ? 'Desativar' : 'Ativar'}
                              className={`p-2 rounded-lg transition-colors ${user.ativo ? 'text-emerald-600 hover:bg-emerald-50' : 'text-slate-400 hover:bg-slate-100'}`}
                            >
                              {user.ativo ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                            </button>
                            <button 
                              onClick={() => {
                                if (confirm('Tem certeza que deseja excluir este usuário?')) {
                                  excluirUsuario(user.id, user.email)
                                }
                              }}
                              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg"
                            >
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
                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                      <span className="text-slate-700">Notificar quando nova ordem for criada</span>
                      <input type="checkbox" checked={notificacoes.novaOrdem} onChange={e => setNotificacoes({...notificacoes, novaOrdem: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                      <span className="text-slate-700">Notificar quando ordem estiver atrasada</span>
                      <input type="checkbox" checked={notificacoes.atrasos} onChange={e => setNotificacoes({...notificacoes, atrasos: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                      <span className="text-slate-700">Notificar quando estoque estiver baixo</span>
                      <input type="checkbox" checked={notificacoes.estoqueBaixo} onChange={e => setNotificacoes({...notificacoes, estoqueBaixo: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </label>
                    <label className="flex items-center justify-between p-4 bg-slate-50 rounded-lg cursor-pointer hover:bg-slate-100">
                      <span className="text-slate-700">Notificar dentista quando ordem for finalizada (Email)</span>
                      <input type="checkbox" checked={notificacoes.ordemFinalizada} onChange={e => setNotificacoes({...notificacoes, ordemFinalizada: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                    </label>
                  </div>
                  <div className="flex justify-end pt-4 border-t">
                    <Button onClick={handleSaveNotificacoes} disabled={saving}>
                      {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
                      Salvar Preferências
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Outras seções */}
            {['etapas', 'aparencia', 'seguranca'].includes(activeSection) && (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <Workflow className="h-6 w-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900">Em Breve</h3>
                  <p className="text-slate-500 mt-2">
                    Estamos trabalhando nesta funcionalidade. Aguarde a próxima atualização! 🚀
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  )
}
