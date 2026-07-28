'use client'

import { type ComponentProps, useRef } from 'react'
import { CheckCircle2, Printer } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'
import { NotaEntrega } from '@/components/ordens/nota-entrega'

export interface ComprovanteEntregaModalProps {
  ordem: ComponentProps<typeof NotaEntrega>['ordem']
  onClose: () => void
}

export function ComprovanteEntregaModal({ ordem, onClose }: ComprovanteEntregaModalProps) {
  const comprovanteRef = useRef<HTMLDivElement>(null)
  const imprimir = useReactToPrint({
    contentRef: comprovanteRef,
    documentTitle: `comprovante-entrega-os-${ordem.id}`,
  })

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={`Comprovante da OS #${ordem.id}`}
      description="Entrega confirmada e sincronizada com o financeiro"
      size="lg"
      mobileFullscreen
    >
      <div className="space-y-5">
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200">
          <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
          <div>
            <p className="font-bold">Trabalho marcado como entregue.</p>
            <p className="mt-0.5">Confira o comprovante abaixo antes de imprimir ou fechar.</p>
          </div>
        </div>

        <div className="overflow-auto rounded-2xl border border-slate-200 bg-slate-100 p-3 dark:border-white/10 dark:bg-black/20 sm:p-6">
          <NotaEntrega ref={comprovanteRef} ordem={ordem} />
        </div>

        <div className="flex flex-col-reverse gap-2 border-t pt-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose}>Fechar</Button>
          <Button type="button" onClick={() => imprimir()}>
            <Printer className="h-4 w-4" />
            Imprimir comprovante
          </Button>
        </div>
      </div>
    </Modal>
  )
}
