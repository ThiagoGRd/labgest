import { NextRequest, NextResponse } from 'next/server'

// Mock data - em produção, usar Prisma
const ordens = [
  {
    id: 1,
    paciente: 'Maria Silva',
    clienteId: 1,
    clienteNome: 'Dr. João Santos',
    servicoId: 1,
    servicoNome: 'Prótese Total Superior',
    status: 'Em Produção',
    prioridade: 'Alta',
    dataPedido: '2026-02-01',
    dataEntrega: '2026-02-07',
    valor: 850.00,
    valorFinal: 850.00,
    etapaAtual: 'Acabamento',
    progresso: 75,
  },
  // ... mais ordens
]

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const clienteId = searchParams.get('clienteId')
  const limit = parseInt(searchParams.get('limit') || '50')
  const offset = parseInt(searchParams.get('offset') || '0')

  let filtered = [...ordens]

  if (status && status !== 'todos') {
    filtered = filtered.filter(o => o.status === status)
  }

  if (clienteId) {
    filtered = filtered.filter(o => o.clienteId === parseInt(clienteId))
  }

  const total = filtered.length
  const data = filtered.slice(offset, offset + limit)

  return NextResponse.json({
    data,
    meta: {
      total,
      limit,
      offset,
      hasMore: offset + limit < total,
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    // Validação básica
    if (!body.paciente || !body.clienteId || !body.servicoId || !body.dataEntrega) {
      return NextResponse.json(
        { error: 'Campos obrigatórios: paciente, clienteId, servicoId, dataEntrega' },
        { status: 400 }
      )
    }

    // TODO: Implementar criação com Prisma
    const novaOrdem = {
      id: Date.now(),
      ...body,
      status: 'Aguardando',
      prioridade: body.prioridade || 'Normal',
      dataPedido: new Date().toISOString().split('T')[0],
      etapaAtual: 'Recebimento do arquivo STL',
      progresso: 0,
      createdAt: new Date().toISOString(),
    }

    return NextResponse.json(novaOrdem, { status: 201 })
  } catch (error) {
    return NextResponse.json(
      { error: 'Erro ao criar ordem' },
      { status: 500 }
    )
  }
}
