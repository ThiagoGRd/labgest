'use server'

import { prisma } from '@labgest/database'
import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import {
  agruparOrdensDuplicadas,
  escolherFluxoPrincipal,
  normalizarNome,
  type TipoProteseId,
} from '@labgest/shared'
import { requireUser } from '@/lib/auth-utils'
import { garantirEfeitosFinalizacao } from '@/lib/finalizacao-ordem'
import { validarExclusaoOrdem } from '@/lib/exclusao-ordem'
import { parseDateLocal } from '@/lib/date-utils'
import { isCpfValido, normalizarCpf } from '@/lib/cpf'
import { extrairItensCaso } from '@/lib/clinicorp-etapas'
import type { ItemCasoOrdem } from '@/components/producao/types'
import {
  getWorkflowForServico,
  getNextEtapa,
  getRetornoEtapa,
  getProgresso,
  isEtapaProva,
  canAdvance,
  normalizarEtapa,
  statusParaEtapa,
  podeSelecionarEtapaNaEdicao,
  ETAPA_FINAL,
  type ChecklistEstetico,
  type TipoWorkflow,
  calcularPrazoPasso,
  getPrimeiroPassoLaboratorial,
  inferirTipoProtese,
  isTipoProtese,
} from '@/lib/workflow-config'

export interface FiltrosOrdens {
  busca?: string
  status?: string
  clienteId?: number
  tipoWorkflow?: string
  ordenar?: 'prazo' | 'recentes' | 'atualizadas' | 'paciente'
  pagina?: number
  porPagina?: number
}

const STATUS_ENCERRADOS = ['Finalizado', 'Entregue', 'Cancelado']

function validarDataEntrega(valor: string, permitirPassado = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return null
  const [ano, mes, dia] = valor.split('-').map(Number)
  if (ano < 2020 || ano > new Date().getFullYear() + 2) return null
  const data = parseDateLocal(valor)
  if (data.getFullYear() !== ano || data.getMonth() !== mes - 1 || data.getDate() !== dia) return null
  if (!permitirPassado) {
    const hoje = new Date()
    hoje.setHours(0, 0, 0, 0)
    if (data < hoje) return null
  }
  return data
}

export async function getOrdens(filtros: FiltrosOrdens = {}) {
  await requireUser()

  const pagina = Math.max(1, filtros.pagina || 1)
  const porPagina = Math.min(50, Math.max(10, filtros.porPagina || 20))
  const busca = filtros.busca?.trim() || ''
  const cpfBusca = busca.replace(/\D/g, '')
  const status = filtros.status || 'ativas'
  const condicoesBusca: Prisma.OrdemWhereInput[] = busca ? [
    { nomePaciente: { contains: busca, mode: 'insensitive' } },
    { clienteNome: { contains: busca, mode: 'insensitive' } },
    { servicoNome: { contains: busca, mode: 'insensitive' } },
    ...(cpfBusca ? [{ cpfPaciente: { contains: cpfBusca } } satisfies Prisma.OrdemWhereInput] : []),
    ...(/^\d+$/.test(busca) ? [{ id: Number(busca) }] : []),
  ] : []

  const where: Prisma.OrdemWhereInput = {
    ...(status === 'ativas'
      ? { status: { notIn: STATUS_ENCERRADOS } }
      : status === 'encerradas'
        ? { status: { in: STATUS_ENCERRADOS } }
        : status !== 'todos'
          ? { status }
          : {}),
    ...(filtros.clienteId ? { clienteId: filtros.clienteId } : {}),
    ...(filtros.tipoWorkflow ? { tipoWorkflow: filtros.tipoWorkflow } : {}),
    ...(busca ? { OR: condicoesBusca } : {}),
  }

  const orderBy: Prisma.OrdemOrderByWithRelationInput[] = filtros.ordenar === 'recentes'
    ? [{ createdAt: 'desc' }]
    : filtros.ordenar === 'atualizadas'
      ? [{ updatedAt: 'desc' }]
      : filtros.ordenar === 'paciente'
        ? [{ nomePaciente: 'asc' }]
        : [{ dataEntrega: 'asc' }, { prioridade: 'desc' }]

  const [ordens, total, totalGeral, ativas, emProva, finalizadas, pausadas, encerradas] = await Promise.all([
    prisma.ordem.findMany({
      where,
      orderBy,
      skip: (pagina - 1) * porPagina,
      take: porPagina,
      select: {
        id: true,
        nomePaciente: true,
        cpfPaciente: true,
        clienteId: true,
        clienteNome: true,
        servicoNome: true,
        status: true,
        prioridade: true,
        dataPedido: true,
        dataEntrega: true,
        dataEntregaReal: true,
        etapaAtual: true,
        subetapaAtual: true,
        valor: true,
        valorFinal: true,
        arquivoStl: true,
        tipoWorkflow: true,
        tentativaAtual: true,
        tokenRastreamento: true,
        motivoPausa: true,
        pausadoEm: true,
        updatedAt: true,
        arcadas: true,
        elementos: true,
        corDentes: true,
        checklistEstetico: true,
        cliente: { select: { nome: true } },
        servico: { select: { nome: true } },
        contasReceber: {
          where: { status: { not: 'Cancelado' } },
          select: {
            id: true,
            valor: true,
            valorRecebido: true,
            dataVencimento: true,
            status: true,
            observacoes: true,
          },
          orderBy: { id: 'desc' },
          take: 1,
        },
      },
    }),
    prisma.ordem.count({ where }),
    prisma.ordem.count(),
    prisma.ordem.count({ where: { status: { notIn: STATUS_ENCERRADOS } } }),
    prisma.ordem.count({ where: { status: 'Em Prova' } }),
    prisma.ordem.count({ where: { status: 'Finalizado' } }),
    prisma.ordem.count({ where: { status: 'Pausado' } }),
    prisma.ordem.count({ where: { status: { in: STATUS_ENCERRADOS } } }),
  ])

  return {
    ordens: ordens.map(o => ({
      id: o.id,
      paciente: o.nomePaciente,
      cpfPaciente: o.cpfPaciente || '',
      clienteId: o.clienteId ?? undefined,
      cliente: { nome: o.clienteNome || o.cliente?.nome || 'Cliente Desconhecido' },
      servico: o.servicoNome || o.servico?.nome || 'Serviço',
      status: o.status || 'Aguardando',
      prioridade: o.prioridade || 'Normal',
      dataEntrada: o.dataPedido ? o.dataPedido.toISOString() : new Date().toISOString(),
      dataEntrega: o.dataEntrega && !isNaN(o.dataEntrega.getTime()) ? o.dataEntrega.toISOString() : new Date().toISOString(),
      dataEntregaReal: o.dataEntregaReal?.toISOString() || null,
      etapaAtual: normalizarEtapa(o.etapaAtual || 'recebimento'),
      subetapaAtual: o.subetapaAtual || '',
      valor: Number(o.valorFinal || o.valor),
      arquivos: (o.arquivoStl as string[]) || [],
      tipoWorkflow: (o.tipoWorkflow as TipoWorkflow) || null,
      tentativaAtual: o.tentativaAtual || 0,
      tokenRastreamento: o.tokenRastreamento,
      motivoPausa: o.motivoPausa,
      pausadoEm: o.pausadoEm?.toISOString() || null,
      updatedAt: o.updatedAt?.toISOString() || null,
      arcadas: o.arcadas || 1,
      elementos: o.elementos || '',
      corDentes: o.corDentes || '',
      itensCaso: extrairItensCaso(o.checklistEstetico),
      cobranca: o.contasReceber[0] ? {
        id: o.contasReceber[0].id,
        valor: Number(o.contasReceber[0].valor),
        valorRecebido: Number(o.contasReceber[0].valorRecebido),
        vencimento: o.contasReceber[0].dataVencimento.toISOString(),
        status: o.contasReceber[0].status || 'Pendente',
        observacoes: o.contasReceber[0].observacoes || '',
      } : null,
    })),
    total,
    totalGeral,
    pagina,
    porPagina,
    totalPaginas: Math.max(1, Math.ceil(total / porPagina)),
    contadores: { ativas, emProva, finalizadas, pausadas, encerradas },
  }
}

