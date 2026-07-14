import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const ordensEmProva = await prisma.ordem.findMany({
    where: {
      status: 'Em Prova',
      etapaAtual: 'em_prova',
    },
    select: { id: true },
    orderBy: { id: 'asc' },
  })

  const criados: number[] = []
  const ignorados: number[] = []

  for (const ordem of ordensEmProva) {
    const criado = await prisma.$transaction(async (tx) => {
      const cicloAtivo = await tx.cicloProducao.findFirst({
        where: {
          ordemId: ordem.id,
          status: { in: ['no_lab', 'em_prova'] },
        },
        select: { id: true },
      })

      if (cicloAtivo) return false

      const totalCiclos = await tx.cicloProducao.count({
        where: { ordemId: ordem.id },
      })
      const dataComprometida = new Date()
      dataComprometida.setDate(dataComprometida.getDate() + 7)

      await tx.cicloProducao.create({
        data: {
          ordemId: ordem.id,
          numeroCiclo: totalCiclos + 1,
          etapa: 'Prova clínica (ciclo recuperado)',
          dataEntrada: new Date(),
          dataSaida: new Date(),
          prazoDias: 7,
          dataComprometida,
          status: 'em_prova',
          registradoPor: 'backfill-fluxo-prova-2026-07-13',
        },
      })

      return true
    })

    if (criado) criados.push(ordem.id)
    else ignorados.push(ordem.id)
  }

  console.log(JSON.stringify({ encontrados: ordensEmProva.length, criados, ignorados }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
