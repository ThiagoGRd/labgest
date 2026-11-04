'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@labgest/database'
import { requireUser } from '@/lib/auth-utils'
import { resumirCobrancasMensais } from '@/lib/regra-cobranca-mensal'

let genAI: GoogleGenerativeAI | null = null
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
}

export async function getRelatorioFinanceiro(mesInformado?: string) {
  await requireUser()

  const hoje = new Date()
  const mesPadrao = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit' }).format(hoje)
  const periodoRanking = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesInformado || '') ? mesInformado! : mesPadrao
  const [ano, mes] = periodoRanking.split('-').map(Number)
  try {
    // Caixa nos seis meses até o mês selecionado; datas civis UTC.
    const inicioPeriodo = new Date(Date.UTC(ano, mes - 6, 1))
    const fimPeriodo = new Date(Date.UTC(ano, mes, 1))

    // Resultado realizado: somente dinheiro efetivamente movimentado.
    const movimentacoes = await prisma.movimentacaoFinanceira.findMany({
      where: {
        dataMovimentacao: { gte: inicioPeriodo, lt: fimPeriodo },
        estornadaEm: null,
      },
      select: {
        valor: true,
        dataMovimentacao: true,
        tipo: true,
      },
    })

    // Processar dados para gráfico mensal
    const dadosMensais = new Map()

    // Inicializar meses
    for (let i = 0; i < 6; i++) {
      const d = new Date(Date.UTC(ano, mes - 1 - i, 1))
      const key = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
      dadosMensais.set(key, { mes: key, receita: 0, despesa: 0, lucro: 0, ordem: i })
    }

    movimentacoes.forEach(movimentacao => {
      const key = movimentacao.dataMovimentacao.toLocaleString('pt-BR', { month: 'short', year: '2-digit', timeZone: 'UTC' })
      if (dadosMensais.has(key)) {
        const dado = dadosMensais.get(key)
        if (movimentacao.tipo === 'Entrada') {
          dado.receita += Number(movimentacao.valor)
          dado.lucro += Number(movimentacao.valor)
        } else {
          dado.despesa += Number(movimentacao.valor)
          dado.lucro -= Number(movimentacao.valor)
        }
      }
    })

    const grafico = Array.from(dadosMensais.values()).sort((a, b) => b.ordem - a.ordem)

    // Vendas de ordens válidas criadas no mês (timestamp em Maceió), não caixa.
    // Legados sem ID exigem reconciliação e não são atribuídos pelo nome.
    const topClientes = await prisma.ordem.groupBy({
      by: ['clienteId'],
      where: {
        clienteId: { not: null },
        status: { not: 'Cancelado' },
        createdAt: { gte: new Date(Date.UTC(ano, mes - 1, 1, 3)), lt: new Date(Date.UTC(ano, mes, 1, 3)) },
      },
      _sum: { valorFinal: true },
      _count: { id: true },
      orderBy: { _sum: { valorFinal: 'desc' } },
      take: 5,
    })

    const clientesRanking = await prisma.cliente.findMany({
      where: { id: { in: topClientes.flatMap(c => c.clienteId === null ? [] : [c.clienteId]) } },
      select: { id: true, nome: true },
    })
    const nomes = new Map(clientesRanking.map(c => [c.id, c.nome]))
    return {
      periodoRanking,
      grafico,
      topClientes: topClientes.map(c => ({
        id: c.clienteId,
        nome: nomes.get(c.clienteId!) || `Cliente #${c.clienteId}`,
        total: Number(c._sum.valorFinal),
        qtd: c._count.id,
        ticket: Number(c._sum.valorFinal) / c._count.id
      }))
    }

  } catch (error) {
    console.error('Erro no relatório financeiro:', error)
    return { periodoRanking, grafico: [], topClientes: [], error: 'Não foi possível carregar o relatório financeiro.' }
  }
}

export async function getClientesRelatorio() {
  await requireUser()

  return prisma.cliente.findMany({
    orderBy: { nome: 'asc' },
    select: { id: true, nome: true },
  })
}