export async function createBatchOrdens(data: {
  clienteId: string
  paciente: string
  cpfPaciente: string
  dataEntrega: string
  prioridade: string
  observacoes: string
  arquivos?: string[]
  unificarEmUnicaOs?: boolean
  anexarOrdemId?: number
  itens: Array<{
    servicoId: string
    elementos: string
    corDentes: string
    material: string
    arcadas?: number
    arcada?: 'Superior' | 'Inferior' | 'Superior + Inferior' | string
    tipoProtese?: string
  }>
}) {
  const usuario = await requireUser()
  try {
    const cpfPaciente = normalizarCpf(data.cpfPaciente)
    if (!isCpfValido(cpfPaciente)) return { success: false, error: 'Informe um CPF válido para o paciente' }
    const dataEntrega = validarDataEntrega(data.dataEntrega)
    if (!dataEntrega) return { success: false, error: 'Informe uma data de entrega válida, entre hoje e os próximos 2 anos' }
    if (!data.itens.length) return { success: false, error: 'Adicione pelo menos um serviço ao pedido' }

    const cliente = await prisma.cliente.findUnique({ where: { id: Number(data.clienteId) } })
    if (!cliente) return { success: false, error: 'Cliente não encontrado' }

    const idsServicos = [...new Set(data.itens.map((item) => Number(item.servicoId)))]
    const servicos = await prisma.servico.findMany({ where: { id: { in: idsServicos }, ativo: true } })
    if (servicos.length !== idsServicos.length) return { success: false, error: 'Um dos serviços não existe ou está inativo' }
    const servicosPorId = new Map(servicos.map((servico) => [servico.id, servico]))

    const itensResolvidos = data.itens.map((item) => {
      const servico = servicosPorId.get(Number(item.servicoId))!
      const valor = Number(servico.preco)
      const tipoProtese = isTipoProtese(item.tipoProtese)
        ? item.tipoProtese
        : isTipoProtese(servico.tipoWorkflow)
          ? servico.tipoWorkflow
          : inferirTipoProtese(servico.nome)
      const arcadaLabel = item.arcada?.trim()
        || (item.arcadas === 2 ? 'Superior + Inferior' : 'Superior')
      const arcadasItem = item.arcadas === 2 || arcadaLabel === 'Superior + Inferior' ? 2 : 1
      const itemCaso: ItemCasoOrdem = {
        servicoId: servico.id,
        servicoNome: servico.nome,
        arcada: arcadaLabel,
        elementos: item.elementos?.trim() || null,
        corDentes: item.corDentes?.trim() || null,
        material: item.material?.trim() || null,
        tipoProtese: tipoProtese || null,
        valor,
      }
      return { servico, valor, tipoProtese, arcadaLabel, arcadasItem, itemCaso, raw: item }
    })

    const formatarNomeCombinado = (lista: ItemCasoOrdem[]) => {
      const partes = lista.map((i) => {
        const suf = i.arcada ? ` (${i.arcada})` : i.elementos ? ` (${i.elementos})` : ''
        return `${i.servicoNome}${suf}`
      })
      return [...new Set(partes)].join(' + ').slice(0, 250)
    }

    const calcularTotalArcadas = (lista: ItemCasoOrdem[]) => {
      const temAmbas = lista.some((i) => i.arcada === 'Superior + Inferior')
      const temSup = lista.some((i) => i.arcada?.toLowerCase().includes('superior'))
      const temInf = lista.some((i) => i.arcada?.toLowerCase().includes('inferior'))
      return temAmbas || (temSup && temInf) || lista.length >= 2 ? 2 : 1
    }

    let ordemCriadaOuAnexadaId: number | null = null
    let servicoIdsParaItemOrdem: Array<{ servicoId: number; valor: number; elementos: string | null; especificacao: Prisma.InputJsonObject }> = []

    if (data.anexarOrdemId) {
      const agora = new Date()
      const resAnexo = await prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT id FROM public.ordens WHERE id = ${data.anexarOrdemId} FOR UPDATE`
        const existente = await tx.ordem.findUnique({ where: { id: data.anexarOrdemId } })
        if (!existente) return { success: false as const, error: 'Ordem para anexar não encontrada' }
        if (STATUS_ENCERRADOS.includes(existente.status || '')) {
          return { success: false as const, error: 'A ordem selecionada já está encerrada' }
        }

        const itensAnteriores = extrairItensCaso(existente.checklistEstetico)
        const baseExistente: ItemCasoOrdem[] = itensAnteriores.length > 0
          ? itensAnteriores
          : [{
              servicoId: existente.servicoId,
              servicoNome: existente.servicoNome,
              arcada: existente.arcadas === 2 ? 'Superior + Inferior' : null,
              elementos: existente.elementos,
              corDentes: existente.corDentes,
              material: existente.material,
              tipoProtese: existente.tipoWorkflow,
              valor: Number(existente.valorFinal ?? existente.valor),
              origemOrdemId: existente.id,
            }]

        const todosItens = [...baseExistente, ...itensResolvidos.map((i) => i.itemCaso)]
        const valorAdicional = itensResolvidos.reduce((acc, i) => acc + i.valor, 0)
        const novoValor = Number(existente.valor || 0) + valorAdicional
        const novoValorFinal = Number(existente.valorFinal ?? existente.valor ?? 0) + valorAdicional
        const arcadasAtualizadas = Math.max(existente.arcadas || 1, calcularTotalArcadas(todosItens))
        const elementosCombinados = [...new Set([existente.elementos, ...itensResolvidos.map((i) => i.raw.elementos?.trim())].filter(Boolean))].join(', ').slice(0, 100)
        const coresCombinadas = [...new Set([existente.corDentes, ...itensResolvidos.map((i) => i.raw.corDentes?.trim())].filter(Boolean))].join(' / ').slice(0, 50)
        const materiaisCombinados = [...new Set([existente.material, ...itensResolvidos.map((i) => i.raw.material?.trim())].filter(Boolean))].join(', ').slice(0, 100)
        const obsCombinadas = [existente.observacoes?.trim(), data.observacoes?.trim()].filter(Boolean).join('\n').trim()
        const arquivosCombinados = [...new Set([...(Array.isArray(existente.arquivoStl) ? (existente.arquivoStl as string[]) : []), ...(data.arquivos || [])])]
        const checklistPreservado = preservarFichaClinica(existente.checklistEstetico)
        const historicoAtual = Array.isArray(existente.historicoEtapas) ? (existente.historicoEtapas as Prisma.InputJsonObject[]) : []

        await tx.ordem.update({
          where: { id: existente.id },
          data: {
            servicoNome: formatarNomeCombinado(todosItens),
            valor: novoValor,
            valorFinal: novoValorFinal,
            arcadas: arcadasAtualizadas,
            elementos: elementosCombinados || existente.elementos,
            corDentes: coresCombinadas || existente.corDentes,
            material: materiaisCombinados || existente.material,
            observacoes: obsCombinadas || existente.observacoes,
            arquivoStl: arquivosCombinados,
            checklistEstetico: {
              ...checklistPreservado,
              itensCaso: todosItens as unknown as Prisma.InputJsonValue[],
            },
            historicoEtapas: [
              ...historicoAtual,
              {
                etapa: existente.etapaAtual || 'recebimento',
                acao: 'anexou_servicos_na_os',
                adicionados: itensResolvidos.map((i) => `${i.servico.nome} (${i.arcadaLabel})`).join(' + '),
                data: agora.toISOString(),
                por: usuario.email,
              },
            ],
          },
        })
        return { success: true as const, id: existente.id }
      })

      if (!resAnexo.success) return resAnexo
      ordemCriadaOuAnexadaId = resAnexo.id
      servicoIdsParaItemOrdem = itensResolvidos.map((i) => ({
        servicoId: i.servico.id,
        valor: i.valor,
        elementos: i.raw.elementos || null,
        especificacao: { arcada: i.arcadaLabel, cor: i.raw.corDentes || '', material: i.raw.material || '', tipoProtese: i.tipoProtese || 'geral' },
      }))
    } else if (data.unificarEmUnicaOs !== false) {
      const agora = new Date()
      const itensCaso = itensResolvidos.map((i) => i.itemCaso)
      const primeiro = itensResolvidos[0]
      const tipoPrincipal = escolherFluxoPrincipal(itensResolvidos.map((i) => i.tipoProtese))
        ?? (isTipoProtese(primeiro.tipoProtese) ? primeiro.tipoProtese : null)
      const primeiroPasso = tipoPrincipal ? getPrimeiroPassoLaboratorial(tipoPrincipal) : null
      const tipoWorkflow = tipoPrincipal || getWorkflowForServico(primeiro.servico.nome)
      const primeiraEtapa = primeiroPasso?.macroetapa || 'recebimento'
      const arcadas = calcularTotalArcadas(itensCaso)
      const valorTotal = itensResolvidos.reduce((acc, i) => acc + i.valor, 0)
      const elementosCombinados = [...new Set(itensResolvidos.map((i) => {
        const el = i.raw.elementos?.trim()
        return el ? `${i.arcadaLabel}: ${el}` : i.arcadaLabel
      }).filter(Boolean))].join(' | ').slice(0, 100)
      const coresCombinadas = [...new Set(itensResolvidos.map((i) => i.raw.corDentes?.trim()).filter(Boolean))].join(' / ').slice(0, 50)
      const materiaisCombinados = [...new Set(itensResolvidos.map((i) => i.raw.material?.trim()).filter(Boolean))].join(', ').slice(0, 100)

      const criada = await prisma.ordem.create({
        data: {
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          servicoId: primeiro.servico.id,
          servicoNome: formatarNomeCombinado(itensCaso),
          nomePaciente: data.paciente,
          cpfPaciente,
          dataEntrega,
          valor: valorTotal,
          valorFinal: valorTotal,
          prioridade: data.prioridade,
          corDentes: coresCombinadas || primeiro.raw.corDentes,
          elementos: elementosCombinados || primeiro.raw.elementos,
          material: materiaisCombinados || primeiro.raw.material,
          observacoes: data.observacoes,
          status: primeiroPasso ? 'Em Produção' : 'Aguardando',
          localizacaoAtual: 'laboratorio',
          situacaoLogistica: 'no_laboratorio',
          etapaAtual: primeiraEtapa,
          subetapaAtual: primeiroPasso?.nome,
          tipoWorkflow,
          passoFluxoAtual: primeiroPasso?.id,
          arcadas,
          prazoEtapaAtual: primeiroPasso ? calcularPrazoPasso(agora, primeiroPasso, arcadas) : null,
          tentativaAtual: 0,
          historicoEtapas: [{ etapa: primeiraEtapa, acao: 'criou', itens: itensCaso.length, data: agora.toISOString(), por: usuario.email }],
          checklistEstetico: {
            itensCaso: itensCaso as unknown as Prisma.InputJsonValue[],
          },
          arquivoStl: data.arquivos || [],
        },
      })
      ordemCriadaOuAnexadaId = criada.id
      servicoIdsParaItemOrdem = itensResolvidos.map((i) => ({
        servicoId: i.servico.id,
        valor: i.valor,
        elementos: i.raw.elementos || null,
        especificacao: { arcada: i.arcadaLabel, cor: i.raw.corDentes || '', material: i.raw.material || '', tipoProtese: i.tipoProtese || 'geral' },
      }))
    } else {
      const operacoes = itensResolvidos.map((resolved) => {
        const { servico, valor, tipoProtese, arcadasItem, itemCaso, raw } = resolved
        const primeiroPasso = tipoProtese ? getPrimeiroPassoLaboratorial(tipoProtese) : null
        const tipoWorkflow = tipoProtese || getWorkflowForServico(servico.nome)
        const primeiraEtapa = primeiroPasso?.macroetapa || 'recebimento'

        return prisma.ordem.create({
          data: {
            clienteId: cliente.id,
            clienteNome: cliente.nome,
            servicoId: servico.id,
            servicoNome: `${servico.nome}${resolved.arcadaLabel ? ` (${resolved.arcadaLabel})` : ''}`.slice(0, 250),
            nomePaciente: data.paciente,
            cpfPaciente,
            dataEntrega,
            valor,
            valorFinal: valor,
            prioridade: data.prioridade,
            corDentes: raw.corDentes,
            elementos: raw.elementos || resolved.arcadaLabel,
            material: raw.material,
            observacoes: data.observacoes,
            status: primeiroPasso ? 'Em Produção' : 'Aguardando',
            localizacaoAtual: 'laboratorio',
            situacaoLogistica: 'no_laboratorio',
            etapaAtual: primeiraEtapa,
            subetapaAtual: primeiroPasso?.nome,
            tipoWorkflow,
            passoFluxoAtual: primeiroPasso?.id,
            arcadas: arcadasItem,
            prazoEtapaAtual: primeiroPasso ? calcularPrazoPasso(new Date(), primeiroPasso, arcadasItem) : null,
            tentativaAtual: 0,
            historicoEtapas: [{ etapa: primeiraEtapa, acao: 'criou', data: new Date().toISOString(), por: usuario.email }],
            checklistEstetico: {
              itensCaso: [itemCaso] as unknown as Prisma.InputJsonValue[],
            },
            arquivoStl: data.arquivos || [],
          },
        })
      })
      const criadas = await prisma.$transaction(operacoes)
      ordemCriadaOuAnexadaId = criadas[0]?.id ?? null
    }

    if (ordemCriadaOuAnexadaId && servicoIdsParaItemOrdem.length > 0) {
      try {
        await prisma.itemOrdem.createMany({
          data: servicoIdsParaItemOrdem.map((item) => ({
            ordemId: BigInt(ordemCriadaOuAnexadaId!),
            servicoId: BigInt(item.servicoId),
            quantidade: 1,
            valorUnitario: item.valor,
            valorTotal: item.valor,
            elementosDentais: item.elementos ? [item.elementos] : [],
            especificacaoProtese: item.especificacao,
          })),
        })
      } catch {
        // Não bloqueia criação da OS caso a tabela auxiliar itens_ordem tenha restrição diferente
      }
    }

    revalidatePath('/ordens')
    revalidatePath('/producao')
    revalidatePath('/lab-interno')
    revalidatePath('/dashboard')
    revalidatePath('/prioridades')
    return { success: true, ordemId: ordemCriadaOuAnexadaId }
  } catch (error) {
    console.error('Erro ao criar ordens em lote:', error)
    return { success: false, error: 'Erro ao criar ordens' }
  }
}

export async function updateOrdem(id: number, data: {
  paciente: string
  cpfPaciente: string
  dataEntrega: string
  prioridade: string
  status: string
  etapaAtual: string
  corDentes: string
  material: string
  observacoes: string
  motivoStatus?: string
}) {
  const usuario = await requireUser()
  try {
    const cpfPaciente = normalizarCpf(data.cpfPaciente)
    if (!isCpfValido(cpfPaciente)) return { success: false, error: 'Informe um CPF válido para o paciente' }
    const dataEntrega = validarDataEntrega(data.dataEntrega, true)
    if (!dataEntrega) return { success: false, error: 'Informe uma data de entrega válida entre 2020 e os próximos 2 anos' }
    if (data.status === 'Pausado' && !data.motivoStatus?.trim()) {
      return { success: false, error: 'Informe o motivo da pausa' }
    }

    // Normaliza etapaAtual para ID canônico antes de salvar
    const etapaCanonica = normalizarEtapa(data.etapaAtual)
    if (!podeSelecionarEtapaNaEdicao(etapaCanonica)) {
      return { success: false, error: 'Finalize a ordem e use Marcar como Entregue para confirmar a cobrança.' }
    }
    const novoStatus = data.status === 'Pausado'
      ? data.status
      : statusParaEtapa(etapaCanonica)

    const resultado = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM public.ordens WHERE id = ${id} FOR UPDATE`
      const ordemAtual = await tx.ordem.findUnique({ where: { id }, select: { status: true, etapaAtual: true, historicoEtapas: true } })
      if (!ordemAtual) return { success: false as const, error: 'Ordem não encontrada' }
      if (['Finalizado', 'Entregue', 'Cancelado'].includes(ordemAtual.status || '')) {
        return { success: false as const, error: 'Ordens encerradas não podem ser alteradas' }
      }

      const agora = new Date()
      const historico = (ordemAtual.historicoEtapas as Prisma.InputJsonObject[]) || []
      if (novoStatus === 'Pausado' && ordemAtual.status !== 'Pausado') {
        historico.push({ etapa: ordemAtual.etapaAtual || etapaCanonica, acao: 'pausou', motivo: data.motivoStatus?.trim(), data: agora.toISOString(), por: usuario.email })
      } else if (ordemAtual.status === 'Pausado' && novoStatus !== 'Pausado') {
        historico.push({ etapa: etapaCanonica, acao: 'retomou', data: agora.toISOString(), por: usuario.email })
      }

      await tx.ordem.update({
        where: { id },
        data: {
          nomePaciente: data.paciente,
          cpfPaciente,
          dataEntrega,
          prioridade: data.prioridade,
          status: novoStatus,
          etapaAtual: etapaCanonica,
          corDentes: data.corDentes,
          material: data.material,
          observacoes: data.observacoes,
          dataFinalizacao: novoStatus === 'Finalizado' ? agora : null,
          motivoPausa: novoStatus === 'Pausado' ? data.motivoStatus?.trim() : null,
          pausadoEm: novoStatus === 'Pausado' ? agora : null,
          pausadoPor: novoStatus === 'Pausado' ? usuario.email : null,
          historicoEtapas: historico,
        },
      })

      if (novoStatus === 'Finalizado') {
        await garantirEfeitosFinalizacao(tx, id, agora)
      }

      return { success: true as const }
    })

    if (!resultado.success) return resultado

    revalidatePath('/ordens')
    revalidatePath('/producao')
    revalidatePath('/prioridades')
    if (novoStatus === 'Finalizado') {
      revalidatePath('/financeiro')
      revalidatePath('/estoque')
    }
    return { success: true }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    return { success: false, error: `Erro ao atualizar ordem: ${errorMsg}` }
  }
}

