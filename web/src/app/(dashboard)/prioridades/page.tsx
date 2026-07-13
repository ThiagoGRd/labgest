import { prisma } from '@labgest/database'
import { PrioridadesView } from './prioridades-view'

export const dynamic = 'force-dynamic'

export default async function PrioridadesPage() {
  const inicioHoje = new Date()
  inicioHoje.setHours(0, 0, 0, 0)
  const inicioAmanha = new Date(inicioHoje)
  inicioAmanha.setDate(inicioAmanha.getDate() + 1)
  const inicioDepoisAmanha = new Date(inicioAmanha)
  inicioDepoisAmanha.setDate(inicioDepoisAmanha.getDate() + 1)

  // 1. Pedidos Atrasados (Data Entrega < Hoje) e não finalizados
  const atrasados = await prisma.ordem.findMany({
    where: {
      dataEntrega: { lt: inicioHoje },
      status: { notIn: ['Finalizado', 'Entregue', 'Cancelado'] }
    },
    orderBy: { dataEntrega: 'asc' },
    include: { cliente: true, servico: true }
  })

  // 2. Para Hoje
  const paraHoje = await prisma.ordem.findMany({
    where: {
      dataEntrega: { gte: inicioHoje, lt: inicioAmanha },
      status: { notIn: ['Finalizado', 'Entregue', 'Cancelado'] }
    },
    include: { cliente: true, servico: true }
  })

  // 3. Urgentes (Status ou Prioridade Urgente)
  const urgentes = await prisma.ordem.findMany({
    where: {
      prioridade: 'Urgente',
      status: { notIn: ['Finalizado', 'Entregue', 'Cancelado'] },
      dataEntrega: { gte: inicioAmanha } // Não duplicar com os de hoje/atrasados
    },
    orderBy: { dataEntrega: 'asc' },
    include: { cliente: true, servico: true }
  })

  // 4. Próximos (Amanhã)
  const proximos = await prisma.ordem.findMany({
    where: {
      dataEntrega: { gte: inicioAmanha, lt: inicioDepoisAmanha },
      status: { notIn: ['Finalizado', 'Entregue', 'Cancelado'] }
    },
    include: { cliente: true, servico: true }
  })

  return (
    <PrioridadesView 
      atrasados={atrasados}
      hoje={paraHoje}
      urgentes={urgentes}
      proximos={proximos}
    />
  )
}
