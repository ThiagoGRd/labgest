'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@labgest/database'
import { requireUser } from '@/lib/auth-utils'

let genAI: GoogleGenerativeAI | null = null
if (process.env.GEMINI_API_KEY) {
  genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
}

export async function getRelatorioFinanceiro() {
  await requireUser()

  try {
    const hoje = new Date()
    // Últimos 6 meses
    const inicioPeriodo = new Date(hoje.getFullYear(), hoje.getMonth() - 5, 1)

    // Agrupar Receitas (Contas Receber Pagas + Pendentes)
    const receitas = await prisma.contaReceber.findMany({
      where: {
        dataVencimento: { gte: inicioPeriodo },
      },
      select: {
        valor: true,
        dataVencimento: true,
        status: true
      }
    })

    // Agrupar Despesas (Contas Pagar)
    const despesas = await prisma.contaPagar.findMany({
      where: {
        dataVencimento: { gte: inicioPeriodo },
      },
      select: {
        valor: true,
        dataVencimento: true,
        status: true
      }
    })

    // Processar dados para gráfico mensal
    const dadosMensais = new Map()

    // Inicializar meses
    for (let i = 0; i < 6; i++) {
      const d = new Date(hoje.getFullYear(), hoje.getMonth() - i, 1)
      const key = d.toLocaleString('pt-BR', { month: 'short', year: '2-digit' })
      dadosMensais.set(key, { mes: key, receita: 0, despesa: 0, lucro: 0, ordem: i })
    }

    receitas.forEach(r => {
      const key = r.dataVencimento.toLocaleString('pt-BR', { month: 'short', year: '2-digit' })
      if (dadosMensais.has(key)) {
        const dado = dadosMensais.get(key)
        dado.receita += Number(r.valor)
        dado.lucro += Number(r.valor)
      }
    })

    despesas.forEach(d => {
      const key = d.dataVencimento.toLocaleString('pt-BR', { month: 'short', year: '2-digit' })
      if (dadosMensais.has(key)) {
        const dado = dadosMensais.get(key)
        dado.despesa += Number(d.valor)
        dado.lucro -= Number(d.valor)
      }
    })

    const grafico = Array.from(dadosMensais.values()).sort((a, b) => b.ordem - a.ordem)

    // Top Clientes (Ticket Médio)
    const topClientes = await prisma.ordem.groupBy({
      by: ['clienteNome'],
      _sum: { valorFinal: true },
      _count: { id: true },
      orderBy: { _sum: { valorFinal: 'desc' } },
      take: 5,
    })

    return {
      grafico,
      topClientes: topClientes.map(c => ({
        nome: c.clienteNome,
        total: Number(c._sum.valorFinal),
        qtd: c._count.id,
        ticket: Number(c._sum.valorFinal) / c._count.id
      }))
    }

  } catch (error) {
    console.error('Erro no relatório financeiro:', error)
    return { grafico: [], topClientes: [] }
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
      model: 'gemini-1.5-flash',
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

  } catch (error: any) {
    console.error('Erro na IA:', error)
    return {
      analiseGeral: `Não foi possível gerar a análise neste momento. Motivo: ${error.message || 'Erro desconhecido.'}`,
      tendencias: [],
      sugestoesAcao: ['Verifique o token Gemini ou as cotas da API.', 'Reinicie o servidor Next.js para aplicar variáveis de ambiente.'],
      alertaRisco: null
    }
  }
}