export async function getOrdemById(id: number) {
  await requireUser()
  try {
    const ordem = await prisma.ordem.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, nome: true } },
        servico: { select: { id: true, nome: true } },
        contasReceber: {
          select: { id: true, valor: true, valorRecebido: true, status: true, dataVencimento: true, dataRecebimento: true, canceladoEm: true },
          orderBy: { id: 'desc' },
        },
      }
    })

    if (!ordem) {
      console.log('[getOrdemPublic] Ordem não encontrada para ID:', id)
      return null
    }

    return {
      id: ordem.id,
      paciente: ordem.nomePaciente,
      cpfPaciente: ordem.cpfPaciente || '',
      cliente: { id: ordem.cliente?.id, nome: ordem.clienteNome || ordem.cliente?.nome || 'Cliente Desconhecido' },
      clienteId: ordem.clienteId ?? undefined,
      servico: ordem.servicoNome || ordem.servico?.nome || 'Serviço',
      servicoId: ordem.servicoId ?? undefined,
      status: ordem.status || 'Aguardando',
      prioridade: ordem.prioridade || 'Normal',
      dataEntrada: ordem.dataPedido ? ordem.dataPedido.toISOString() : new Date().toISOString(),
      dataEntrega: ordem.dataEntrega?.toISOString() || new Date().toISOString(),
      etapaAtual: normalizarEtapa(ordem.etapaAtual || 'recebimento'),
      subetapaAtual: ordem.subetapaAtual || '',
      valor: Number(ordem.valorFinal ?? ordem.valor),
      corDentes: ordem.corDentes || '',
      material: ordem.material || '',
      observacoes: ordem.observacoes || '',
      arquivos: (ordem.arquivoStl as string[]) || [],
      elementos: ordem.elementos || '',
      arcadas: ordem.arcadas || 1,
      itensCaso: extrairItensCaso(ordem.checklistEstetico),
      // Original facts for the read-only detail; no fallback dates/stages or inferred payments.
      ficha: {
        status: ordem.status,
        etapaAtual: ordem.etapaAtual,
        passoFluxoAtual: ordem.passoFluxoAtual,
        dataEntrada: ordem.dataPedido?.toISOString() ?? null,
        dataEntrega: ordem.dataEntrega?.toISOString() ?? null,
        dataFinalizacao: ordem.dataFinalizacao?.toISOString() ?? null,
        dataEntregaReal: ordem.dataEntregaReal?.toISOString() ?? null,
        prazoEtapaAtual: ordem.prazoEtapaAtual?.toISOString() ?? null,
        prazoFornecedor: ordem.prazoFornecedor?.toISOString() ?? null,
        movimentacaoLogisticaEm: ordem.movimentacaoLogisticaEm?.toISOString() ?? null,
        cobrancas: ordem.contasReceber.map((conta) => ({
          id: conta.id, valor: Number(conta.valor), valorRecebido: Number(conta.valorRecebido), status: conta.status,
          dataVencimento: conta.dataVencimento?.toISOString() ?? null,
          dataRecebimento: conta.dataRecebimento?.toISOString() ?? null,
          canceladoEm: conta.canceladoEm?.toISOString() ?? null,
        })),
      },
      // Workflow fields
      tipoWorkflow: (ordem.tipoWorkflow as TipoWorkflow) || null,
      tentativaAtual: ordem.tentativaAtual || 0,
      historicoEtapas: (ordem.historicoEtapas as unknown[]) || [],
      checklistEstetico: (ordem.checklistEstetico as Partial<ChecklistEstetico>) || {},
      fotosProva: (ordem.fotosProva as unknown[]) || [],
      fotosCaso: Array.isArray(ordem.fotosCaso) ? ordem.fotosCaso.filter((foto): foto is string => typeof foto === 'string') : [],
      mensagens: Array.isArray(ordem.mensagens) ? ordem.mensagens : [],
      tokenRastreamento: ordem.tokenRastreamento,
      motivoPausa: ordem.motivoPausa,
      pausadoEm: ordem.pausadoEm?.toISOString() || null,
      localizacaoAtual: ordem.localizacaoAtual,
      situacaoLogistica: ordem.situacaoLogistica,
      dentistaResponsavel: ordem.dentistaResponsavel,
      finalidadeClinica: ordem.finalidadeClinica,
      agendamentoClinico: ordem.agendamentoClinico?.toISOString() || null,
    }
  } catch (error) {
    console.error('[getOrdemById] Erro ao buscar ordem:', error)
    return null
  }
}

