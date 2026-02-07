import React, { forwardRef } from 'react'
import { QRCodeSVG } from 'qrcode.react'

interface EtiquetaDados {
  id: number
  paciente: string
  cliente: {
    nome: string
  }
  servico: {
    nome: string
  }
  dataEntrega: string | Date
}

interface EtiquetaImpressaoProps {
  ordem: EtiquetaDados
}

export const EtiquetaImpressao = forwardRef<HTMLDivElement, EtiquetaImpressaoProps>(({ ordem }, ref) => {
  const qrData = `https://labgest-portal.vercel.app/pedidos/${ordem.id}`

  return (
    <div ref={ref} className="bg-white p-2 w-[100mm] h-[60mm] mx-auto text-slate-900 border border-slate-200 print:border-0 flex flex-row items-center justify-between overflow-hidden">
      
      {/* Lado Esquerdo: Dados */}
      <div className="flex-1 pr-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-3 border-b border-slate-900 pb-1">
          <div className="w-6 h-6 bg-slate-900 rounded flex items-center justify-center text-white font-bold text-xs">LG</div>
          <span className="font-bold text-sm tracking-wide uppercase">LabGest Entrega</span>
        </div>

        {/* Paciente (Destaque) */}
        <div className="mb-2">
          <p className="text-[10px] uppercase text-slate-500 font-bold">Paciente</p>
          <p className="text-lg font-bold leading-tight truncate">{ordem.paciente}</p>
        </div>

        {/* Dentista */}
        <div className="mb-2">
          <p className="text-[10px] uppercase text-slate-500 font-bold">Dentista</p>
          <p className="text-sm font-medium truncate">Dr(a). {ordem.cliente.nome}</p>
        </div>

        {/* Serviço */}
        <div>
          <p className="text-[10px] uppercase text-slate-500 font-bold">Serviço</p>
          <p className="text-xs truncate">{ordem.servico.nome}</p>
        </div>
      </div>

      {/* Lado Direito: QR e Meta */}
      <div className="flex flex-col items-end justify-between h-full py-1">
        <div className="text-right">
          <p className="text-[10px] uppercase text-slate-500 font-bold">Entrega</p>
          <p className="text-lg font-bold">
            {new Date(ordem.dataEntrega).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })}
          </p>
        </div>

        <div className="border-2 border-slate-900 p-1 rounded">
          <QRCodeSVG value={qrData} size={64} />
        </div>

        <div className="text-right">
          <p className="text-xs font-mono text-slate-400">#{ordem.id.toString().padStart(6, '0')}</p>
        </div>
      </div>
    </div>
  )
})

EtiquetaImpressao.displayName = 'EtiquetaImpressao'
