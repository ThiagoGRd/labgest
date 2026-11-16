import { NextRequest } from 'next/server'
import { getPainelTvData } from '@/actions/agenda-tv'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  const data = request.nextUrl.searchParams.get('data') ?? undefined
  try {
    const snapshot = await getPainelTvData(data)
    return Response.json(snapshot, {
      status: 200,
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (error) {
    const mensagem = error instanceof Error ? error.message : 'Não autorizado'
    const status = mensagem.includes('autorizad') || mensagem.includes('acesso') ? 401 : 500
    return Response.json({ error: mensagem }, { status, headers: { 'Cache-Control': 'no-store' } })
  }
}