export async function getOrdemPublic(token: string) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(token)) return null

  const ordem = await prisma.ordem.findUnique({
    where: { tokenRastreamento: token },
    select: {
      id: true,
      nomePaciente: true,
      clienteNome: true,
      servicoNome: true,
      status: true,
      prioridade: true,
      dataEntrega: true,
      etapaAtual: true,
      passoFluxoAtual: true,
      tipoWorkflow: true,
    },
  })
  if (!ordem) return null

  const partesNome = ordem.nomePaciente.trim().split(/\s+/)
  const pacienteMascarado = partesNome.length > 1
    ? `${partesNome[0]} ${partesNome.at(-1)?.charAt(0) || ''}.`
    : partesNome[0]

  return {
    id: ordem.id,
    paciente: pacienteMascarado,
    cliente: { nome: ordem.clienteNome },
    servico: ordem.servicoNome,
    status: ordem.status || 'Aguardando',
    prioridade: ordem.prioridade || 'Normal',
    dataEntrega: ordem.dataEntrega.toISOString(),
    etapaAtual: normalizarEtapa(ordem.etapaAtual || 'recebimento'),
    passoFluxoAtual: ordem.passoFluxoAtual,
    tipoWorkflow: ordem.tipoWorkflow,
  }
}

export async function deleteOrdem(id: number) {
  await requireUser()
  try {
    const resultado = await prisma.$transaction(async (tx) => {
      const ordem = await tx.ordem.findUnique({
        where: { id },
        select: {
          status: true,
          historicoEtapas: true,
          dataFinalizacao: true,
          dataEntregaReal: true,
          estoqueBaixadoEm: true,
          cobrancaGeradaEm: true,
          _count: { select: { ciclos: true, contasReceber: true } },
        },
      })
      if (!ordem) return { success: false as const, error: 'Ordem não encontrada' }

      const totalMovimentacoesEstoque = await tx.movimentacaoEstoque.count({ where: { ordemId: id } })
      const validacao = validarExclusaoOrdem({
        ...ordem,
        totalCiclos: ordem._count.ciclos,
        totalContasReceber: ordem._count.contasReceber,
        totalMovimentacoesEstoque,
      })
      if (!validacao.permitida) return { success: false as const, error: validacao.erro }

      await tx.ordem.delete({ where: { id } })
      return { success: true as const }
    })

    if (!resultado.success) return resultado
    revalidatePath('/ordens')
    revalidatePath('/producao')
    revalidatePath('/prioridades')
    return { success: true }
  } catch (error) {
    console.error('Erro ao excluir ordem:', error)
    return { success: false, error: 'Não foi possível excluir a ordem.' }
  }
}

