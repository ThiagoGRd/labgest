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

export async function gerarRelatorioIA() {
  await requireUser()

  try {
    // 1. Coletar dados do banco (Resumo)
    const hoje = new Date()
    const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1)
    
    const [ordensMes, topServicos, clientesInativos] = await Promise.all([
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
          ordens: { none: { createdAt: { gte: new Date(hoje.setMonth(hoje.getMonth() - 2)) } } }, // Sem pedidos há 2 meses
          ativo: true
        },
        select: { nome: true },
        take: 5
      })
    ])

    // 2. Preparar Prompt
    const dadosContexto = {
      faturamentoMes: ordensMes._sum.valor || 0,
      totalPedidos: ordensMes._count,
      topServicos: topServicos.map(s => `${s.servicoNome} (${s._count})`),
      clientesRisco: clientesInativos.map(c => c.nome),
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

    const prompt = `
      Você é um consultor especialista em gestão de laboratórios de prótese dentária.
      Analise os dados abaixo e gere um relatório conciso em formato JSON.
      
      Dados do Mês Atual:
      - Faturamento: R$ ${dadosContexto.faturamentoMes}
      - Total de Pedidos: ${dadosContexto.totalPedidos}
      - Top Serviços: ${dadosContexto.topServicos.join(', ')}
      - Clientes em Risco (sem pedir há 60d): ${dadosContexto.clientesRisco.join(', ')}

      Gere um JSON com esta estrutura exata (sem markdown, apenas o json):
      {
        "analiseGeral": "Texto curto resumindo o desempenho.",
        "tendencias": ["Item 1", "Item 2", "Item 3"],
        "sugestoesAcao": ["Ação 1", "Ação 2", "Ação 3"],
        "alertaRisco": "Texto sobre clientes em risco ou faturamento baixo, se houver."
      }
    `

    // 3. Gerar Conteúdo
    const result = await model.generateContent(prompt)
    const response = result.response
    const text = response.text()
    
    // Limpar markdown se houver
    const jsonStr = text.replace(/```json/g, '').replace(/```/g, '').trim()
    
    return JSON.parse(jsonStr)

  } catch (error: any) {
    console.error('Erro na IA:', error)
    return {
      analiseGeral: `Não foi possível gerar a análise neste momento. Motivo: ${error.message || 'Erro desconhecido.'}`,
      tendencias: [],
      sugestoesAcao: ['Verifique o token Gemini ou as cotas da API.', 'Verifique se você reiniciou o Next.js (terminal) para aplicar a varíavel de ambiente.'],
      alertaRisco: null
    }
  }
}
