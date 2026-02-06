'use client'

import { useState } from 'react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { updateLabConfig } from '@/actions/configuracoes'
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

// Interfaces
interface Configuracao {
  id: number
  nome_laboratorio: string
  endereco: string | null
  telefone: string | null
  email: string | null
  cnpj: string | null
}

interface ConfiguracoesViewProps {
  initialConfig: Configuracao | null
}

// Dados mockados para outras seções
const etapasProducao = [
  { id: 1, nome: 'Recebimento', cor: '#6366f1', ordem: 1 },
  { id: 2, nome: 'Planejamento/CAD', cor: '#8b5cf6', ordem: 2 },
  { id: 3, nome: 'Impressão/Fresagem', cor: '#a855f7', ordem: 3 },
  { id: 4, nome: 'Acabamento', cor: '#d946ef', ordem: 4 },
  { id: 5, nome: 'Conferência', cor: '#ec4899', ordem: 5 },
  { id: 6, nome: 'Pronto para Entrega', cor: '#22c55e', ordem: 6 },
]

export function ConfiguracoesView({ initialConfig }: ConfiguracoesViewProps) {
  const [activeSection, setActiveSection] = useState('laboratorio')
  const [saving, setSaving] = useState(false)
  
  const [labConfig, setLabConfig] = useState({
    nome_laboratorio: initialConfig?.nome_laboratorio || 'Laboratório de Prótese',
    telefone: initialConfig?.telefone || '',
    email: initialConfig?.email || '',
    endereco: initialConfig?.endereco || '',
    cnpj: initialConfig?.cnpj || '',
  })

  const handleSaveLab = async () => {
    setSaving(true)
    try {
      const result = await updateLabConfig(labConfig)
      if (result.success) {
        // Sucesso silencioso ou toast se tivesse
      } else {
        alert('Erro ao salvar')
      }
    } catch (error) {
      alert('Erro inesperado')
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
      <Header 
        title="Configurações" 
        subtitle="Personalize o sistema"
      />
      
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
                      <label className="block text-sm font-medium text-slate-700 mb-1.5">
                        Nome do Laboratório
                      </label>
                      <Input
                        value={labConfig.nome_laboratorio}
                        onChange={(e) => setLabConfig(prev => ({ ...prev, nome_laboratorio: e.target.value }))}
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
                    <div className="md:col-span-2">
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
                    <Button onClick={handleSaveLab} disabled={saving}>
                      {saving ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin mr-2" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Save className="h-4 w-4 mr-2" />
                          Salvar Alterações
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Outras seções (Visual Only por enquanto) */}
            {activeSection !== 'laboratorio' && (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="mx-auto w-12 h-12 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <Workflow className="h-6 w-6 text-slate-400" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900">Em Desenvolvimento</h3>
                  <p className="text-slate-500 mt-2">
                    Esta funcionalidade estará disponível na próxima atualização do sistema.
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
