import { getProducao } from '@/actions/producao'
import { prisma } from '@labgest/database'
import { retornosRespondidos, ordensSemEtapa } from '@/lib/dashboard-attention'
import { ProducaoView } from './producao-view'

export const dynamic = 'force-dynamic'

export default async function ProducaoPage() {
  // getProducao authenticates before any contextual query is issued.
  const ordens = await getProducao()
  const [retornos, semEtapa] = await Promise.all([
    prisma.cicloProducao.findMany({
      where: retornosRespondidos,
      orderBy: { updatedAt: 'asc' },
      select: {
        id: true, numeroCiclo: true, decisao: true, ordemId: true,
        ordem: { select: { nomePaciente: true, clienteNome: true, status: true, cliente: { select: { nome: true } } } },
      },
    }),
    prisma.ordem.findMany({ where: ordensSemEtapa, select: { id: true } }),
  ])
  return <ProducaoView initialOrdens={ordens} semEtapaIds={semEtapa.map((ordem) => ordem.id)} retornosDashboard={retornos.map((ciclo) => ({
    id: ciclo.id, numeroCiclo: ciclo.numeroCiclo, decisao: ciclo.decisao, ordemId: ciclo.ordemId,
    paciente: ciclo.ordem.nomePaciente, cliente: ciclo.ordem.clienteNome || ciclo.ordem.cliente?.nome || 'Cliente não informado', status: ciclo.ordem.status,
  }))} />
}
