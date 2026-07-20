'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@labgest/database'
import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { isCpfValido, normalizarCpf } from '@/lib/cpf'
import { calcularPrazoPasso, etapaLabel, getFluxoProtese, getWorkflowForServico, inferirTipoProtese, isTipoProtese, normalizarEtapa } from '@/lib/workflow-config'

// Importa parseDateLocal para evitar bug de fuso horário
function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}

function isRegistro(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor)
}

function normalizarStrings(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((item): item is string => typeof item === 'string') : []
}

function normalizarHistorico(valor: unknown) {
  if (!Array.isArray(valor)) return []

  return valor.flatMap((item) => {
    if (!isRegistro(item) || typeof item.data !== 'string' || typeof item.acao !== 'string') return []
    return [{
      data: item.data,
      acao: item.acao,
      para: typeof item.para === 'string' ? item.para : undefined,
      motivo: typeof item.motivo === 'string' ? item.motivo : undefined,
    }]
  })
}

function normalizarMensagens(valor: unknown) {
  if (!Array.isArray(valor)) return []

  return valor.flatMap((item) => {
    if (
      !isRegistro(item)
      || typeof item.id !== 'string'
      || typeof item.role !== 'string'
      || typeof item.nome !== 'string'
      || typeof item.texto !== 'string'
      || typeof item.createdAt !== 'string'
    ) return []

    return [{
      id: item.id,
      role: item.role,
      nome: item.nome,
      texto: item.texto,
      fotoUrl: typeof item.fotoUrl === 'string' ? item.fotoUrl : undefined,
      createdAt: item.createdAt,
    }]
  })
}

// Utilitário para pegar o cliente logado
async function getClienteLogado() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) return null

  // Buscar cliente pelo email do Auth
  const cliente = await prisma.cliente.findFirst({
    where: { email: { equals: user.email, mode: 'insensitive' }, ativo: true }
  })

  return { user, cliente }
}

export async function criarPedidoBatch(data: {
  paciente: string
  cpfPaciente: string
  dataEntrega: string
  observacoes: string
  arquivos: string[]
  dadosClinicos?: Prisma.InputJsonObject
  itens: Array<{
    servicoId: number
    elementos: string
    corDentes: string
    arcadas?: number
    tipoProtese?: string
  }>
}) {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) {
    return { success: false, error: 'Cliente não encontrado. Complete seu cadastro.' }
  }

  const { cliente } = logado

  try {
    const cpfPaciente = normalizarCpf(data.cpfPaciente)
    if (!isCpfValido(cpfPaciente)) return { success: false, error: 'Informe um CPF válido para o paciente' }

    const promises = data.itens.map(async (item) => {
      const servico = await prisma.servico.findUnique({
        where: { id: item.servicoId }
      })

      if (!servico) throw new Error(`Serviço ID ${item.servicoId} inválido`)

      // Detectar workflow
      const tipoProtese = isTipoProtese(item.tipoProtese)
        ? item.tipoProtese
        : isTipoProtese(servico.tipoWorkflow)
          ? servico.tipoWorkflow
          : inferirTipoProtese(servico.nome)
      const primeiroPasso = tipoProtese ? getFluxoProtese(tipoProtese).passos[0] : null
      const tipoWorkflow = tipoProtese || getWorkflowForServico(servico.nome)
      const primeiraEtapa = primeiroPasso?.macroetapa || 'recebimento'
      const arcadas = item.arcadas === 2 ? 2 : 1

      return prisma.ordem.create({
        data: {
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          servicoId: servico.id,
          servicoNome: servico.nome,
          nomePaciente: data.paciente,
          cpfPaciente,
          dataEntrega: parseDateLocal(data.dataEntrega),
          valor: servico.preco,
          valorFinal: servico.preco,
          prioridade: 'Normal',
          corDentes: item.corDentes,
          elementos: item.elementos,
          observacoes: data.observacoes,
          status: 'Aguardando',
          etapaAtual: primeiraEtapa,
          subetapaAtual: primeiroPasso?.nome,
          tipoWorkflow: tipoWorkflow,
          passoFluxoAtual: primeiroPasso?.id,
          arcadas,
          prazoEtapaAtual: primeiroPasso ? calcularPrazoPasso(new Date(), primeiroPasso, arcadas) : null,
          tentativaAtual: 0,
          historicoEtapas: [{ etapa: primeiraEtapa, acao: 'criou', data: new Date().toISOString() }],
          checklistEstetico: data.dadosClinicos || {},
          arquivoStl: data.arquivos,
        }
      })
    })

    await Promise.all(promises)

    revalidatePath('/pedidos')
    revalidatePath('/dashboard')
    return { success: true }

  } catch (error) {
    console.error('Erro ao criar pedidos em lote:', error)
    return { success: false, error: 'Erro interno ao criar pedido' }
  }
}

