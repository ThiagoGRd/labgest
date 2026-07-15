import { PrismaClient } from '@prisma/client'
import {
  calcularPrazoPasso,
  getFluxoProtese,
  inferirTipoProtese,
  normalizarEtapa,
  type PassoProtese,
} from '../../shared/src'

const prisma = new PrismaClient()

function normalizarTexto(valor: string | null | undefined) {
  return (valor || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function escolherPasso(tipo: NonNullable<ReturnType<typeof inferirTipoProtese>>, etapa: string | null, subetapa: string | null) {
  const fluxo = getFluxoProtese(tipo)
  const detalhe = normalizarTexto(subetapa)
  const porNome = detalhe ? fluxo.passos.filter((passo) => {
    const nome = normalizarTexto(passo.nome)
    return nome.includes(detalhe) || detalhe.includes(nome)
  }) : []
  if (porNome.length === 1) return porNome[0]

  const macro = normalizarEtapa(etapa || 'recebimento')
  if (macro === 'pronto' || macro === 'entregue') return fluxo.passos.at(-1)!
  if (macro === 'ajuste') return null

  const candidatos = fluxo.passos.filter((passo) => passo.macroetapa === macro)
  return candidatos.length === 1 ? candidatos[0] : null
}

async function main() {
  const dryRun = process.env.DRY_RUN === '1'
  const ordens = await prisma.ordem.findMany({
    where: { status: { notIn: ['Finalizado', 'Entregue', 'Cancelado', 'Pausado'] } },
    select: {
      id: true,
      servicoNome: true,
      tipoWorkflow: true,
      etapaAtual: true,
      subetapaAtual: true,
      arcadas: true,
      passoFluxoAtual: true,
      updatedAt: true,
    },
  })

  const migradas: number[] = []
  const ambiguas: number[] = []
  const naoIdentificadas: number[] = []

  for (const ordem of ordens) {
    const tipo = inferirTipoProtese(ordem.servicoNome, ordem.tipoWorkflow)
    if (!tipo) {
      naoIdentificadas.push(ordem.id)
      continue
    }
    if (ordem.passoFluxoAtual && ordem.tipoWorkflow === tipo) continue

    const passo: PassoProtese | null = escolherPasso(tipo, ordem.etapaAtual, ordem.subetapaAtual)
    if (!passo) {
      ambiguas.push(ordem.id)
      continue
    }

    if (!dryRun) {
      await prisma.ordem.update({
        where: { id: ordem.id },
        data: {
          tipoWorkflow: tipo,
          passoFluxoAtual: passo.id,
          subetapaAtual: passo.nome,
          prazoEtapaAtual: calcularPrazoPasso(ordem.updatedAt, passo, ordem.arcadas),
        },
      })
    }
    migradas.push(ordem.id)
  }

  console.log(JSON.stringify({ dryRun, total: ordens.length, migradas, ambiguas, naoIdentificadas }, null, 2))
}

main()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => prisma.$disconnect())
