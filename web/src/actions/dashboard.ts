'use server'

import { prisma } from '@labgest/database'
import { requireUser } from '@/lib/auth-utils'

const STATUS_ENCERRADOS = ['Finalizado', 'Cancelado', 'Entregue']
const STATUS_FORA_DA_FILA = [...STATUS_ENCERRADOS, 'Pausado']
const FUSO_LABORATORIO = 'America/Maceio'

function calendarioDoLaboratorio(referencia = new Date()) {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: FUSO_LABORATORIO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(referencia)

  const valor = (tipo: Intl.DateTimeFormatPartTypes) => Number(partes.find((parte) => parte.type === tipo)?.value)
  const ano = valor('year')
  const mes = valor('month')
  const dia = valor('day')

  const hoje = new Date(Date.UTC(ano, mes - 1, dia))
  const amanha = new Date(Date.UTC(ano, mes - 1, dia + 1))
  const daquiOitoDias = new Date(Date.UTC(ano, mes - 1, dia + 8))
  const inicioMesData = new Date(Date.UTC(ano, mes - 1, 1))
  const inicioProximoMesData = new Date(Date.UTC(ano, mes, 1))

  // createdAt é timestamp; os limites abaixo representam meia-noite no UTC-3.
  const inicioMesTimestamp = new Date(Date.UTC(ano, mes - 1, 1, 3))
  const inicioProximoMesTimestamp = new Date(Date.UTC(ano, mes, 1, 3))
  const inicioMesAnteriorTimestamp = new Date(Date.UTC(ano, mes - 2, 1, 3))

  return {
    hoje,
    amanha,
    daquiOitoDias,
    inicioMesData,
    inicioProximoMesData,
    inicioMesTimestamp,
    inicioProximoMesTimestamp,
    inicioMesAnteriorTimestamp,
  }
}

export async function getDashboardData() {
  const usuario = await requireUser()

  const datas = calendarioDoLaboratorio()

  const [
    totalOrdensMes,
    totalOrdensMesAnterior,
    ordensEmAndamento,
    ordensAtrasadas,
    entregasHoje,
    retornosPendentes,
    ordensSemEtapa,
    prontasParaEntrega,
    recebidoMes,
    saldoEmAberto,
    vencendoSeteDias,
    proximasEntregas,
  ] = await Promise.all([
    prisma.ordem.count({
      where: { createdAt: { gte: datas.inicioMesTimestamp, lt: datas.inicioProximoMesTimestamp } },
    }),
    prisma.ordem.count({
      where: { createdAt: { gte: datas.inicioMesAnteriorTimestamp, lt: datas.inicioMesTimestamp } },
    }),
    prisma.ordem.count({
      where: { status: { notIn: STATUS_FORA_DA_FILA } },
    }),
    prisma.ordem.count({
      where: {
        status: { notIn: STATUS_FORA_DA_FILA },
        dataEntrega: { lt: datas.hoje },
      },
    }),
    prisma.ordem.count({
      where: {
        status: { notIn: STATUS_FORA_DA_FILA },
        dataEntrega: { gte: datas.hoje, lt: datas.amanha },
      },
    }),
    prisma.cicloProducao.count({
      where: {
        status: 'em_prova',
        decisao: { not: null },
        ordem: { status: { notIn: STATUS_ENCERRADOS } },
      },
    }),
    prisma.ordem.count({
      where: {
        status: { notIn: STATUS_FORA_DA_FILA },
        passoFluxoAtual: null,
      },
    }),
    prisma.ordem.count({ where: { status: 'Finalizado' } }),
    prisma.contaReceber.aggregate({
      where: {
        status: 'Recebido',
        dataRecebimento: { gte: datas.inicioMesData, lt: datas.inicioProximoMesData },
      },
      _sum: { valor: true },
    }),
    prisma.contaReceber.aggregate({
      where: { status: { not: 'Recebido' } },
      _sum: { valor: true },
      _count: true,
    }),
    prisma.contaReceber.aggregate({
      where: {
        status: { not: 'Recebido' },
        dataVencimento: { gte: datas.hoje, lt: datas.daquiOitoDias },
      },
      _sum: { valor: true },
      _count: true,
    }),
    prisma.ordem.findMany({
      where: {
        status: { notIn: STATUS_FORA_DA_FILA },
        dataEntrega: { gte: datas.hoje },
      },
      orderBy: [{ dataEntrega: 'asc' }, { prioridade: 'desc' }],
      take: 6,
      include: {
        cliente: { select: { nome: true } },
        servico: { select: { nome: true } },
      },
    }),
  ])

  return {
    usuario: {
      nome: usuario.nome,
      email: usuario.email,
      tipo: usuario.tipo === 'admin' ? 'Administrador' : 'Operador',
    },
    totalOrdensMes,
    totalOrdensMesAnterior,
    emAndamento: ordensEmAndamento,
    atrasadas: ordensAtrasadas,
    entregasHoje,
    retornosPendentes,
    semEtapa: ordensSemEtapa,
    prontasParaEntrega,
    recebidoMes: Number(recebidoMes._sum.valor || 0),
    saldoEmAberto: Number(saldoEmAberto._sum.valor || 0),
    contasEmAberto: saldoEmAberto._count,
    vencendoSeteDias: Number(vencendoSeteDias._sum.valor || 0),
    contasVencendoSeteDias: vencendoSeteDias._count,
    proximasEntregas: proximasEntregas.map((ordem) => ({
      id: ordem.id,
      paciente: ordem.nomePaciente,
      cliente: ordem.clienteNome || ordem.cliente?.nome || 'Cliente não informado',
      servico: ordem.servicoNome || ordem.servico?.nome || 'Serviço não informado',
      dataEntrega: ordem.dataEntrega.toISOString(),
      status: ordem.status || 'Aguardando',
      prioridade: ordem.prioridade || 'Normal',
    })),
  }
}