export async function cancelarOrdem(id: number, motivo: string) {
  const usuario = await requireUser()
  if (!motivo.trim()) return { success: false, error: 'Informe o motivo do cancelamento' }

  const ordem = await prisma.ordem.findUnique({ where: { id } })
  if (!ordem) return { success: false, error: 'Ordem não encontrada' }
  if (['Finalizado', 'Entregue', 'Cancelado'].includes(ordem.status || '')) {
    return { success: false, error: 'Esta ordem não pode mais ser cancelada' }
  }

  const historico = (ordem.historicoEtapas as Prisma.InputJsonObject[]) || []
  historico.push({
    etapa: ordem.etapaAtual || 'recebimento',
    acao: 'cancelou',
    motivo: motivo.trim(),
    data: new Date().toISOString(),
    por: usuario.email,
  })

  await prisma.ordem.update({
    where: { id, updatedAt: ordem.updatedAt },
    data: {
      status: 'Cancelado',
      motivoCancelamento: motivo.trim(),
      canceladoEm: new Date(),
      canceladoPor: usuario.email,
      historicoEtapas: historico,
    },
  })

  revalidatePath('/ordens')
  revalidatePath('/producao')
  revalidatePath('/prioridades')
  return { success: true }
}

export async function getDadosNovaOrdem() {
  await requireUser()
  try {
    const [clientes, servicosRaw] = await Promise.all([
      prisma.cliente.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true } }),
      prisma.servico.findMany({ where: { ativo: true }, orderBy: { nome: 'asc' }, select: { id: true, nome: true, preco: true, tempoProducao: true, tipoWorkflow: true } })
    ])

    const servicos = servicosRaw.map(s => ({
      ...s,
      preco: Number(s.preco),
      tempoProducao: s.tempoProducao || 0,
    }))

    return { clientes, servicos }
  } catch (error) {
    console.error('Erro ao buscar dados para nova ordem:', error)
    return { clientes: [], servicos: [] }
  }
}

// ============================================================
// Workflow Actions — Avançar / Devolver etapas
// ============================================================

