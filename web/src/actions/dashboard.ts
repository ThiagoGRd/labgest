'use server'

import { prisma } from '@labgest/database'
import { requireUser } from '@/lib/auth-utils'

export async function getDashboardData() {
  await requireUser()

  const hoje = new Date()
  const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
  const fimDoDia = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59)

  try {
    const [
      totalOrdensMes,
      faturamentoMes,
      ordensAtrasadas,
      proximasEntregas,
      ordensEmProducao
    ] = await Promise.all([
      // Total Ordens Mês
      prisma.ordem.count({
        where: { createdAt: { gte: inicioMes } }
      }),
      // Faturamento Mês (soma de contas a receber do mês)
      prisma.contaReceber.aggregate({
        where: { 
          createdAt: { gte: inicioMes },
          // status: 'Pago' // Opcional: considerar só pago ou tudo
        },
        _sum: { valor: true }
      }),
      // Atrasadas (não finalizadas e data entrega < hoje)
      prisma.ordem.count({
        where: {
          status: { notIn: ['Finalizado', 'Cancelado', 'Entregue', 'Pausado'] },
          dataEntrega: { lt: hoje }
        }
      }),
      // Próximas Entregas (hoje ou futuro próximo)
      prisma.ordem.findMany({
        where: {
          status: { notIn: ['Finalizado', 'Cancelado', 'Entregue', 'Pausado'] },
          dataEntrega: { gte: hoje }
        },
        orderBy: { dataEntrega: 'asc' },
        take: 5,
        include: { cliente: { select: { nome: true } } }
      }),
      // Em Produção
      prisma.ordem.count({
        where: { status: 'Em Produção' }
      })
    ])

    return {
      totalOrdens: totalOrdensMes,
      faturamento: Number(faturamentoMes._sum.valor || 0),
      atrasadas: ordensAtrasadas,
      emProducao: ordensEmProducao,
      proximasEntregas: proximasEntregas.map(o => ({
        id: o.id,
        paciente: o.nomePaciente,
        cliente: o.clienteNome || o.cliente?.nome || 'Desconhecido',
        servico: o.servicoNome || 'Serviço',
        dataEntrega: o.dataEntrega.toISOString(),
        status: o.status || 'Aguardando'
      }))
    }

  } catch (error) {
    console.error('Erro ao buscar dados do dashboard:', error)
    return {
      totalOrdens: 0,
      faturamento: 0,
      atrasadas: 0,
      emProducao: 0,
      proximasEntregas: []
    }
  }
}
