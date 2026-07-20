import { prisma } from '@labgest/database'
import type { Prisma } from '@prisma/client'
import { requireUser } from '@/lib/auth-utils'
import { normalizarEtapa } from '@/lib/workflow-config'
import { PrioridadesView } from './prioridades-view'
import type { OrdemPrioridade } from '@/components/prioridades/relatorio-prioridades'

export const dynamic = 'force-dynamic'

const STATUS_FORA_DA_FILA = ['Finalizado', 'Entregue', 'Cancelado', 'Pausado']
const FUSO_LABORATORIO = 'America/Maceio'

function datasDoLaboratorio(referencia = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_LABORATORIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(referencia).split('-').map(Number)

  const [ano, mes, dia] = partes
  return {
    hoje: new Date(Date.UTC(ano, mes - 1, dia)),
    amanha: new Date(Date.UTC(ano, mes - 1, dia + 1)),
    depoisAmanha: new Date(Date.UTC(ano, mes - 1, dia + 2)),
  }
}

type OrdemComRelacionamentos = Prisma.OrdemGetPayload<{
  include: { cliente: { select: { nome: true } }, servico: { select: { nome: true } } }
}>

function serializarOrdem(
  ordem: OrdemComRelacionamentos,
  extras: Partial<OrdemPrioridade> = {},
): OrdemPrioridade {
  return {
    id: ordem.id,
    nomePaciente: ordem.nomePaciente,
    servicoNome: ordem.servicoNome || ordem.servico?.nome || 'Serviço não informado',
    clienteNome: ordem.clienteNome || ordem.cliente?.nome || 'Cliente não informado',
    dataEntrega: ordem.dataEntrega.toISOString(),
    etapaAtual: normalizarEtapa(ordem.etapaAtual || 'recebimento'),
    status: ordem.status || 'Aguardando',
    prioridade: ordem.prioridade || 'Normal',
    cpfCadastrado: Boolean(ordem.cpfPaciente),
    ...extras,
  }
}

function ordemEstaEmProva(ordem: OrdemComRelacionamentos) {
  return [ordem.status, ordem.etapaAtual, ordem.passoFluxoAtual]
    .some((valor) => valor?.toLocaleLowerCase('pt-BR').includes('prova'))
}

export default async function PrioridadesPage() {
  const usuario = await requireUser()
  const datas = datasDoLaboratorio()
  const agora = new Date()
  const ativa: Prisma.OrdemWhereInput = { status: { notIn: STATUS_FORA_DA_FILA } }
  const relacionamentos = {
    cliente: { select: { nome: true } },
    servico: { select: { nome: true } },
  } as const

  const [
    ciclosRespondidos,
    ordensFornecedorAtrasado,
    ordensComPrazoVencido,
    entregasHoje,
    ordensUrgentes,
    entregasAmanha,
  ] = await Promise.all([
    prisma.cicloProducao.findMany({
      where: {
        status: 'em_prova',
        decisao: { not: null },
        ordem: ativa,
      },
      orderBy: { updatedAt: 'desc' },
      include: { ordem: { include: relacionamentos } },
    }),
    prisma.ordem.findMany({
      where: {
        ...ativa,
        prazoFornecedor: { lt: agora },
        dataRecebimentoFornecedor: null,
      },
      orderBy: { prazoFornecedor: 'asc' },
      include: relacionamentos,
    }),
    prisma.ordem.findMany({
      where: {
        ...ativa,
        dataEntrega: { lt: datas.hoje },
      },
      orderBy: [{ dataEntrega: 'asc' }, { prioridade: 'desc' }],
      include: relacionamentos,
    }),
    prisma.ordem.findMany({
      where: {
        ...ativa,
        dataEntrega: { gte: datas.hoje, lt: datas.amanha },
      },
      orderBy: { prioridade: 'desc' },
      include: relacionamentos,
    }),
    prisma.ordem.findMany({
      where: {
        ...ativa,
        prioridade: 'Urgente',
        dataEntrega: { gte: datas.amanha },
      },
      orderBy: { dataEntrega: 'asc' },
      include: relacionamentos,
    }),
    prisma.ordem.findMany({
      where: {
        ...ativa,
        dataEntrega: { gte: datas.amanha, lt: datas.depoisAmanha },
      },
      orderBy: { prioridade: 'desc' },
      include: relacionamentos,
    }),
  ])

  const respostasDentista = ciclosRespondidos.map((ciclo) => serializarOrdem(ciclo.ordem, {
    respostaDentista: ciclo.decisao || undefined,
    observacaoResposta: ciclo.observacoesDentista,
  }))

  const idsComResposta = new Set(respostasDentista.map((ordem) => ordem.id))
  const fornecedorAtrasado = ordensFornecedorAtrasado
    .filter((ordem) => !idsComResposta.has(ordem.id))
    .map((ordem) => serializarOrdem(ordem, {
      fornecedor: ordem.fornecedorEstrutura || 'Fornecedor não informado',
      prazoFornecedor: ordem.prazoFornecedor?.toISOString(),
    }))

  const idsAcaoImediata = new Set([...idsComResposta, ...fornecedorAtrasado.map((ordem) => ordem.id)])
  const atrasados = ordensComPrazoVencido
    .filter((ordem) => !ordemEstaEmProva(ordem))
    .filter((ordem) => !idsAcaoImediata.has(ordem.id))
    .map((ordem) => serializarOrdem(ordem))
  const provasPendentesClinicorp = ordensComPrazoVencido
    .filter(ordemEstaEmProva)
    .filter((ordem) => !idsAcaoImediata.has(ordem.id))
    .map((ordem) => serializarOrdem(ordem))

  return (
    <PrioridadesView
      user={{
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo === 'admin' ? 'Administrador' : 'Operador',
      }}
      respostasDentista={respostasDentista}
      fornecedorAtrasado={fornecedorAtrasado}
      atrasados={atrasados}
      provasPendentesClinicorp={provasPendentesClinicorp}
      hoje={entregasHoje.map((ordem) => serializarOrdem(ordem))}
      urgentes={ordensUrgentes.map((ordem) => serializarOrdem(ordem))}
      proximos={entregasAmanha.map((ordem) => serializarOrdem(ordem))}
      clinicorpConfigurado={false}
      dataReferencia={datas.hoje.toISOString()}
    />
  )
}