export async function avancarEtapa(ordemId: number, observacao?: string) {
  await requireUser()
  try {
    console.log('[avancarEtapa] Iniciando para ordem ID:', ordemId)
    const resultado = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM public.ordens WHERE id = ${ordemId} FOR UPDATE`
      const ordem = await tx.ordem.findUnique({ where: { id: ordemId } })
      if (!ordem) {
        console.error('[avancarEtapa] Ordem não encontrada:', ordemId)
        return { success: false as const, error: 'Ordem não encontrada' }
      }

      const tipoWorkflow = (ordem.tipoWorkflow as TipoWorkflow) || null
      // Normaliza etapa atual para ID canônico (lida com dados legados)
      const etapaAtualCanonica = normalizarEtapa(ordem.etapaAtual || 'recebimento')

      const proxima = getNextEtapa(tipoWorkflow, etapaAtualCanonica)
      if (!proxima) return { success: false as const, error: 'Já está na última etapa' }

      // Se é etapa de prova, verificar checklist
      if (isEtapaProva(tipoWorkflow, etapaAtualCanonica)) {
        const checklist = (ordem.checklistEstetico as Partial<ChecklistEstetico>) || {}
        if (!canAdvance(tipoWorkflow, etapaAtualCanonica, checklist)) {
          return { success: false as const, error: 'Complete o checklist de registro estético antes de avançar' }
        }
      }

      const agora = new Date()
      const historico = (ordem.historicoEtapas as Prisma.InputJsonObject[]) || []
      historico.push({
        etapa: etapaAtualCanonica,
        acao: 'avancou',
        para: proxima,
        data: agora.toISOString(),
        observacao: observacao || undefined,
      })

      // Determinar novo status: finalizado somente ao chegar em ETAPA_FINAL
      const novoStatus = statusParaEtapa(proxima)
      const progresso = getProgresso(tipoWorkflow, proxima)
      const fichaPreservada = preservarFichaClinica(ordem.checklistEstetico)

      await tx.ordem.update({
        where: { id: ordemId },
        data: {
          etapaAtual: proxima,
          historicoEtapas: historico,
          status: novoStatus,
          progresso,
          checklistEstetico: fichaPreservada,
          dataFinalizacao: proxima === ETAPA_FINAL ? agora : null,
        },
      })

      if (novoStatus === 'Finalizado') {
        await garantirEfeitosFinalizacao(tx, ordemId, agora)
      }

      return { success: true as const, novaEtapa: proxima, finalizado: novoStatus === 'Finalizado' }
    })

    if (!resultado.success) return resultado

    console.log('[avancarEtapa] Sucesso!')
    revalidatePath('/ordens')
    revalidatePath('/producao')
    revalidatePath('/lab-interno')
    revalidatePath('/prioridades')
    if (resultado.finalizado) {
      revalidatePath('/financeiro')
      revalidatePath('/estoque')
    }
    return { success: true, novaEtapa: resultado.novaEtapa }
  } catch (error) {
    console.error('[avancarEtapa] Erro detalhado:', error)
    const errorMsg = error instanceof Error ? error.message : String(error)
    return { success: false, error: `Erro ao avançar etapa: ${errorMsg}` }
  }
}

function preservarFichaClinica(checklistAtual: unknown): Prisma.InputJsonObject {
  if (!checklistAtual || typeof checklistAtual !== 'object' || Array.isArray(checklistAtual)) {
    return {}
  }
  const camposClinicos = [
    'dvo',
    'registroMordida',
    'linhaMedia',
    'oclusao',
    'corredorBucal',
    'moldeiraIndividual',
    'planoCera',
    'montagemDente',
    'barraProtocolo',
    'acrilizacao',
    'conserto',
    'corGengiva',
  ]
  const preservado: Record<string, Prisma.InputJsonValue | null> = {}
  const obj = checklistAtual as Record<string, unknown>
  for (const chave of camposClinicos) {
    const val = obj[chave]
    if (typeof val === 'boolean' || typeof val === 'string' || typeof val === 'number') {
      preservado[chave] = val
    }
  }
  if (Array.isArray(obj.itensCaso) && obj.itensCaso.length > 0) {
    preservado.itensCaso = obj.itensCaso as Prisma.InputJsonValue[]
  }
  return preservado
}

export async function marcarEntregue(ordemId: number, dadosCobranca: {
  valor: number
  vencimento: string
  observacoes?: string
}) {
  try {
    const usuario = await requireUser()
    if (!Number.isFinite(dadosCobranca.valor) || dadosCobranca.valor <= 0) {
      return { success: false, error: 'Informe um valor válido para a cobrança' }
    }
    const dataVencimento = validarDataEntrega(dadosCobranca.vencimento)
    if (!dataVencimento) {
      return { success: false, error: 'Informe um vencimento válido a partir de hoje' }
    }

    const resultado = await prisma.$transaction(async (tx) => {
      await tx.$queryRaw`SELECT id FROM ordens WHERE id = ${ordemId} FOR UPDATE`
      const ordem = await tx.ordem.findUnique({
        where: { id: ordemId },
        include: {
          contasReceber: {
            where: { status: { not: 'Cancelado' } },
            orderBy: { id: 'desc' },
            take: 1,
          },
        },
      })
      if (!ordem) throw new Error('Ordem não encontrada')
      if (ordem.status !== 'Finalizado') {
        throw new Error('Finalize o fluxo de produção antes de registrar a entrega')
      }

      const agora = new Date()
      const historico = (ordem.historicoEtapas as Prisma.InputJsonObject[]) || []
      historico.push({
        etapa: ordem.etapaAtual || 'pronto',
        acao: 'entrega_com_cobranca_confirmada',
        para: 'entregue',
        data: agora.toISOString(),
        por: usuario.email,
        valor: dadosCobranca.valor,
        vencimento: dadosCobranca.vencimento,
      })

      const contaExistente = ordem.contasReceber[0]
      let conta
      if (contaExistente) {
        const valorRecebido = Number(contaExistente.valorRecebido)
        if (dadosCobranca.valor < valorRecebido) {
          throw new Error('O valor da nota não pode ser menor que o valor já recebido')
        }
        conta = await tx.contaReceber.update({
          where: { id: contaExistente.id },
          data: {
            descricao: `${ordem.servicoNome} — Pac: ${ordem.nomePaciente}`,
            clienteId: ordem.clienteId,
            clienteNome: ordem.clienteNome,
            valor: dadosCobranca.valor,
            dataVencimento,
            status: valorRecebido >= dadosCobranca.valor ? 'Recebido' : valorRecebido > 0 ? 'Parcial' : 'Pendente',
            observacoes: dadosCobranca.observacoes?.trim() || contaExistente.observacoes,
          },
        })
      } else {
        conta = await tx.contaReceber.create({
          data: {
            ordemId,
            descricao: `${ordem.servicoNome} — Pac: ${ordem.nomePaciente}`,
            clienteId: ordem.clienteId,
            clienteNome: ordem.clienteNome,
            valor: dadosCobranca.valor,
            dataCompetencia: ordem.dataFinalizacao || agora,
            dataVencimento,
            status: 'Pendente',
            observacoes: dadosCobranca.observacoes?.trim() || `Nota confirmada na entrega da OS #${ordemId}`,
            usuarioId: usuario.id,
          },
        })
      }

      await tx.ordem.update({
        where: { id: ordemId },
        data: {
          etapaAtual: 'entregue',
          status: 'Entregue',
          historicoEtapas: historico,
          progresso: 100,
          dataEntregaReal: agora,
          valorFinal: dadosCobranca.valor,
          cobrancaGeradaEm: agora,
        },
      })

      return {
        contaId: conta.id,
        valor: Number(conta.valor),
        vencimento: conta.dataVencimento.toISOString(),
        status: conta.status || 'Pendente',
        entregueEm: agora.toISOString(),
      }
    })

    revalidatePath('/ordens')
    revalidatePath('/producao')
    revalidatePath('/lab-interno')
    revalidatePath('/prioridades')
    revalidatePath('/financeiro')
    revalidatePath('/recepcao')
    return { success: true, cobranca: resultado }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error)
    console.error('[marcarEntregue] Erro:', msg)
    return { success: false, error: msg }
  }
}