export async function criarPedido(data: {
  paciente: string
  cpfPaciente: string
  servicoId: number
  servicoNome: string
  corDentes: string
  dataEntrega: string
  observacoes: string
  arquivos: string[]
}) {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) {
    return { success: false, error: 'Cliente não encontrado. Complete seu cadastro.' }
  }

  const { cliente } = logado

  try {
    const cpfPaciente = normalizarCpf(data.cpfPaciente)
    if (!isCpfValido(cpfPaciente)) return { success: false, error: 'Informe um CPF válido para o paciente' }

    // Pegar preço do serviço
    const servico = await prisma.servico.findUnique({
      where: { id: data.servicoId }
    })

    if (!servico) return { success: false, error: 'Serviço inválido' }

    // Detectar workflow
    const tipoProtese = isTipoProtese(servico.tipoWorkflow) ? servico.tipoWorkflow : inferirTipoProtese(servico.nome)
    const primeiroPasso = tipoProtese ? getFluxoProtese(tipoProtese).passos[0] : null
    const tipoWorkflow = tipoProtese || getWorkflowForServico(servico.nome)
    const primeiraEtapa = primeiroPasso?.macroetapa || 'recebimento'

    await prisma.ordem.create({
      data: {
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        servicoId: servico.id,
        servicoNome: servico.nome,
        nomePaciente: data.paciente,
        cpfPaciente,
        dataEntrega: parseDateLocal(data.dataEntrega),
        valor: servico.preco,
        valorFinal: servico.preco,
        prioridade: 'Normal',
        corDentes: data.corDentes,
        observacoes: data.observacoes,
        status: 'Aguardando',
        etapaAtual: primeiraEtapa,
        subetapaAtual: primeiroPasso?.nome,
        tipoWorkflow: tipoWorkflow,
        passoFluxoAtual: primeiroPasso?.id,
        prazoEtapaAtual: primeiroPasso ? calcularPrazoPasso(new Date(), primeiroPasso, 1) : null,
        tentativaAtual: 0,
        historicoEtapas: [{ etapa: primeiraEtapa, acao: 'criou', data: new Date().toISOString() }],
        checklistEstetico: {},
        arquivoStl: data.arquivos,
      }
    })

    revalidatePath('/pedidos')
    revalidatePath('/dashboard')
    return { success: true }

  } catch (error) {
    console.error('Erro ao criar pedido:', error)
    return { success: false, error: 'Erro interno ao criar pedido' }
  }
}

export async function aprovarProva(pedidoId: number, checklist: Prisma.InputJsonObject) {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) return { success: false, error: 'Não autorizado' }

  try {
    const pedido = await prisma.ordem.findFirst({ where: { id: pedidoId, clienteId: logado.cliente.id } })
    if (!pedido) return { success: false, error: 'Pedido não encontrado' }

    // Atualizar checklist e mudar status
    await prisma.ordem.update({
      where: { id: pedidoId },
      data: {
        checklistEstetico: checklist,
        // Ao aprovar prova, o dentista está "devolvendo" para o laboratório continuar
        // O status ideal seria "Retorno de Prova" ou "Em Produção" novamente
        status: 'Em Produção',
        etapaAtual: 'acabamento',
        subetapaAtual: 'Prova aprovada pelo dentista',
        historicoEtapas: [
          ...(pedido.historicoEtapas as Prisma.InputJsonObject[] || []),
          {
            etapa: pedido.etapaAtual,
            acao: 'aprovou_prova',
            data: new Date().toISOString(),
            usuario: logado.cliente.nome
          }
        ]
      }
    })

    revalidatePath('/pedidos')
    return { success: true }
  } catch (error) {
    console.error('Erro ao aprovar prova:', error)
    return { success: false, error: 'Erro ao aprovar prova' }
  }
}

export async function getPedidoById(id: number) {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) return null

  try {
    const pedido = await prisma.ordem.findFirst({
      where: { 
        id,
        clienteId: logado.cliente.id 
      },
      include: {
        servico: { select: { nome: true } },
        ciclos: {
          orderBy: { numeroCiclo: 'asc' }
        }
      }
    })

    if (!pedido) return null

    const ciclos = pedido.ciclos.map((c) => ({
      id: c.id,
      numeroCiclo: c.numeroCiclo,
      etapa: c.etapa,
      dataEntrada: c.dataEntrada.toISOString(),
      prazoDias: c.prazoDias,
      dataComprometida: c.dataComprometida.toISOString(),
      dataSaida: c.dataSaida?.toISOString() || null,
      dataRetorno: c.dataRetorno?.toISOString() || null,
      observacoesDentista: c.observacoesDentista,
      fotosProva: normalizarStrings(c.fotosProva),
      decisao: c.decisao,
      status: c.status,
    }))

    const cicloAtivo = ciclos.find((c) => c.status === 'em_prova') || null

    return {
      id: pedido.id,
      paciente: pedido.nomePaciente,
      servico: pedido.servicoNome || pedido.servico?.nome || '',
      status: pedido.status || 'Aguardando',
      dataEntrega: pedido.dataEntrega.toISOString(),
      valor: Number(pedido.valorFinal),
      // Normaliza legado e exibe label amigável
      etapaId: normalizarEtapa(pedido.etapaAtual || 'recebimento'),
      etapa: etapaLabel(normalizarEtapa(pedido.etapaAtual || 'recebimento'), 'portal'),
      corDentes: pedido.corDentes || '',
      elementos: pedido.elementos || '',
      observacoes: pedido.observacoes || '',
      historicoEtapas: normalizarHistorico(pedido.historicoEtapas),
      mensagens: normalizarMensagens(pedido.mensagens),
      arquivos: normalizarStrings(pedido.arquivoStl),
      fotosCaso: normalizarStrings(pedido.fotosCaso),
      ciclos,
      cicloAtivoId: cicloAtivo?.id ?? null,
      tipoWorkflow: pedido.tipoWorkflow,
      passoFluxoAtual: pedido.passoFluxoAtual,
      subetapaAtual: pedido.subetapaAtual,
      arcadas: pedido.arcadas,
      prazoEtapaAtual: pedido.prazoEtapaAtual?.toISOString() ?? null,
    }
  } catch (error) {
    console.error('Erro ao buscar pedido:', error)
    return null
  }
}

