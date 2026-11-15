'use server'

import { prisma } from '@labgest/database'
import { requireUser } from '@/lib/auth-utils'
import { getProducao } from '@/actions/producao'
import { listarTriagemWhatsappOs } from '@/actions/triagem-whatsapp'
import { hojeIso, somarDias } from '@/lib/labs-externos-utils'
import { JANELA_DESEMPENHO_DIAS, type OrdemFinalizada } from '@/lib/lab-interno-utils'

// Painel operacional e de gestão do laboratório interno: compartilha a mesma consulta
// da Produção (uma única fonte de verdade), somando histórico e triagem do WhatsApp.
export async function getLabInterno() {
  await requireUser()

  const inicio = new Date(`${somarDias(hojeIso(), -JANELA_DESEMPENHO_DIAS)}T00:00:00Z`)

  try {
    const [ordens, finalizadas, triagem] = await Promise.all([
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
      listarTriagemWhatsappOs(),
    ])

    const historico: OrdemFinalizada[] = finalizadas.map((ordem) => ({
      dataPedido: ordem.dataPedido,
      dataEntrega: ordem.dataEntrega,
      dataFinalizacao: ordem.dataFinalizacao,
      ciclos: ordem._count.ciclos,
    }))

    return { ordens, historico, triagem }
  } catch (error) {
    console.error('Erro ao carregar o laboratório interno:', error)
    throw new Error('Não foi possível carregar o laboratório interno. Atualize a página para tentar novamente.')
  }
}

