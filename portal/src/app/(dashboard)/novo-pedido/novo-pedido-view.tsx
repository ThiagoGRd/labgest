'use client'

import { useState } from 'react'
import { PortalLayout } from '@/components/layout/portal-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileUpload } from '@/components/ui/file-upload'
import { criarPedido } from '@/actions/pedidos'
import {
  Upload,
  FileText,
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  User,
  Package,
  Calendar,
  MessageSquare,
  Loader2,
  Mic,
} from 'lucide-react'
import { VoiceInput } from '@/components/ui/voice-input'

interface Servico {
  id: number
  nome: string
  categoria: string
  preco: number
}

interface NovoPedidoViewProps {
  user: any
  servicos: Servico[]
}

const cores = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D2', 'D3', 'D4']

export function NovoPedidoView({ user, servicos }: NovoPedidoViewProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [formData, setFormData] = useState({
    paciente: '',
    servicoId: 0,
    servicoNome: '',
    corDentes: '',
    dataEntrega: '',
    observacoes: '',
    arquivos: [] as string[],
  })

  const handleFileUpload = (path: string) => {
    if (path) {
      setFormData(prev => ({
        ...prev,
        arquivos: [...prev.arquivos, path]
      }))
    }
  }

  const removeFile = (index: number) => {
    setFormData(prev => ({
      ...prev,
      arquivos: prev.arquivos.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    
    try {
      const result = await criarPedido({
        paciente: formData.paciente,
        servicoId: formData.servicoId,
        servicoNome: formData.servicoNome,
        corDentes: formData.corDentes,
        dataEntrega: formData.dataEntrega,
        observacoes: formData.observacoes,
        arquivos: formData.arquivos,
      })

      if (result.success) {
        setStep(4)
      } else {
        setError(result.error || 'Erro ao criar pedido')
      }
    } catch (err) {
      setError('Ocorreu um erro inesperado')
    } finally {
      setLoading(false)
    }
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
  }

  return (
    <PortalLayout user={user}>
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Novo Pedido</h1>
          <p className="text-slate-500 dark:text-slate-400">Preencha os dados do caso para enviar ao laboratório</p>
        </div>

        {/* Progress Steps */}
        <div className="flex items-center justify-between mb-8">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium ${
                step >= s 
                  ? 'bg-emerald-600 text-white' 
                  : 'bg-slate-200 dark:bg-zinc-800 text-slate-500 dark:text-slate-400'
              }`}>
                {step > s ? <Check className="h-5 w-5" /> : s}
              </div>
              {s < 3 && (
                <div className={`w-24 md:w-32 h-1 mx-2 ${
                  step > s ? 'bg-emerald-600' : 'bg-slate-200 dark:bg-zinc-800'
                }`} />
              )}
            </div>
          ))}
        </div>

        <Card className="dark:bg-zinc-900 dark:border-zinc-800">
          <CardContent className="p-6">
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            )}

            {/* Step 1: Paciente e Serviço */}
            {step === 1 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Dados do Paciente</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Informe o nome do paciente e selecione o serviço</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Nome do Paciente *
                  </label>
                  <Input
                    placeholder="Ex: Maria Silva"
                    value={formData.paciente}
                    onChange={(e) => setFormData(prev => ({ ...prev, paciente: e.target.value }))}
                    className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:placeholder-zinc-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Serviço *
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {servicos.length > 0 ? servicos.map((servico) => (
                      <button
                        key={servico.id}
                        onClick={() => setFormData(prev => ({ 
                          ...prev, 
                          servicoId: servico.id,
                          servicoNome: servico.nome 
                        }))}
                        className={`p-4 rounded-lg border-2 text-left transition-colors ${
                          formData.servicoId === servico.id
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                            : 'border-slate-200 dark:border-zinc-700 hover:border-slate-300 dark:hover:border-zinc-600'
                        }`}
                      >
                        <p className="font-medium text-slate-900 dark:text-white">{servico.nome}</p>
                        <p className="text-sm text-slate-500 dark:text-slate-400">{servico.categoria || 'Geral'}</p>
                        <p className="text-emerald-600 dark:text-emerald-400 font-medium mt-1">{formatCurrency(servico.preco)}</p>
                      </button>
                    )) : (
                      <div className="col-span-2 p-4 text-center text-slate-500 dark:text-slate-400 bg-slate-50 dark:bg-zinc-800 rounded-lg">
                        Nenhum serviço disponível. Entre em contato com o laboratório.
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={() => setStep(2)}
                    disabled={!formData.paciente || !formData.servicoId}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Detalhes e Arquivos */}
            {step === 2 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Detalhes do Caso</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Especificações técnicas e arquivos</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Cor dos Dentes
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {cores.map((cor) => (
                        <button
                          key={cor}
                          onClick={() => setFormData(prev => ({ ...prev, corDentes: cor }))}
                          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                            formData.corDentes === cor
                              ? 'bg-emerald-600 text-white'
                              : 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-zinc-700'
                          }`}
                        >
                          {cor}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                      Data de Entrega Desejada
                    </label>
                    <Input
                      type="date"
                      value={formData.dataEntrega}
                      onChange={(e) => setFormData(prev => ({ ...prev, dataEntrega: e.target.value }))}
                      min={new Date().toISOString().split('T')[0]}
                      className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:calendar-picker-indicator-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Observações
                  </label>
                  <div className="space-y-3">
                    <VoiceInput 
                      onTranscript={(text) => setFormData(prev => ({ 
                        ...prev, 
                        observacoes: prev.observacoes ? prev.observacoes + ' ' + text : text 
                      }))}
                    />
                    <textarea
                      className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:text-white"
                      rows={3}
                      placeholder="Informações adicionais sobre o caso... (ou use o botão acima para ditar)"
                      value={formData.observacoes}
                      onChange={(e) => setFormData(prev => ({ ...prev, observacoes: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Arquivos (STL, ZIP, Fotos)
                  </label>
                  
                  <div className="space-y-4">
                    <FileUpload onUploadComplete={handleFileUpload} />

                    {formData.arquivos.length > 0 && (
                      <div className="space-y-2">
                        {formData.arquivos.map((path, index) => (
                          <div key={index} className="flex items-center justify-between p-3 bg-slate-50 dark:bg-zinc-800 rounded-lg">
                            <div className="flex items-center gap-3">
                              <FileText className="h-5 w-5 text-slate-400" />
                              <div>
                                <p className="text-sm font-medium text-slate-900 dark:text-white truncate max-w-[200px]">
                                  {path.split('/').pop()}
                                </p>
                                <p className="text-xs text-emerald-600 dark:text-emerald-400">Enviado</p>
                              </div>
                            </div>
                            <button
                              onClick={() => removeFile(index)}
                              className="p-1 text-slate-400 hover:text-red-600 dark:hover:text-red-400"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(1)} className="dark:bg-zinc-800 dark:text-white dark:border-zinc-700 dark:hover:bg-zinc-700">
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                  <Button onClick={() => setStep(3)} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Confirmação */}
            {step === 3 && (
              <div className="space-y-6">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Confirmação</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Revise os dados antes de enviar</p>
                  </div>
                </div>

                <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-6 space-y-4">
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Paciente</span>
                    <span className="font-medium text-slate-900 dark:text-white">{formData.paciente}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Serviço</span>
                    <span className="font-medium text-slate-900 dark:text-white">{formData.servicoNome}</span>
                  </div>
                  {formData.corDentes && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Cor dos Dentes</span>
                      <span className="font-medium text-slate-900 dark:text-white">{formData.corDentes}</span>
                    </div>
                  )}
                  {formData.dataEntrega && (
                    <div className="flex justify-between">
                      <span className="text-slate-500 dark:text-slate-400">Data de Entrega</span>
                      <span className="font-medium text-slate-900 dark:text-white">
                        {new Date(formData.dataEntrega).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-slate-400">Arquivos</span>
                    <span className="font-medium text-slate-900 dark:text-white">{formData.arquivos.length} arquivo(s)</span>
                  </div>
                  {formData.observacoes && (
                    <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                      <span className="text-slate-500 dark:text-slate-400 block mb-2">Observações</span>
                      <p className="text-slate-900 dark:text-white">{formData.observacoes}</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)} className="dark:bg-zinc-800 dark:text-white dark:border-zinc-700 dark:hover:bg-zinc-700">
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                  <Button onClick={handleSubmit} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {loading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        Enviar Pedido
                        <Check className="h-4 w-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Success */}
            {step === 4 && (
              <div className="text-center py-8">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Pedido Enviado!</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                  Seu pedido foi recebido pelo laboratório. Você pode acompanhar o status na página de pedidos.
                </p>
                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={() => window.location.href = '/pedidos'} className="dark:bg-zinc-800 dark:text-white dark:border-zinc-700 dark:hover:bg-zinc-700">
                    Ver Meus Pedidos
                  </Button>
                  <Button onClick={() => {
                    setStep(1)
                    setFormData({
                      paciente: '',
                      servicoId: 0,
                      servicoNome: '',
                      corDentes: '',
                      dataEntrega: '',
                      observacoes: '',
                      arquivos: [],
                    })
                  }} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Novo Pedido
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PortalLayout>
  )

}
