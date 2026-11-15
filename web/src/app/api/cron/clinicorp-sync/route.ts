import { timingSafeEqual } from 'node:crypto'
import { sincronizarClinicorp } from '@/lib/controle-tratamentos'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

function autorizado(request: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo) return false
  const recebido = Buffer.from(request.headers.get('authorization') ?? '')
  const esperado = Buffer.from(`Bearer ${segredo}`)
  return recebido.length === esperado.length && timingSafeEqual(recebido, esperado)
}

// Chamada diariamente pelo Vercel Cron (web/vercel.json), que envia
// "Authorization: Bearer $CRON_SECRET". Sem o segredo configurado, recusa tudo.
export async function GET(request: Request) {
  if (!autorizado(request)) return Response.json({ error: 'Não autorizado.' }, { status: 401 })
  const resultado = await sincronizarClinicorp('cron')
  return Response.json(
    { sucesso: resultado.sucesso, consultas: resultado.consultas, alertasNovos: resultado.alertasNovos },
    { status: resultado.sucesso ? 200 : 502, headers: { 'Cache-Control': 'no-store' } },
  )
}
