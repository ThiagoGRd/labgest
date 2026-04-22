'use client'

import { useState } from 'react'
import { PortalLayout } from '@/components/layout/portal-layout'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { FileUpload } from '@/components/ui/file-upload'
import { criarPedidoBatch } from '@/actions/pedidos'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import {
  FileText,
  X,
  Check,
  ChevronRight,
  ChevronLeft,
  User,
  Package,
  Loader2,
  Plus,
  Trash2,
} from 'lucide-react'
import { VoiceInput } from '@/components/ui/voice-input'
import { addDaysSkippingSundays, toDateInputValue } from '@/lib/utils'

interface Servico {
  id: number
  nome: string
  categoria: string
  preco: number
  tempoProducao?: number
}

interface NovoPedidoViewProps {
  user: any
  servicos: Servico[]
}

const cores = ['A1', 'A2', 'A3', 'A3.5', 'A4', 'B1', 'B2', 'B3', 'B4', 'C1', 'C2', 'C3', 'C4', 'D2', 'D3', 'D4']

interface ItemPedido {
  id: string
  servicoId: number
  servicoNome: string
  elementos: string
  corDentes: string
  preco: number
}

export function NovoPedidoView({ user, servicos }: NovoPedidoViewProps) {
  const [step, setStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  
  // Dados Globais
  const [globalData, setGlobalData] = useState({
    paciente: '',
    dataEntrega: '',
    observacoes: '',
    arquivos: [] as string[],
  })

  // Quadro Clínico
  const [dadosClinicos, setDadosClinicos] = useState({
    // Dados Clínicos
    dvo: false,
    registroMordida: false,
    linhaMedia: false,
    oclusao: false,
    corredorBucal: false,
    // Escala
    corGengiva: '',
    // Solicitação
    moldeiraIndividual: false,
    planoCera: false,
    montagemDente: false,
    barraProtocolo: false,
    acrilizacao: false,
    conserto: false
  })

  // Itens
  const [itens, setItens] = useState<ItemPedido[]>([])
  
  // Item sendo adicionado
  const [currentItem, setCurrentItem] = useState({
    servicoId: '',
    elementos: '',
    corDentes: '',
  })

  const handleAddItem = () => {
    if (!currentItem.servicoId) return
    const servico = servicos.find(s => s.id.toString() === currentItem.servicoId)
    
    setItens(prev => [
      ...prev,
      {
        id: Math.random().toString(36).substr(2, 9),
        servicoId: Number(currentItem.servicoId),
        servicoNome: servico?.nome || '',
        elementos: currentItem.elementos,
        corDentes: currentItem.corDentes,
        preco: servico?.preco || 0
      }
    ])

    // Auto-calculo da Data Sugerida pulando domingos
    if (servico && servico.tempoProducao) {
      const dataSugerida = toDateInputValue(addDaysSkippingSundays(servico.tempoProducao))
      setGlobalData(prev => {
        if (!prev.dataEntrega || new Date(dataSugerida) > new Date(prev.dataEntrega)) {
          return { ...prev, dataEntrega: dataSugerida }
        }
        return prev
      })
    }

    setCurrentItem(prev => ({ ...prev, servicoId: '', elementos: '' }))
  }

  const handleRemoveItem = (id: string) => {
    setItens(prev => prev.filter(i => i.id !== id))
  }

  const handleFileUpload = (path: string) => {
    if (path) {
      setGlobalData(prev => ({
        ...prev,
        arquivos: [...prev.arquivos, path]
      }))
    }
  }

  const removeFile = (index: number) => {
    setGlobalData(prev => ({
      ...prev,
      arquivos: prev.arquivos.filter((_, i) => i !== index)
    }))
  }

  const handleSubmit = async () => {
    if (itens.length === 0) {
      setError('Adicione pelo menos um serviço')
      return
    }

    setLoading(true)
    setError('')
    
    try {
      const result = await criarPedidoBatch({
        paciente: globalData.paciente,
        dataEntrega: globalData.dataEntrega,
        observacoes: globalData.observacoes,
        arquivos: globalData.arquivos,
        dadosClinicos: dadosClinicos,
        itens: itens.map(i => ({
          servicoId: i.servicoId,
          elementos: i.elementos,
          corDentes: i.corDentes
        }))
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Novo Pedido (Multi-Serviços)</h1>
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

            {/* Step 1: Paciente e Data */}
            {step === 1 && (
              <div className="space-y-6 animate-in">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <User className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Dados do Caso</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Identificação do paciente e prazo</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Nome do Paciente *
                  </label>
                  <Input
                    placeholder="Ex: Maria Silva"
                    value={globalData.paciente}
                    onChange={(e) => setGlobalData(prev => ({ ...prev, paciente: e.target.value }))}
                    className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:placeholder-zinc-500"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Data de Entrega Desejada *
                  </label>
                  <Input
                    type="date"
                    value={globalData.dataEntrega}
                    onChange={(e) => setGlobalData(prev => ({ ...prev, dataEntrega: e.target.value }))}
                    min={new Date().toISOString().split('T')[0]}
                    className="dark:bg-zinc-800 dark:border-zinc-700 dark:text-white dark:calendar-picker-indicator-white"
                  />
                </div>

                <div className="flex justify-end">
                  <Button 
                    onClick={() => setStep(2)}
                    disabled={!globalData.paciente || !globalData.dataEntrega}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white"
                  >
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 2: Adicionar Serviços */}
            {step === 2 && (
              <div className="space-y-6 animate-in">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <Package className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Serviços</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Adicione os serviços para este paciente</p>
                  </div>
                </div>

                {/* Form de Adição */}
                <div className="p-4 bg-slate-50 dark:bg-zinc-800/50 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Serviço</label>
                    <Select 
                      value={currentItem.servicoId} 
                      onValueChange={(val) => setCurrentItem(p => ({ ...p, servicoId: val }))}
                    >
                      <SelectTrigger className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        {servicos.map(s => <SelectItem key={s.id} value={s.id.toString()}>{s.nome} - {formatCurrency(s.preco)}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Dentes / Elementos</label>
                      <Input
                        value={currentItem.elementos}
                        onChange={e => setCurrentItem(p => ({ ...p, elementos: e.target.value }))}
                        className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700"
                        placeholder="Ex: 11, 21..."
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase text-slate-500 mb-1">Cor</label>
                      <Select 
                        value={currentItem.corDentes} 
                        onValueChange={(val) => setCurrentItem(p => ({ ...p, corDentes: val }))}
                      >
                        <SelectTrigger className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700">
                          <SelectValue placeholder="Cor" />
                        </SelectTrigger>
                        <SelectContent>
                          {cores.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Button 
                    onClick={handleAddItem}
                    disabled={!currentItem.servicoId}
                    className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    Adicionar Serviço
                  </Button>
                </div>

                {/* Lista */}
                {itens.length > 0 ? (
                  <div className="space-y-2">
                    {itens.map((item, idx) => (
                      <div key={item.id} className="flex items-center justify-between p-3 bg-white dark:bg-zinc-900 border border-slate-100 dark:border-zinc-800 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="h-6 w-6 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center text-xs font-bold text-emerald-700 dark:text-emerald-400">
                            {idx + 1}
                          </div>
                          <div>
                            <p className="text-sm font-bold text-slate-900 dark:text-white">{item.servicoNome}</p>
                            <p className="text-xs text-slate-500">
                              {item.elementos && `Elem: ${item.elementos} • `}
                              {item.corDentes && `Cor: ${item.corDentes}`}
                            </p>
                          </div>
                        </div>
                        <Button variant="ghost" size="sm" onClick={() => handleRemoveItem(item.id)} className="text-red-500 hover:bg-red-50">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-4 text-slate-400 text-sm">Nenhum serviço adicionado.</div>
                )}

                <div className="flex justify-between pt-4">
                  <Button variant="outline" onClick={() => setStep(1)}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                  <Button onClick={() => setStep(3)} disabled={itens.length === 0} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    Próximo
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Arquivos e Finalização */}
            {step === 3 && (
              <div className="space-y-6 animate-in">
                <div className="flex items-center gap-3 mb-6">
                  <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
                    <Check className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white">Arquivos e Envio</h3>
                    <p className="text-sm text-slate-500 dark:text-slate-400">Anexe arquivos e revise o pedido</p>
                  </div>
                </div>

                {/* Quadro Clínico */}
                <div className="bg-slate-50 dark:bg-zinc-800/50 p-5 rounded-xl border border-slate-200 dark:border-zinc-700 space-y-6 mb-6">
                  <h4 className="font-bold text-slate-900 dark:text-white border-b border-slate-200 dark:border-zinc-700 pb-2">Quadro Clínico e Solicitações</h4>
                  
                  {/* Dados Clínicos e Solicitação em Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h5 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-3">Dados Clínicos</h5>
                      <div className="space-y-3">
                        {[
                          { key: 'dvo', label: 'D.V.O.' },
                          { key: 'registroMordida', label: 'Registro de Mordida' },
                          { key: 'linhaMedia', label: 'Linha Média' },
                          { key: 'oclusao', label: 'Oclusão' },
                          { key: 'corredorBucal', label: 'Corredor Bucal' },
                        ].map((item) => (
                          <div key={item.key} className="flex items-center space-x-2">
                            <Checkbox 
                              id={item.key} 
                              checked={dadosClinicos[item.key as keyof typeof dadosClinicos] as boolean}
                              onCheckedChange={(checked) => setDadosClinicos(prev => ({ ...prev, [item.key]: checked === true }))}
                            />
                            <label htmlFor={item.key} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-slate-300">
                              {item.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <h5 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-3">Solicitação Específica</h5>
                      <div className="space-y-3">
                        {[
                          { key: 'moldeiraIndividual', label: 'Moldeira Individual' },
                          { key: 'planoCera', label: 'Plano de Cera' },
                          { key: 'montagemDente', label: 'Montagem de Dente' },
                          { key: 'barraProtocolo', label: 'Barra de Protocolo' },
                          { key: 'acrilizacao', label: 'Acrilização' },
                          { key: 'conserto', label: 'Conserto' },
                        ].map((item) => (
                          <div key={item.key} className="flex items-center space-x-2">
                            <Checkbox 
                              id={item.key} 
                              checked={dadosClinicos[item.key as keyof typeof dadosClinicos] as boolean}
                              onCheckedChange={(checked) => setDadosClinicos(prev => ({ ...prev, [item.key]: checked === true }))}
                            />
                            <label htmlFor={item.key} className="text-sm leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 dark:text-slate-300">
                              {item.label}
                            </label>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Escala (Gengiva) */}
                  <div className="pt-4 border-t border-slate-200 dark:border-zinc-700">
                    <h5 className="text-xs font-bold uppercase text-slate-500 dark:text-slate-400 mb-3">Escala</h5>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">Cor da Gengiva</label>
                        <Input
                          placeholder="Ex: Escala STG, Tom Rosa Médio..."
                          value={dadosClinicos.corGengiva}
                          onChange={(e) => setDadosClinicos(prev => ({ ...prev, corGengiva: e.target.value }))}
                          className="bg-white dark:bg-zinc-900 border-slate-200 dark:border-zinc-700"
                        />
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 flex items-center bg-blue-50 dark:bg-blue-900/10 p-3 rounded-lg border border-blue-100 dark:border-blue-900/30">
                        <User className="h-4 w-4 mr-2 text-blue-500" />
                        A cor do Dente deverá ser definida individualmente em cada serviço que compõe a ordem, no passo anterior.
                      </div>
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Observações Gerais
                  </label>
                  <div className="space-y-3">
                    <VoiceInput 
                      onTranscript={(text) => setGlobalData(prev => ({ 
                        ...prev, 
                        observacoes: prev.observacoes ? prev.observacoes + ' ' + text : text 
                      }))}
                    />
                    <textarea
                      className="w-full rounded-lg border border-slate-300 dark:border-zinc-700 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 dark:bg-zinc-800 dark:text-white"
                      rows={3}
                      placeholder="Informações adicionais..."
                      value={globalData.observacoes}
                      onChange={(e) => setGlobalData(prev => ({ ...prev, observacoes: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Arquivos (STL, ZIP, Fotos)
                  </label>
                  <FileUpload onUploadComplete={handleFileUpload} />
                  {globalData.arquivos.length > 0 && (
                    <div className="mt-2 space-y-2">
                      {globalData.arquivos.map((path, index) => (
                        <div key={index} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-zinc-800 rounded text-sm">
                          <span className="truncate max-w-[200px]">{path.split('/').pop()}</span>
                          <button onClick={() => removeFile(index)}><X className="h-4 w-4 text-slate-400" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-slate-50 dark:bg-zinc-800 rounded-xl p-4">
                  <h4 className="font-bold text-sm mb-2">Resumo</h4>
                  <p className="text-sm">Paciente: <span className="font-medium">{globalData.paciente}</span></p>
                  <p className="text-sm">Itens: <span className="font-medium">{itens.length}</span></p>
                  <p className="text-sm">Total Estimado: <span className="font-medium text-emerald-600">{formatCurrency(itens.reduce((acc, i) => acc + i.preco, 0))}</span></p>
                </div>

                <div className="flex justify-between">
                  <Button variant="outline" onClick={() => setStep(2)}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Voltar
                  </Button>
                  <Button onClick={handleSubmit} disabled={loading} className="bg-emerald-600 hover:bg-emerald-700 text-white">
                    {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Envio'}
                  </Button>
                </div>
              </div>
            )}

            {/* Step 4: Success */}
            {step === 4 && (
              <div className="text-center py-8 animate-in">
                <div className="w-20 h-20 bg-emerald-100 dark:bg-emerald-900/30 rounded-full flex items-center justify-center mx-auto mb-6">
                  <Check className="h-10 w-10 text-emerald-600 dark:text-emerald-400" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Pedido Enviado!</h3>
                <p className="text-slate-500 dark:text-slate-400 mb-6">
                  Foram geradas {itens.length} ordens de serviço com sucesso.
                </p>
                <div className="flex justify-center gap-4">
                  <Button variant="outline" onClick={() => window.location.href = '/pedidos'}>
                    Ver Pedidos
                  </Button>
                  <Button onClick={() => window.location.reload()} className="bg-emerald-600 text-white">
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