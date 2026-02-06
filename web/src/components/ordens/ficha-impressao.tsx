import React, { forwardRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'
import { cn } from '@/lib/utils'

// Tipos para o componente
interface OrdemDados {
  id: number
  paciente: string
  cliente: {
    nome: string
    cro?: string
  }
  servico: {
    nome: string
    categoria?: string
  }
  dataEntrada: Date | string
  dataEntrega: Date | string
  corDentes?: string
  observacoes?: string
  elementos?: string[] // Ex: ["11", "21"]
  etapaAtual?: string
}

interface FichaImpressaoProps {
  ordem: OrdemDados
}

// Design System local para impressão
// Usando classes do Tailwind que funcionam bem em P&B (impressão)
const Label = ({ children }: { children: React.ReactNode }) => (
  <span className="text-[10px] uppercase tracking-wider text-slate-500 font-mono mb-1 block">
    {children}
  </span>
)

const Value = ({ children, className }: { children: React.ReactNode; className?: string }) => (
  <span className={cn("text-slate-900 font-medium text-sm block", className)}>
    {children}
  </span>
)

const Divider = () => <hr className="border-slate-200 my-4 border-dashed" />

export const FichaImpressao = forwardRef<HTMLDivElement, FichaImpressaoProps>(({ ordem }, ref) => {
  const qrData = JSON.stringify({ id: ordem.id, type: 'ordem' }) // Simplificado para leitura interna

  return (
    <div ref={ref} className="bg-white p-8 w-[210mm] min-h-[297mm] mx-auto text-slate-900 print:p-0">
      {/* Header */}
      <div className="flex justify-between items-start mb-8 border-b-2 border-slate-900 pb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight mb-1">LABGEST</h1>
          <p className="text-xs font-mono text-slate-500 uppercase tracking-widest">Controle de Produção</p>
        </div>
        <div className="text-right">
          <div className="font-mono text-4xl font-bold tracking-tighter">#{ordem.id.toString().padStart(6, '0')}</div>
          <p className="text-xs text-slate-400 mt-1 font-mono">OS-ID</p>
        </div>
      </div>

      {/* Main Info Grid */}
      <div className="grid grid-cols-3 gap-8 mb-8">
        <div className="col-span-2">
          <div className="mb-6">
            <Label>Paciente</Label>
            <Value className="text-2xl font-semibold">{ordem.paciente}</Value>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>Dentista / Cliente</Label>
              <Value>{ordem.cliente.nome}</Value>
              {ordem.cliente.cro && <span className="text-xs text-slate-400">{ordem.cliente.cro}</span>}
            </div>
            <div>
              <Label>Serviço</Label>
              <Value>{ordem.servico.nome}</Value>
              <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full text-slate-600 mt-1 inline-block">
                {ordem.servico.categoria || 'Geral'}
              </span>
            </div>
          </div>
        </div>
        
        <div className="flex flex-col items-end justify-start">
          <div className="border border-slate-200 p-2 rounded mb-2">
            <QRCodeSVG value={qrData} size={100} />
          </div>
          <span className="text-[10px] text-slate-400 text-center w-[100px]">Escanear para Detalhes</span>
        </div>
      </div>

      <Divider />

      {/* Datas e Prazos */}
      <div className="bg-slate-50 border border-slate-100 rounded-lg p-4 mb-8 flex justify-between items-center">
        <div>
          <Label>Entrada</Label>
          <Value>{new Date(ordem.dataEntrada).toLocaleDateString('pt-BR')}</Value>
        </div>
        <div className="h-8 w-px bg-slate-200 border-r border-dashed" />
        <div>
          <Label>Previsão Entrega</Label>
          <Value className="text-lg">{new Date(ordem.dataEntrega).toLocaleDateString('pt-BR')}</Value>
        </div>
        <div className="h-8 w-px bg-slate-200 border-r border-dashed" />
        <div className="text-right">
          <Label>Prioridade</Label>
          <Value className="text-slate-900 font-bold">NORMAL</Value>
        </div>
      </div>

      {/* Especificações Técnicas */}
      <div className="mb-8">
        <h3 className="text-sm font-bold uppercase tracking-wider border-b border-slate-200 pb-2 mb-4 flex items-center gap-2">
          <span className="w-2 h-2 bg-slate-900 rounded-full"></span>
          Especificações
        </h3>
        
        <div className="grid grid-cols-2 gap-x-8 gap-y-6">
          <div>
            <Label>Cor (Escala Vita)</Label>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded border border-slate-300 bg-white flex items-center justify-center font-bold text-slate-700 shadow-sm">
                {ordem.corDentes || '-'}
              </div>
              <span className="text-sm text-slate-600 italic">
                {ordem.corDentes ? 'Cor selecionada' : 'Não especificada'}
              </span>
            </div>
          </div>

          <div>
            <Label>Elementos</Label>
            <Value>{ordem.elementos?.join(', ') || 'Arcada Total / Não especificado'}</Value>
          </div>

          <div className="col-span-2">
            <Label>Observações Clínicas</Label>
            <div className="bg-white border border-slate-200 rounded p-3 min-h-[80px] text-sm text-slate-700 whitespace-pre-wrap">
              {ordem.observacoes || 'Sem observações adicionais.'}
            </div>
          </div>
        </div>
      </div>

      <Divider />

      {/* Controle de Qualidade (Físico) */}
      <div className="mt-auto">
        <h3 className="text-sm font-bold uppercase tracking-wider border-b border-slate-200 pb-2 mb-4">
          Controle de Qualidade
        </h3>
        
        <div className="grid grid-cols-2 gap-4">
          {[
            'Adaptação Marginal',
            'Ponto de Contato',
            'Oclusão',
            'Cor / Textura',
            'Polimento',
            'Limpeza / Desinfecção'
          ].map((item) => (
            <div key={item} className="flex items-center justify-between border-b border-slate-100 py-2">
              <span className="text-sm text-slate-600">{item}</span>
              <div className="flex gap-2">
                <div className="w-6 h-6 border border-slate-300 rounded-sm"></div>
                <div className="w-6 h-6 border border-slate-300 rounded-sm bg-slate-100"></div>
              </div>
            </div>
          ))}
        </div>
        
        <div className="mt-8 pt-8 border-t-2 border-slate-900 flex justify-between items-end">
          <div>
            <p className="text-[10px] text-slate-400 font-mono mb-1">
              Gerado em {new Date().toLocaleString('pt-BR')} via LabGest
            </p>
            <p className="text-[10px] text-slate-400 font-mono">
              labgest.com.br
            </p>
          </div>
          <div className="text-center">
            <div className="w-48 border-b border-slate-400 mb-2"></div>
            <p className="text-xs text-slate-500 uppercase">Visto do Responsável</p>
          </div>
        </div>
      </div>
    </div>
  )
})

FichaImpressao.displayName = 'FichaImpressao'