export async function getMeusPedidos() {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) return []

  try {
    const pedidos = await prisma.ordem.findMany({
      where: { clienteId: logado.cliente.id },
      orderBy: { createdAt: 'desc' }
    })

    return pedidos.map(p => ({
      id: p.id,
      paciente: p.nomePaciente,
      servico: p.servicoNome,
      status: p.status || 'Aguardando',
      dataEntrega: p.dataEntrega.toISOString(),
      valor: Number(p.valorFinal),
      etapaId: normalizarEtapa(p.etapaAtual || 'recebimento'),
      etapa: etapaLabel(normalizarEtapa(p.etapaAtual || 'recebimento'), 'portal'),
      progresso: p.progresso ?? undefined,
    }))
  } catch (error) {
    console.error('Erro ao buscar pedidos:', error)
    return []
  }
}

export async function getHistoricoPedidos() {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) return []

  try {
    const pedidos = await prisma.ordem.findMany({
      where: { 
        clienteId: logado.cliente.id,
        status: { in: ['Finalizado', 'Entregue', 'Cancelado'] }
      },
      orderBy: { createdAt: 'desc' }
    })

    return pedidos.map(p => ({
      id: p.id,
      paciente: p.nomePaciente,
      servico: p.servicoNome,
      status: p.status || 'Finalizado',
      dataEntrega: p.dataEntrega.toISOString(),
      dataFinalizacao: p.dataFinalizacao?.toISOString() || p.updatedAt?.toISOString() || new Date().toISOString(),
      valor: Number(p.valorFinal),
    }))
  } catch (error) {
    console.error('Erro ao buscar histórico:', error)
    return []
  }
}

export async function getDashboardStats() {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) return { total: 0, emAndamento: 0, finalizados: 0 }

  try {
    const [total, emAndamento, finalizados] = await Promise.all([
      prisma.ordem.count({ where: { clienteId: logado.cliente.id } }),
      prisma.ordem.count({ 
        where: { 
          clienteId: logado.cliente.id,
          status: { notIn: ['Finalizado', 'Entregue', 'Cancelado'] }
        } 
      }),
      prisma.ordem.count({ 
        where: { 
          clienteId: logado.cliente.id,
          status: 'Finalizado'
        } 
      })
    ])

    return { total, emAndamento, finalizados }
  } catch {
    return { total: 0, emAndamento: 0, finalizados: 0 }
  }
}

export async function getServicosDisponiveis() {
  try {
    const servicos = await prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, categoria: true, preco: true, tempoProducao: true, tipoWorkflow: true }
    })
    
    return servicos.map(s => ({
      ...s,
      categoria: s.categoria || 'Geral',
      preco: Number(s.preco),
      tempoProducao: s.tempoProducao ?? 0
    }))
  } catch {
    return []
  }
}

export async function adicionarFotoCaso(ordemId: number, fotoUrl: string) {
  try {
    const logado = await getClienteLogado()
    if (!logado?.cliente) return { success: false, error: 'Não autorizado' }

    const ordem = await prisma.ordem.findFirst({ where: { id: ordemId, clienteId: logado.cliente.id } })
    
    if (!ordem) throw new Error('Ordem não encontrada')
    
    const fotosAntigas = Array.isArray(ordem.fotosCaso) ? ordem.fotosCaso : []
    const novasFotos = [...fotosAntigas, fotoUrl]

    await prisma.ordem.update({
      where: { id: ordemId },
      data: { fotosCaso: novasFotos }
    })
    
    revalidatePath('/')
    return { success: true }
  } catch (error) {
    console.error('Erro ao salvar foto:', error)
    return { success: false, error: 'Erro ao salvar a foto do caso' }
  }
}
