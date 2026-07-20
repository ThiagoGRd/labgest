import { forwardRef } from 'react'
import { etapaLabel } from '@/lib/workflow-config'

export interface OrdemPrioridade {
  id: number
  nomePaciente: string
  servicoNome: string
  clienteNome: string
  dataEntrega: Date | string
  etapaAtual: string | null
  status: string | null
  prioridade: string
  cpfCadastrado: boolean
  respostaDentista?: string
  observacaoResposta?: string | null
  fornecedor?: string
  prazoFornecedor?: string
}

export interface RelatorioPrioridadesProps {
  respostasDentista: OrdemPrioridade[]
  fornecedorAtrasado: OrdemPrioridade[]
  atrasados: OrdemPrioridade[]
  provasPendentesClinicorp: OrdemPrioridade[]
  hoje: OrdemPrioridade[]
  urgentes: OrdemPrioridade[]
  proximos: OrdemPrioridade[]
}

interface SecaoRelatorioProps {
  titulo: string
  ordens: OrdemPrioridade[]
  observacao?: string
}

const formatarData = (data: Date | string) =>
  new Date(data).toLocaleDateString('pt-BR', { timeZone: 'UTC' })

function SecaoRelatorio({ titulo, ordens, observacao }: SecaoRelatorioProps) {
  return (
    <section className="mb-7 break-inside-avoid">
      <div className="mb-2 flex items-center justify-between border-b-2 border-slate-900 pb-1">
        <h2 className="text-sm font-bold uppercase tracking-wider">{titulo}</h2>
        <span className="text-xs font-semibold">{ordens.length} ordem(ns)</span>
      </div>
      {observacao && <p className="mb-2 text-[10px] text-slate-500">{observacao}</p>}

      {ordens.length === 0 ? (
        <p className="py-3 text-xs italic text-slate-500">Nenhuma ordem nesta categoria.</p>
      ) : (
        <table className="w-full table-fixed border-collapse text-left text-[10px]">
          <thead>
            <tr className="bg-slate-100 uppercase tracking-wide text-slate-600">
              <th className="w-[9%] border border-slate-300 px-2 py-1.5">OS</th>
              <th className="w-[21%] border border-slate-300 px-2 py-1.5">Paciente</th>
              <th className="w-[20%] border border-slate-300 px-2 py-1.5">Cliente</th>
              <th className="w-[22%] border border-slate-300 px-2 py-1.5">Serviço</th>
              <th className="w-[16%] border border-slate-300 px-2 py-1.5">Etapa</th>
              <th className="w-[12%] border border-slate-300 px-2 py-1.5">Entrega</th>
            </tr>
          </thead>
          <tbody>
            {ordens.map((ordem) => (
              <tr key={`${titulo}-${ordem.id}`} className="break-inside-avoid">
                <td className="border border-slate-300 px-2 py-1.5 font-semibold">
                  #{ordem.id.toString().padStart(4, '0')}
                </td>
                <td className="border border-slate-300 px-2 py-1.5">{ordem.nomePaciente}</td>
                <td className="border border-slate-300 px-2 py-1.5">{ordem.clienteNome}</td>
                <td className="border border-slate-300 px-2 py-1.5">{ordem.servicoNome}</td>
                <td className="border border-slate-300 px-2 py-1.5">
                  {etapaLabel(ordem.etapaAtual || 'recebimento', 'lab')}
                </td>
                <td className="border border-slate-300 px-2 py-1.5">{formatarData(ordem.dataEntrega)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

export const RelatorioPrioridades = forwardRef<HTMLDivElement, RelatorioPrioridadesProps>(
  (props, ref) => {
    const totalAcao = new Set([
      ...props.respostasDentista,
      ...props.fornecedorAtrasado,
      ...props.atrasados,
    ].map((ordem) => ordem.id)).size

    return (
      <div ref={ref} className="mx-auto min-h-[297mm] w-[210mm] bg-white p-10 text-slate-900 print:p-0">
        <header className="mb-8 flex items-start justify-between border-b-2 border-slate-900 pb-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">LABGEST</h1>
            <p className="mt-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Relatório de Prioridades
            </p>
          </div>
          <div className="text-right text-xs text-slate-600">
            <p className="font-semibold">Gerado em</p>
            <p suppressHydrationWarning>{new Date().toLocaleString('pt-BR')}</p>
          </div>
        </header>

        <div className="mb-8 grid grid-cols-4 gap-3">
          {[
            { rotulo: 'Ação agora', valor: totalAcao },
            { rotulo: 'Atrasadas', valor: props.atrasados.length },
            { rotulo: 'Conferir Clinicorp', valor: props.provasPendentesClinicorp.length },
            { rotulo: 'Hoje', valor: props.hoje.length },
          ].map((item) => (
            <div key={item.rotulo} className="rounded border border-slate-300 p-3 text-center">
              <p className="text-2xl font-bold">{item.valor}</p>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{item.rotulo}</p>
            </div>
          ))}
        </div>

        <SecaoRelatorio titulo="Dentista já respondeu" ordens={props.respostasDentista} />
        <SecaoRelatorio titulo="Fornecedor em atraso" ordens={props.fornecedorAtrasado} />
        <SecaoRelatorio titulo="Atrasos confirmados" ordens={props.atrasados} />
        <SecaoRelatorio
          titulo="Em prova — conferir Clinicorp"
          ordens={props.provasPendentesClinicorp}
          observacao="Não contabilizadas como atraso confirmado enquanto a consulta por CPF não estiver disponível."
        />
        <SecaoRelatorio titulo="Entrega hoje" ordens={props.hoje} />
        <SecaoRelatorio titulo="Urgentes" ordens={props.urgentes} />
        <SecaoRelatorio titulo="Entrega amanhã" ordens={props.proximos} />

        <footer className="mt-8 border-t border-slate-300 pt-3 text-center text-[9px] text-slate-400">
          Documento gerado pelo LabGest — Controle de Produção
        </footer>
      </div>
    )
  },
)

RelatorioPrioridades.displayName = 'RelatorioPrioridades'