export async function retornarEtapa(ordemId: number, motivoRetorno: string) {
  await requireUser()
  try {
    if (!motivoRetorno.trim()) {
      return { success: false, error: 'Informe o motivo da devolução' }
    }

    const ordem = await prisma.ordem.findUnique({ where: { id: ordemId } })
    if (!ordem) return { success: false, error: 'Ordem não encontrada' }

    const tipoWorkflow = (ordem.tipoWorkflow as TipoWorkflow) || null
    const etapaAtual = ordem.etapaAtual || 'Recebimento'
    const retorno = getRetornoEtapa(tipoWorkflow, etapaAtual)

    if (!retorno) return { success: false, error: 'Não é possível retornar desta etapa' }

    const historico = (ordem.historicoEtapas as Prisma.InputJsonObject[]) || []
    const novaTentativa = (ordem.tentativaAtual || 0) + 1

    historico.push({
      etapa: etapaAtual,
      acao: 'devolveu',
      para: retorno,
      data: new Date().toISOString(),
      motivo: motivoRetorno,
      tentativa: novaTentativa,
    })

    const progresso = getProgresso(tipoWorkflow, retorno)
    const fichaPreservada = preservarFichaClinica(ordem.checklistEstetico)

    await prisma.ordem.update({
      where: { id: ordemId, updatedAt: ordem.updatedAt },
      data: {
        etapaAtual: retorno,
        tentativaAtual: novaTentativa,
        historicoEtapas: historico,
        status: statusParaEtapa(retorno),
        progresso: progresso,
        checklistEstetico: fichaPreservada,
      }
    })

    revalidatePath('/ordens')
    revalidatePath('/producao')
    revalidatePath('/lab-interno')
    revalidatePath('/prioridades')
    return { success: true, novaEtapa: retorno, tentativa: novaTentativa }
  } catch (error) {
    console.error('Erro ao retornar etapa:', error)
    return { success: false, error: 'Erro ao retornar etapa' }
  }
}

export async function updateChecklistEstetico(ordemId: number, checklist: Partial<ChecklistEstetico>) {
  await requireUser()
  try {
    const atual = await prisma.ordem.findUnique({ where: { id: ordemId }, select: { checklistEstetico: true } })
    const mesclado = {
      ...preservarFichaClinica(atual?.checklistEstetico),
      ...checklist,
    }
    await prisma.ordem.update({
      where: { id: ordemId },
      data: { checklistEstetico: mesclado }
    })
    revalidatePath('/ordens')
    return { success: true }
  } catch (error) {
    console.error('Erro ao atualizar checklist:', error)
    return { success: false, error: 'Erro ao atualizar checklist' }
  }
}

export async function uploadFotoProva(ordemId: number, fotoUrl: string, numeroProva: number, descricao?: string) {
  await requireUser()
  try {
    const ordem = await prisma.ordem.findUnique({ where: { id: ordemId } })
    if (!ordem) return { success: false, error: 'Ordem não encontrada' }

    const fotos = (ordem.fotosProva as Prisma.InputJsonObject[]) || []
    fotos.push({
      url: fotoUrl,
      numeroProva,
      descricao: descricao || '',
      dataUpload: new Date().toISOString(),
      etapa: ordem.etapaAtual,
    })

    await prisma.ordem.update({
      where: { id: ordemId },
      data: { fotosProva: fotos }
    })

    revalidatePath('/ordens')
    return { success: true }
  } catch (error) {
    console.error('Erro ao upload foto prova:', error)
    return { success: false, error: 'Erro ao salvar foto' }
  }
}

export async function getFotosProva(ordemId: number) {
  await requireUser()
  try {
    const ordem = await prisma.ordem.findUnique({
      where: { id: ordemId },
      select: { fotosProva: true }
    })
    return (ordem?.fotosProva as unknown[]) || []
  } catch (error) {
    console.error('Erro ao buscar fotos:', error)
    return []
  }
}

export async function verificarOrdemAtivaPaciente(params: {
  clienteId?: number
  nomePaciente?: string
  cpfPaciente?: string
}) {
  await requireUser()
  const cpfLimpo = normalizarCpf(params.cpfPaciente || '')
  const nomeNorm = normalizarNome(params.nomePaciente || '')
  if (cpfLimpo.length !== 11 && !nomeNorm) return null

  const candidatas = await prisma.ordem.findMany({
    where: {
      status: { notIn: STATUS_ENCERRADOS },
      ...(params.clienteId ? { clienteId: params.clienteId } : {}),
    },
    select: {
      id: true,
      nomePaciente: true,
      cpfPaciente: true,
      clienteId: true,
      servicoNome: true,
      status: true,
      dataEntrega: true,
      valor: true,
      valorFinal: true,
      arcadas: true,
    },
    orderBy: { id: 'desc' },
    take: 50,
  })

  const encontrada = candidatas.find((o) => {
    if (cpfLimpo.length === 11 && o.cpfPaciente === cpfLimpo) return true
    return Boolean(nomeNorm && normalizarNome(o.nomePaciente) === nomeNorm)
  })

  if (!encontrada) return null
  return {
    id: encontrada.id,
    paciente: encontrada.nomePaciente,
    servico: encontrada.servicoNome,
    status: encontrada.status || 'Aguardando',
    dataEntrega: encontrada.dataEntrega.toISOString(),
    valor: Number(encontrada.valorFinal ?? encontrada.valor),
    arcadas: encontrada.arcadas || 1,
  }
}

export async function detectarOrdensDuplicadas() {
  await requireUser()
  const ativas = await prisma.ordem.findMany({
    where: { status: { notIn: STATUS_ENCERRADOS } },
    select: {
      id: true,
      nomePaciente: true,
      cpfPaciente: true,
      clienteId: true,
      clienteNome: true,
      servicoNome: true,
      status: true,
      valor: true,
      valorFinal: true,
      arcadas: true,
      elementos: true,
      corDentes: true,
      dataEntrega: true,
      tipoWorkflow: true,
      passoFluxoAtual: true,
      etapaAtual: true,
    },
    orderBy: { id: 'asc' },
  })

  return agruparOrdensDuplicadas(
    ativas.map((o) => ({
      id: o.id,
      nomePaciente: o.nomePaciente,
      cpfPaciente: o.cpfPaciente,
      clienteId: o.clienteId,
      clienteNome: o.clienteNome,
      servicoNome: o.servicoNome,
      status: o.status,
      valor: Number(o.valorFinal ?? o.valor),
      arcadas: o.arcadas,
      elementos: o.elementos,
      corDentes: o.corDentes,
      dataEntrega: o.dataEntrega.toISOString(),
      tipoWorkflow: o.tipoWorkflow,
      passoFluxoAtual: o.passoFluxoAtual,
      etapaAtual: o.etapaAtual,
    })),
  )
}