export async function getRelatorioOrdensEntregues(mesInformado?: string, clienteIdInformado?: number) {
  await requireUser()

  const hoje = new Date()
  const mesPadrao = new Intl.DateTimeFormat('sv-SE', { timeZone: 'America/Maceio', year: 'numeric', month: '2-digit' }).format(hoje)
  const mes = /^\d{4}-(0[1-9]|1[0-2])$/.test(mesInformado || '') ? mesInformado! : mesPadrao
  const [ano, numeroMes] = mes.split('-').map(Number)
  const proximoMes = numeroMes === 12
    ? { ano: ano + 1, mes: 1 }
    : { ano, mes: numeroMes + 1 }

  // A conferência de cobrança usa a mesma competência prática do Financeiro: vencimento no mês.
  const inicioLegado = new Date(Date.UTC(ano, numeroMes - 1, 1))
  const fimLegado = new Date(Date.UTC(proximoMes.ano, proximoMes.mes - 1, 1))
  const mesLabel = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric', timeZone: 'UTC' })
    .format(inicioLegado)
  const partesHoje = new Intl.DateTimeFormat('en-US', {
    timeZone: 'America/Maceio',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(hoje)
  const valorParte = (tipo: Intl.DateTimeFormatPartTypes) => partesHoje.find(parte => parte.type === tipo)?.value || ''
  const hojeMaceio = `${valorParte('year')}-${valorParte('month')}-${valorParte('day')}`

  try {
    if (clienteIdInformado !== undefined && (!Number.isInteger(clienteIdInformado) || clienteIdInformado <= 0)) {
      throw new Error('Clínica inválida.')
    }
    const clienteSelecionado = clienteIdInformado !== undefined
      ? await prisma.cliente.findUnique({
          where: { id: clienteIdInformado },
          select: { id: true, nome: true, telefone: true, email: true, endereco: true, cro: true },
        })
      : null
    if (clienteIdInformado !== undefined && !clienteSelecionado) throw new Error('Clínica não encontrada.')
    const contas = await prisma.contaReceber.findMany({
      where: {
        canceladoEm: null,
        status: { not: 'Cancelado' },
        dataVencimento: { gte: inicioLegado, lt: fimLegado },
        ...(clienteSelecionado
          ? {
              clienteId: clienteSelecionado.id,
            }
          : {}),
      },
      select: {
        id: true,
        ordemId: true,
        clienteId: true,
        clienteNome: true,
        descricao: true,
        valor: true,
        valorRecebido: true,
        dataCompetencia: true,
        dataVencimento: true,
        status: true,
        cliente: { select: { nome: true } },
        ordem: {
          select: {
            clienteId: true,
            nomePaciente: true,
            servicoNome: true,
            dataEntregaReal: true,
            dataFinalizacao: true,
            dataEntrega: true,
          },
        },
      },
      orderBy: [{ clienteNome: 'asc' }, { dataVencimento: 'asc' }, { id: 'asc' }],
    })

    const itens = contas.map((conta) => {
      const vinculoInconsistente = !!conta.ordem && (conta.clienteId === null || conta.ordem.clienteId !== conta.clienteId)
      const ordem = vinculoInconsistente ? null : conta.ordem
      const origemData = ordem?.dataEntregaReal
        ? 'Entrega confirmada'
        : ordem?.dataFinalizacao
          ? 'Finalização legada'
          : ordem
            ? 'Previsão legada'
            : 'Lançamento financeiro'
      const dataEntrega = ordem?.dataEntregaReal || ordem?.dataFinalizacao || ordem?.dataEntrega || conta.dataCompetencia || conta.dataVencimento
      const cobrancaQuitada = conta.status === 'Recebido' || Number(conta.valorRecebido) >= Number(conta.valor)
      const cobrancaVencida = conta.dataVencimento.toISOString().slice(0, 10) < hojeMaceio
      const situacaoFinanceira: 'Recebida' | 'Pendente' | 'Vencida' = cobrancaQuitada
        ? 'Recebida'
        : cobrancaVencida
          ? 'Vencida'
          : 'Pendente'

      return {
        id: conta.id,
        ordemId: vinculoInconsistente ? null : conta.ordemId,
        paciente: vinculoInconsistente ? 'Vínculo da ordem requer revisão' : ordem?.nomePaciente || 'Lançamento avulso',
        cliente: conta.clienteNome || conta.cliente?.nome || 'Sem clínica',
        servico: vinculoInconsistente ? 'Vínculo da ordem requer revisão' : ordem?.servicoNome || conta.descricao,
        valor: Number(conta.valor),
        dataEntrega: dataEntrega.toISOString(),
        origemData,
        contaId: conta.id,
        statusFinanceiro: conta.status || 'Pendente',
        situacaoFinanceira,
        dataVencimento: conta.dataVencimento.toISOString(),
        valorRecebido: Number(conta.valorRecebido),
      }
    })

    const resumoFinanceiro = itens.reduce((resumo, item) => {
      const grupo = item.situacaoFinanceira === 'Recebida'
        ? resumo.recebidas
        : item.situacaoFinanceira === 'Vencida'
          ? resumo.vencidas
          : resumo.pendentes
      grupo.quantidade += 1
      grupo.valor += item.valor
      return resumo
    }, {
      recebidas: { quantidade: 0, valor: 0 },
      pendentes: { quantidade: 0, valor: 0 },
      vencidas: { quantidade: 0, valor: 0 },
    })
    const resumoCobrancas = resumirCobrancasMensais(contas)

    return {
      mes,
      mesLabel,
      clienteSelecionado,
      itens,
      totalOrdens: itens.length,
      valorTotal: resumoCobrancas.valorPrevisto,
      valorRecebidoTotal: resumoCobrancas.valorRecebido,
      saldoTotal: resumoCobrancas.saldo,
      comCobranca: itens.filter(item => item.contaId !== null).length,
      semCobranca: itens.filter(item => item.contaId === null).length,
      resumoFinanceiro,
    }
  } catch (error) {
    console.error('Erro no relatório de ordens entregues:', error)
    return {
      mes,
      mesLabel,
      clienteSelecionado: null,
      error: 'Não foi possível gerar o demonstrativo. Confira a clínica selecionada e tente novamente.',
      itens: [],
      totalOrdens: 0,
      valorTotal: 0,
      valorRecebidoTotal: 0,
      saldoTotal: 0,
      comCobranca: 0,
      semCobranca: 0,
      resumoFinanceiro: {
        recebidas: { quantidade: 0, valor: 0 },
        pendentes: { quantidade: 0, valor: 0 },
        vencidas: { quantidade: 0, valor: 0 },
      },
    }
  }
}

export async function gerarRelatorioIA(userQuery?: string) {
  await requireUser()

  try {
    // 1. Coletar dados do banco (Resumo)
    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    
    const [ordensMes, topServicos, clientesInativos, ordensAtrasadas, ordensStatus] = await Promise.all([
      prisma.ordem.aggregate({
        where: { createdAt: { gte: inicioMes } },
        _sum: { valor: true },
        _count: true
      }),
      prisma.ordem.groupBy({
        by: ['servicoNome'],
        _count: { servicoNome: true },
        orderBy: { _count: { servicoNome: 'desc' } },
        take: 3
      }),
      prisma.cliente.findMany({
        where: { 
          ordens: { none: { createdAt: { gte: new Date(new Date().setMonth(new Date().getMonth() - 2)) } } },
          ativo: true
        },
        select: { nome: true },
        take: 5
      }),
      prisma.ordem.count({
        where: {
          status: { in: ['Em Produção', 'Aguardando'] },
          dataEntrega: { lt: new Date() }
        }
      }),
      prisma.ordem.groupBy({
        by: ['status'],
        _count: { status: true },
      })
    ])

    // 2. Preparar contexto
    const dadosContexto = {
      faturamentoMes: Number(ordensMes._sum.valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }),
      totalPedidos: ordensMes._count,
      topServicos: topServicos.map(s => `${s.servicoNome} (${s._count}x)`),
      clientesRisco: clientesInativos.map(c => c.nome),
      ordensAtrasadas,
      statusBreakdown: ordensStatus.map(s => `${s.status}: ${s._count}`).join(', ')
    }

    if (!genAI) {
      return {
        analiseGeral: 'Configure a sua GEMINI_API_KEY no arquivo .env.local para gerar análises automáticas com IA.',
        tendencias: [],
        sugestoesAcao: ['Acesse o Google AI Studio para obter a sua chave de API.'],
        alertaRisco: null
      }
    }

    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash-latest',
      generationConfig: { responseMimeType: 'application/json' }
    })

    // A pergunta do usuário guia o foco da análise
    const focoPergunta = userQuery 
      ? `\n      PERGUNTA DO GESTOR: "${userQuery}"\n      Responda à pergunta acima com foco nos dados disponíveis.`
      : '\n      Faça uma análise geral de desempenho e sugira ações prioritárias.'

    const prompt = `
      Você é um consultor especialista em gestão de laboratórios de prótese dentária no Brasil.
      Analise os dados operacionais abaixo e gere um relatório estruturado em JSON.
      ${focoPergunta}
      
      DADOS OPERACIONAIS DO MÊS ATUAL:
      - Faturamento do mês: ${dadosContexto.faturamentoMes}
      - Total de ordens criadas: ${dadosContexto.totalPedidos}
      - Ordens em atraso: ${dadosContexto.ordensAtrasadas}
      - Status atual das ordens: ${dadosContexto.statusBreakdown}
      - Serviços mais solicitados: ${dadosContexto.topServicos.join(', ') || 'Nenhum dado'}
      - Clientes sem pedir há +60 dias (risco de churn): ${dadosContexto.clientesRisco.join(', ') || 'Nenhum'}

      Retorne APENAS JSON válido com esta estrutura (sem markdown, sem explicações, apenas o JSON):
      {
        "analiseGeral": "Parágrafo de 2-3 frases resumindo o desempenho e respondendo à pergunta do gestor.",
        "tendencias": ["Tendência observada 1", "Tendência observada 2", "Tendência observada 3"],
        "sugestoesAcao": ["Ação concreta e específica 1", "Ação concreta e específica 2", "Ação concreta e específica 3"],
        "alertaRisco": "Alerta específico sobre risco operacional ou financeiro, se houver. Null se não houver."
      }
    `

    const result = await model.generateContent(prompt)
    const text = result.response.text()
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim()
    
    return JSON.parse(jsonStr)

  } catch (error: unknown) {
    console.error('Erro na IA:', error)
    const mensagem = error instanceof Error ? error.message : 'Erro desconhecido.'
    return {
      analiseGeral: `Não foi possível gerar a análise neste momento. Motivo: ${mensagem}`,
      tendencias: [],
      sugestoesAcao: ['Verifique o token Gemini ou as cotas da API.', 'Reinicie o servidor Next.js para aplicar variáveis de ambiente.'],
      alertaRisco: null
    }
  }
}
