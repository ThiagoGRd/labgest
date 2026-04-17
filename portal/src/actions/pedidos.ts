'use server'

import { createClient } from '@/lib/supabase/server'
import { PrismaClient } from '@prisma/client'
import { revalidatePath } from 'next/cache'

const prisma = new PrismaClient()

// Importa parseDateLocal para evitar bug de fuso horário
function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}

// Mapeamento de IDs canônicos para labels amigáveis no portal
const ETAPA_LABELS_PORTAL: Record<string, string> = {
  recebimento:  'Recebido pelo laboratório',
  modelagem:    'Em Planejamento',
  confeccao:    'Em Produção',
  em_prova:     'Aguardando sua avaliação 🧪',
  ajuste:       'Em Ajuste',
  acabamento:   'Finalizando',
  conferencia:  'Controle de Qualidade',
  pronto:       'Pronto! Aguardando retirada ✅',
  entregue:     'Entregue ✓',
}

function etapaLabel(id: string): string {
  return ETAPA_LABELS_PORTAL[id] || id
}

// Normaliza valor legado do banco para ID canônico
function normalizarEtapa(valor: string): string {
  const v = valor.toLowerCase().trim()
  if (v.startsWith('recebimento')) return 'recebimento'
  if (v.includes('planejamento') || v === 'modelagem' || v.includes('delineamento')) return 'modelagem'
  if (v === 'impressão' || v === 'impressao' || v.includes('confecção') || v.includes('confeccao') || v.includes('fresagem') || v.includes('acriliza') || v.includes('rodete')) return 'confeccao'
  if (v.includes('prova')) return 'em_prova'
  if (v.includes('ajuste') || v.includes('remontagem')) return 'ajuste'
  if (v.includes('acabamento') || v.includes('polimento') || v.includes('montagem')) return 'acabamento'
  if (v.includes('conferência') || v.includes('conferencia')) return 'conferencia'
  if (v.includes('pronto') || v === 'finalizado') return 'pronto'
  if (v === 'entregue') return 'entregue'
  return v
}

// Utilitário para pegar o cliente logado
async function getClienteLogado() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user || !user.email) return null

  // Buscar cliente pelo email do Auth
  const cliente = await prisma.cliente.findFirst({
    where: { email: user.email }
  })

  return { user, cliente }
}