export async function unificarOrdensDuplicadas(principalId: number, secundariasIds: number[]) {
  const usuario = await requireUser()
  const idsSecundarias = [...new Set(secundariasIds.filter((id) => Number.isInteger(id) && id > 0 && id !== principalId))]
  if (!Number.isInteger(principalId) || principalId <= 0 || idsSecundarias.length === 0) {
    return { success: false, error: 'Selecione a ordem principal e pelo menos uma ordem duplicada para unificar.' }
  }

  const todosIds = [principalId, ...idsSecundarias].sort((a, b) => a - b)

  try {
    const resultado = await prisma.$transaction(async (tx) => {
      for (const idLock of todosIds) {
        await tx.$queryRaw`SELECT id FROM public.ordens WHERE id = ${idLock} FOR UPDATE`
      }

      const ordens = await tx.ordem.findMany({ where: { id: { in: todosIds } } })
      const principal = ordens.find((o) => o.id === principalId)
      const secundarias = idsSecundarias
        .map((id) => ordens.find((o) => o.id === id))
        .filter((o): o is NonNullable<typeof o> => Boolean(o))

      if (!principal || secundarias.length !== idsSecundarias.length) {
        return { success: false as const, error: 'Uma ou mais ordens não foram encontradas.' }
      }

      const algumaEncerrada = [principal, ...secundarias].some((o) => STATUS_ENCERRADOS.includes(o.status || ''))
      if (algumaEncerrada) {
        return { success: false as const, error: 'Apenas ordens ativas podem ser unificadas.' }
      }

      const extrairListaItens = (ordem: typeof principal): ItemCasoOrdem[] => {
        const existentes = extrairItensCaso(ordem.checklistEstetico)
        if (existentes.length > 0) return existentes
        return [{
          servicoId: ordem.servicoId,
          servicoNome: ordem.servicoNome,
          arcada: ordem.arcadas === 2 ? 'Superior + Inferior' : ordem.elementos || null,
          elementos: ordem.elementos,
          corDentes: ordem.corDentes,
          material: ordem.material,
          tipoProtese: ordem.tipoWorkflow,
          valor: Number(ordem.valorFinal ?? ordem.valor),
          origemOrdemId: ordem.id,
        }]
      }

      const todosItens = [principal, ...secundarias].flatMap(extrairListaItens)
      const servicosFormatados = todosItens.map((item) => {
        const suf = item.arcada ? ` (${item.arcada})` : item.elementos ? ` (${item.elementos})` : ''
        return `${item.servicoNome}${suf}`
      })
      const servicoCombinado = [...new Set(servicosFormatados)].join(' + ').slice(0, 250)
      const valorTotal = [principal, ...secundarias].reduce((acc, o) => acc + Number(o.valor || 0), 0)
      const valorFinalTotal = [principal, ...secundarias].reduce((acc, o) => acc + Number(o.valorFinal ?? o.valor ?? 0), 0)
      const elementosCombinados = [...new Set([principal, ...secundarias].map((o) => o.elementos?.trim()).filter(Boolean))].join(', ').slice(0, 100)
      const coresCombinadas = [...new Set([principal, ...secundarias].map((o) => o.corDentes?.trim()).filter(Boolean))].join(' / ').slice(0, 50)
      const materiaisCombinados = [...new Set([principal, ...secundarias].map((o) => o.material?.trim()).filter(Boolean))].join(', ').slice(0, 100)
      const observacoesCombinadas = [...new Set([principal, ...secundarias].map((o) => o.observacoes?.trim()).filter(Boolean))].join('\n').trim()
      const arquivosCombinados = [...new Set([principal, ...secundarias].flatMap((o) => Array.isArray(o.arquivoStl) ? (o.arquivoStl as string[]) : []))]
      const fotosCasoCombinadas = [...new Set([principal, ...secundarias].flatMap((o) => Array.isArray(o.fotosCaso) ? (o.fotosCaso as string[]) : []))]
      const tipoFluxoPrincipal = escolherFluxoPrincipal(
        [principal, ...secundarias].map((o) => (isTipoProtese(o.tipoWorkflow) ? o.tipoWorkflow : inferirTipoProtese(o.servicoNome)) as TipoProteseId | null),
      )

      const agora = new Date()
      const historicoPrincipal = Array.isArray(principal.historicoEtapas)
        ? (principal.historicoEtapas as Prisma.InputJsonObject[])
        : []

      const fichaPreservada = preservarFichaClinica(principal.checklistEstetico)
      await tx.ordem.update({
        where: { id: principalId },
        data: {
          servicoNome: servicoCombinado || principal.servicoNome,
          valor: valorTotal,
          valorFinal: valorFinalTotal,
          arcadas: 2,
          elementos: elementosCombinados || principal.elementos,
          corDentes: coresCombinadas || principal.corDentes,
          material: materiaisCombinados || principal.material,
          observacoes: observacoesCombinadas || principal.observacoes,
          arquivoStl: arquivosCombinados,
          fotosCaso: fotosCasoCombinadas,
          ...(tipoFluxoPrincipal && !principal.tipoWorkflow ? { tipoWorkflow: tipoFluxoPrincipal } : {}),
          checklistEstetico: {
            ...fichaPreservada,
            itensCaso: todosItens as unknown as Prisma.InputJsonValue[],
          },
          historicoEtapas: [
            ...historicoPrincipal,
            {
              etapa: principal.etapaAtual || 'recebimento',
              acao: 'unificou_ordens_duplicadas',
              unificadas: idsSecundarias,
              data: agora.toISOString(),
              por: usuario.email,
            },
          ],
        },
      })

      // Move cobranças ativas e ciclos das ordens secundárias para a principal
      await tx.contaReceber.updateMany({
        where: { ordemId: { in: idsSecundarias }, status: { not: 'Cancelado' } },
        data: { ordemId: principalId },
      })

      const totalCiclosPrincipal = await tx.cicloProducao.count({ where: { ordemId: principalId } })
      const ciclosSecundarias = await tx.cicloProducao.findMany({
        where: { ordemId: { in: idsSecundarias } },
        orderBy: [{ ordemId: 'asc' }, { numeroCiclo: 'asc' }],
      })
      for (let idx = 0; idx < ciclosSecundarias.length; idx++) {
        await tx.cicloProducao.update({
          where: { id: ciclosSecundarias[idx].id },
          data: {
            ordemId: principalId,
            numeroCiclo: totalCiclosPrincipal + idx + 1,
          },
        })
      }

      const vinculoPrincipal = await tx.tratamentoVinculo.findUnique({ where: { ordemId: principalId } })
      if (!vinculoPrincipal) {
        const vinculoSec = await tx.tratamentoVinculo.findFirst({ where: { ordemId: { in: idsSecundarias } } })
        if (vinculoSec) {
          await tx.tratamentoVinculo.create({
            data: {
              ordemId: principalId,
              pacienteChave: vinculoSec.pacienteChave,
              pacienteNome: vinculoSec.pacienteNome,
              criadoPor: usuario.email,
            },
          })
        }
      }
      await tx.tratamentoVinculo.deleteMany({ where: { ordemId: { in: idsSecundarias } } })
      await tx.alertaTratamento.updateMany({
        where: { ordemId: { in: idsSecundarias }, resolvidoEm: null },
        data: { resolvidoEm: agora },
      })

      for (const sec of secundarias) {
        const histSec = Array.isArray(sec.historicoEtapas) ? (sec.historicoEtapas as Prisma.InputJsonObject[]) : []
        await tx.ordem.update({
          where: { id: sec.id },
          data: {
            status: 'Cancelado',
            motivoCancelamento: `Unificada na OS #${principalId}`,
            canceladoEm: agora,
            canceladoPor: usuario.email,
            historicoEtapas: [
              ...histSec,
              {
                etapa: sec.etapaAtual || 'recebimento',
                acao: 'unificada_em_os',
                principalId,
                data: agora.toISOString(),
                por: usuario.email,
              },
            ],
          },
        })
      }

      return { success: true as const, principalId, unificadas: idsSecundarias.length }
    })

    if (!resultado.success) return resultado

    revalidatePath('/ordens')
    revalidatePath('/producao')
    revalidatePath('/lab-interno')
    revalidatePath('/prioridades')
    revalidatePath('/recepcao')
    revalidatePath('/tratamentos')
    revalidatePath('/financeiro')
    revalidatePath('/dashboard')
    return resultado
  } catch (error) {
    console.error('Erro ao unificar ordens duplicadas:', error)
    return { success: false, error: 'Não foi possível unificar as ordens duplicadas.' }
  }
}
