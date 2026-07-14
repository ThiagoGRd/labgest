import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
const etapasCanonicas = [
  'recebimento', 'modelagem', 'confeccao', 'em_prova', 'ajuste',
  'acabamento', 'conferencia', 'pronto', 'entregue',
]

async function main() {
  try {
    const [ativas, naoCanonicas, divergencias, agrupadas, restricoes] = await Promise.all([
    prisma.ordem.count({ where: { status: { notIn: ['Finalizado', 'Entregue', 'Cancelado'] } } }),
    prisma.ordem.count({
      where: {
        status: { notIn: ['Finalizado', 'Entregue', 'Cancelado'] },
        etapaAtual: { notIn: etapasCanonicas },
      },
    }),
    prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS total
      FROM ordens
      WHERE status NOT IN ('Finalizado', 'Entregue', 'Cancelado', 'Pausado')
        AND status <> CASE etapa_atual
          WHEN 'recebimento' THEN 'Aguardando'
          WHEN 'em_prova' THEN 'Em Prova'
          WHEN 'pronto' THEN 'Finalizado'
          WHEN 'entregue' THEN 'Entregue'
          ELSE 'Em Produção'
        END
    `,
    prisma.ordem.groupBy({
      by: ['status', 'etapaAtual'],
      where: { status: { notIn: ['Finalizado', 'Entregue', 'Cancelado'] } },
      _count: { _all: true },
      orderBy: [{ status: 'asc' }, { etapaAtual: 'asc' }],
    }),
    prisma.$queryRaw<Array<{ nome: string; definicao: string }>>`
      SELECT conname AS nome, pg_get_constraintdef(oid) AS definicao
      FROM pg_constraint
      WHERE conrelid = 'ordens'::regclass AND contype = 'c'
      ORDER BY conname
    `,
    ])

    console.log(JSON.stringify({
      ativas,
      etapasAtivasNaoCanonicas: naoCanonicas,
      divergenciasStatusEtapa: divergencias[0]?.total ?? 0,
      distribuicaoAtiva: agrupadas.map(item => ({
        status: item.status,
        etapa: item.etapaAtual,
        quantidade: item._count._all,
      })),
      restricoes,
    }, null, 2))
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