export async function criarPedidoBatch(data: {
  paciente: string
  dataEntrega: string
  observacoes: string
  arquivos: string[]
  dadosClinicos?: any
  itens: Array<{
    servicoId: number
    elementos: string
    corDentes: string
  }>
}) {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) {
    return { success: false, error: 'Cliente não encontrado. Complete seu cadastro.' }
  }

  const { cliente } = logado

  try {
    const promises = data.itens.map(async (item) => {
      const servico = await prisma.servico.findUnique({
        where: { id: item.servicoId }
      })

      if (!servico) throw new Error(`Serviço ID ${item.servicoId} inválido`)

      // Detectar workflow
      let tipoWorkflow = null
      const nomeLower = servico.nome.toLowerCase()
      if (nomeLower.includes('protocolo')) tipoWorkflow = 'protocolo'
      else if (nomeLower.includes('total') && nomeLower.includes('prótese')) tipoWorkflow = 'protese_total'
      else if (nomeLower.includes('parcial') || nomeLower.includes('ppr')) tipoWorkflow = 'parcial_removivel'

      // SEMPRE inicia em 'recebimento' (ID canônico)
      const primeiraEtapa = 'recebimento'

      return prisma.ordem.create({
        data: {
          clienteId: cliente.id,
          clienteNome: cliente.nome,
          servicoId: servico.id,
          servicoNome: servico.nome,
          nomePaciente: data.paciente,
          dataEntrega: parseDateLocal(data.dataEntrega),
          valor: servico.preco,
          valorFinal: servico.preco,
          prioridade: 'Normal',
          corDentes: item.corDentes,
          elementos: item.elementos,
          observacoes: data.observacoes,
          status: 'Aguardando',
          etapaAtual: primeiraEtapa,
          tipoWorkflow: tipoWorkflow,
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
    // Pegar preço do serviço
    const servico = await prisma.servico.findUnique({
      where: { id: data.servicoId }
    })

    if (!servico) return { success: false, error: 'Serviço inválido' }

    // Detectar workflow
    let tipoWorkflow = null
    const nomeLower = servico.nome.toLowerCase()
    if (nomeLower.includes('protocolo')) tipoWorkflow = 'protocolo'
    else if (nomeLower.includes('total') && nomeLower.includes('prótese')) tipoWorkflow = 'protese_total'
    else if (nomeLower.includes('parcial') || nomeLower.includes('ppr')) tipoWorkflow = 'parcial_removivel'

    // SEMPRE inicia em 'recebimento' (ID canônico)
    const primeiraEtapa = 'recebimento'

    await prisma.ordem.create({
      data: {
        clienteId: cliente.id,
        clienteNome: cliente.nome,
        servicoId: servico.id,
        servicoNome: servico.nome,
        nomePaciente: data.paciente,
        dataEntrega: parseDateLocal(data.dataEntrega),
        valor: servico.preco,
        valorFinal: servico.preco,
        prioridade: 'Normal',
        corDentes: data.corDentes,
        observacoes: data.observacoes,
        status: 'Aguardando',
        etapaAtual: primeiraEtapa,
        tipoWorkflow: tipoWorkflow,
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

export async function aprovarProva(pedidoId: number, checklist: any) {
  const logado = await getClienteLogado()
  
  if (!logado?.cliente) return { success: false, error: 'Não autorizado' }

  try {
    const pedido = await prisma.ordem.findUnique({ where: { id: pedidoId } })
    if (!pedido) return { success: false, error: 'Pedido não encontrado' }

    // Atualizar checklist e mudar status
    await prisma.ordem.update({
      where: { id: pedidoId },
      data: {
        checklistEstetico: checklist,
        // Ao aprovar prova, o dentista está "devolvendo" para o laboratório continuar
        // O status ideal seria "Retorno de Prova" ou "Em Produção" novamente
        status: 'Em Produção',
        historicoEtapas: [
          ...(pedido.historicoEtapas as any[] || []),
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
    const pedido = await (prisma as any).ordem.findFirst({
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

    const ciclos = (pedido.ciclos || []).map((c: any) => ({
      id: c.id,
      numeroCiclo: c.numeroCiclo,
      etapa: c.etapa,
      dataEntrada: c.dataEntrada?.toISOString(),
      prazoDias: c.prazoDias,
      dataComprometida: c.dataComprometida?.toISOString(),
      dataSaida: c.dataSaida?.toISOString() || null,
      dataRetorno: c.dataRetorno?.toISOString() || null,
      observacoesDentista: c.observacoesDentista,
      fotosProva: (c.fotosProva as string[]) || [],
      decisao: c.decisao,
      status: c.status,
    }))

    const cicloAtivo = ciclos.find((c: any) => c.status === 'em_prova') || null

    return {
      id: pedido.id,
      paciente: pedido.nomePaciente,
      servico: pedido.servicoNome || pedido.servico?.nome || '',
      status: pedido.status || 'Aguardando',
      dataEntrega: pedido.dataEntrega.toISOString(),
      valor: Number(pedido.valorFinal),
      // Normaliza legado e exibe label amigável
      etapaId: normalizarEtapa(pedido.etapaAtual || 'recebimento'),
      etapa: etapaLabel(normalizarEtapa(pedido.etapaAtual || 'recebimento')),
      corDentes: pedido.corDentes || '',
      elementos: pedido.elementos || '',
      observacoes: pedido.observacoes || '',
      historicoEtapas: (pedido.historicoEtapas as any[]) || [],
      mensagens: Array.isArray((pedido as any).mensagens) ? (pedido as any).mensagens : [],
      arquivos: (pedido.arquivoStl as string[]) || [],
      ciclos,
      cicloAtivoId: cicloAtivo?.id ?? null,
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
      etapa: etapaLabel(normalizarEtapa(p.etapaAtual || 'recebimento')),
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
  } catch (error) {
    return { total: 0, emAndamento: 0, finalizados: 0 }
  }
}

export async function getServicosDisponiveis() {
  try {
    const servicos = await prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { nome: 'asc' },
      select: { id: true, nome: true, categoria: true, preco: true }
    })
    
    return servicos.map(s => ({
      ...s,
      categoria: s.categoria || 'Geral',
      preco: Number(s.preco)
    }))
  } catch (error) {
    return []
  }
}
