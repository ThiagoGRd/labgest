import React, { forwardRef } from 'react'

interface NotaEntregaDados {
  id: number
  paciente: string
  cliente: { nome: string }
  servico: string
  valor: number
  dataEntrega: string | Date
}

interface NotaEntregaProps {
  ordem: NotaEntregaDados
}

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export const NotaEntrega = forwardRef<HTMLDivElement, NotaEntregaProps>(({ ordem }, ref) => {
  const dataEntrega = new Date()

  return (
    <div
      ref={ref}
      className="bg-white text-slate-900 mx-auto"
      style={{ width: '80mm', padding: '6mm', fontFamily: 'monospace', fontSize: '11px' }}
    >
      {/* Cabeçalho */}
      <div style={{ textAlign: 'center', borderBottom: '1px dashed #555', paddingBottom: '6px', marginBottom: '8px' }}>
        <div style={{ fontWeight: 'bold', fontSize: '14px', letterSpacing: '2px' }}>LABGEST</div>
        <div style={{ fontSize: '9px', color: '#666', marginTop: '2px' }}>COMPROVANTE DE ENTREGA</div>
      </div>

      {/* Número da OS */}
      <div style={{ textAlign: 'center', marginBottom: '8px' }}>
        <span style={{ fontSize: '10px', color: '#666' }}>OS Nº </span>
        <span style={{ fontWeight: 'bold', fontSize: '13px' }}>
          #{ordem.id.toString().padStart(6, '0')}
        </span>
      </div>

      {/* Linha divisória */}
      <div style={{ borderTop: '1px dashed #aaa', marginBottom: '8px' }} />

      {/* Dados */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
        <Row label="PACIENTE" value={ordem.paciente} />
        <Row label="DENTISTA" value={ordem.cliente.nome} />
        <Row label="SERVIÇO" value={ordem.servico} />
        <Row label="DATA ENTREGA" value={dataEntrega.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })} />
      </div>

      {/* Linha divisória */}
      <div style={{ borderTop: '1px dashed #aaa', margin: '8px 0' }} />

      {/* Valor */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontWeight: 'bold', fontSize: '11px' }}>TOTAL</span>
        <span style={{ fontWeight: 'bold', fontSize: '14px' }}>{formatCurrency(ordem.valor)}</span>
      </div>

      {/* Rodapé */}
      <div style={{ borderTop: '1px dashed #aaa', marginTop: '8px', paddingTop: '6px', textAlign: 'center', fontSize: '9px', color: '#888' }}>
        <div>Obrigado pela preferência!</div>
        <div style={{ marginTop: '2px' }}>
          {new Date().toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
        </div>
      </div>
    </div>
  )
})

NotaEntrega.displayName = 'NotaEntrega'

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontSize: '9px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontWeight: 'bold', fontSize: '11px', marginTop: '1px' }}>{value}</div>
    </div>
  )
}
