'use server'

import { prisma } from '@labgest/database'
import { requireUser } from '@/lib/auth-utils'
import { getProducao } from '@/actions/producao'
import { hojeIso, somarDias } from '@/lib/labs-externos-utils'
import { JANELA_DESEMPENHO_DIAS, type OrdemFinalizada } from '@/lib/lab-interno-utils'

// Painel de gestão do laboratório interno: só leitura. As ordens em andamento vêm da mesma
// consulta da Produção (uma única fonte de verdade); aqui só se somam as já finalizadas.
export async function getLabInterno() {
  await requireUser()

  const inicio = new Date(`${somarDias(hojeIso(), -JANELA_DESEMPENHO_DIAS)}T00:00:00Z`)

  try {
    const [ordens, finalizadas] = await Promise.all([
      getProducao(),
      prisma.ordem.findMany({
        where: { status: { in: ['Finalizado', 'Entregue'] }, dataFinalizacao: { gte: inicio } },
        select: {
          dataPedido: true,
          dataEntrega: true,
          dataFinalizacao: true,
          _count: { select: { ciclos: true } },
        },
        take: 2000,
      }),
    ])

    const historico: OrdemFinalizada[] = finalizadas.map((ordem) => ({
      dataPedido: ordem.dataPedido,
      dataEntrega: ordem.dataEntrega,
      dataFinalizacao: ordem.dataFinalizacao,
      ciclos: ordem._count.ciclos,
    }))

    return { ordens, historico }
  } catch (error) {
    console.error('Erro ao carregar o laboratório interno:', error)
    throw new Error('Não foi possível carregar o laboratório interno. Atualize a página para tentar novamente.')
  }
}
