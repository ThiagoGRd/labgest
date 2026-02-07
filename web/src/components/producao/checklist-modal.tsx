'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react'

interface ChecklistModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  etapaDestino: string
  ordemId: number
}

// Configuração dos itens de checklist por etapa
const checklistConfig: Record<string, string[]> = {
  'Planejamento': [
    'Arquivos STL verificados e íntegros',
    'Margens demarcadas corretamente',
    'Eixos de inserção definidos',
    'Espaço oclusal suficiente verificado'
  ],
  'Impressão': [
    'Suportes posicionados corretamente',
    'Resina misturada/homogeneizada',
    'Plataforma de impressão calibrada',
    'Tanque de resina limpo'
  ],
  'Acabamento': [
    'Suportes removidos sem danificar margens',
    'Peça lavada em álcool isopropílico',
    'Cura UV (Pós-cura) realizada',
    'Adaptação no modelo verificada'
  ],
  'Conferência': [
    'Adaptação marginal perfeita (vedamento)',
    'Pontos de contato ajustados',
    'Oclusão checada em articulador',
    'Cor conferida com a escala solicitada',
    'Polimento e brilho final aprovados'
  ],
  'Finalizado': [
    'Peça limpa e desinfetada',
    'Embalagem correta e identificada',
    'Ficha de impressão anexada',
    'Brinde/Mimo incluído (se aplicável)'
  ]
}

export function ChecklistModal({ isOpen, onClose, onConfirm, etapaDestino, ordemId }: ChecklistModalProps) {
  const [checkedItems, setCheckedItems] = useState<string[]>([])
  
  const itens = checklistConfig[etapaDestino] || []
  
  // Se a etapa não tiver checklist, aprova direto (ou mostra genérico)
  const hasItems = itens.length > 0

  const handleCheck = (item: string) => {
    setCheckedItems(prev => 
      prev.includes(item) 
        ? prev.filter(i => i !== item)
        : [...prev, item]
    )
  }

  const isComplete = hasItems ? checkedItems.length === itens.length : true

  const handleConfirm = () => {
    if (isComplete) {
      onConfirm()
      setCheckedItems([])
    }
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Controle de Qualidade"
      description={`Verificação obrigatória para avançar para: ${etapaDestino}`}
      size="md"
    >
      <div className="space-y-6">
        <div className="bg-indigo-50 p-4 rounded-lg flex items-start gap-3">
          <ShieldCheck className="h-6 w-6 text-indigo-600 mt-0.5" />
          <div>
            <h4 className="text-sm font-semibold text-indigo-900">Garantia de Excelência</h4>
            <p className="text-sm text-indigo-700 mt-1">
              Verifique cada item com atenção. A qualidade do laboratório depende desta etapa.
            </p>
          </div>
        </div>

        {hasItems ? (
          <div className="space-y-3">
            {itens.map((item) => (
              <div 
                key={item} 
                className={`flex items-start gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                  checkedItems.includes(item)
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-white border-slate-200 hover:border-indigo-300'
                }`}
                onClick={() => handleCheck(item)}
              >
                <div className={`mt-0.5 w-5 h-5 rounded border flex items-center justify-center transition-colors ${
                  checkedItems.includes(item)
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-slate-300 bg-white'
                }`}>
                  {checkedItems.includes(item) && <CheckCircle2 className="h-3.5 w-3.5 text-white" />}
                </div>
                <span className={`text-sm font-medium ${
                  checkedItems.includes(item) ? 'text-emerald-900' : 'text-slate-700'
                }`}>
                  {item}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500">
            <CheckCircle2 className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>Nenhum item de verificação específico para esta etapa.</p>
            <p className="text-xs mt-1">Pode prosseguir com segurança.</p>
          </div>
        )}

        {!isComplete && hasItems && (
          <p className="text-xs text-center text-red-500 font-medium flex items-center justify-center gap-1">
            <AlertTriangle className="h-3 w-3" />
            Complete todos os itens para liberar o avanço.
          </p>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t border-slate-200">
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button 
            onClick={handleConfirm} 
            disabled={!isComplete}
            className={isComplete ? 'bg-emerald-600 hover:bg-emerald-700' : ''}
          >
            {isComplete ? (
              <>
                <CheckCircle2 className="mr-2 h-4 w-4" />
                Aprovar & Avançar
              </>
            ) : (
              'Aguardando Verificação...'
            )}
          </Button>
        </div>
      </div>
    </Modal>
  )
}
