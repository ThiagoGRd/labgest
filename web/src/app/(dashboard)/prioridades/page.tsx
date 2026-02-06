import { prisma } from '@labgest/database'
import { PrioridadesView } from './prioridades-view'

export const dynamic = 'force-dynamic'

export default async function PrioridadesPage() {
  const hoje = new Date()
  const amanha = new Date(hoje)
  amanha.setDate(amanha.getDate() + 1)

  // 1. Pedidos Atrasados (Data Entrega < Hoje) e não finalizados
  const atrasados = await prisma.ordem.findMany({
    where: {
      dataEntrega: { lt: hoje },
      status: { notIn: ['Finalizado', 'Entregue', 'Cancelado'] }
    },
    orderBy: { dataEntrega: 'asc' },
    include: { cliente: true, servico: true }
  })

  // 2. Para Hoje
  const paraHoje = await prisma.ordem.findMany({
    where: {
      dataEntrega: { equals: hoje },
      status: { notIn: ['Finalizado', 'Entregue', 'Cancelado'] }
    },
    include: { cliente: true, servico: true }
  })

  // 3. Urgentes (Status ou Prioridade Urgente)
  const urgentes = await prisma.ordem.findMany({
    where: {
      prioridade: 'Urgente',
      status: { notIn: ['Finalizado', 'Entregue', 'Cancelado'] },
      dataEntrega: { gt: hoje } // Não duplicar com os de hoje/atrasados
    },
    orderBy: { dataEntrega: 'asc' },
    include: { cliente: true, servico: true }
  })

  // 4. Próximos (Amanhã)
  const proximos = await prisma.ordem.findMany({
    where: {
      dataEntrega: { equals: amanha },
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
