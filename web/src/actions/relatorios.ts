'use server'

import { GoogleGenerativeAI } from '@google/generative-ai'
import { prisma } from '@labgest/database'
import { requireUser } from '@/lib/auth-utils'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

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

    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

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

  } catch (error) {
    console.error('Erro na IA:', error)
    return {
      analiseGeral: 'Não foi possível gerar a análise neste momento.',
      tendencias: [],
      sugestoesAcao: [],
      alertaRisco: null
    }
  }
}
