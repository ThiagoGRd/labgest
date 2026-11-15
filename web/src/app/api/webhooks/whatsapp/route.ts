import { NextResponse } from 'next/server'
import { processarMensagemGrupoWhatsappInterna } from '@/actions/triagem-whatsapp'
import { carregarConfigWhatsappInterna } from '@/actions/notificacoes'

export const dynamic = 'force-dynamic'

function extrairPayloadEvolution(body: Record<string, unknown>) {
  const data = (body.data && typeof body.data === 'object' ? body.data : body) as Record<string, unknown>
  const key = (data.key && typeof data.key === 'object' ? data.key : {}) as Record<string, unknown>
  const message = (data.message && typeof data.message === 'object' ? data.message : {}) as Record<string, unknown>

  const remoteJid = String(key.remoteJid || data.remoteJid || body.groupJid || '')
  const pushName = String(data.pushName || body.senderName || 'Grupo WhatsApp')
  const participant = String(key.participant || data.participant || body.senderPhone || '')

  const documentMessage = (message.documentMessage || message.documentWithCaptionMessage || {}) as Record<string, unknown>
  const extendedText = (message.extendedTextMessage || {}) as Record<string, unknown>

  const texto = String(
    message.conversation ||
    extendedText.text ||
    documentMessage.caption ||
    data.text ||
    body.texto ||
    body.text ||
    '',
  ).trim()

  const arquivosStl: string[] = []
  const fileName = String(documentMessage.fileName || data.fileName || body.fileName || '')
  const mediaUrl = String(documentMessage.url || data.mediaUrl || body.arquivoStlUrl || '')
  if (fileName.toLowerCase().endsWith('.stl') || mediaUrl.toLowerCase().endsWith('.stl')) {
    arquivosStl.push(mediaUrl || fileName)
  }
  if (Array.isArray(body.arquivosStl)) {
    for (const a of body.arquivosStl) {
      if (typeof a === 'string' && a.trim()) arquivosStl.push(a.trim())
    }
  }

  return {
    remoteJid,
    pushName,
    participant,
    texto,
    arquivosStl,
  }
}

export async function POST(request: Request) {
  try {
    const secretConfigurado = process.env.WHATSAPP_WEBHOOK_SECRET || process.env.CRON_SECRET
    if (secretConfigurado) {
      const tokenHeader = request.headers.get('x-webhook-secret') || request.headers.get('authorization')?.replace(/^Bearer\s+/i, '')
      const url = new URL(request.url)
      const tokenQuery = url.searchParams.get('secret')
      if (tokenHeader !== secretConfigurado && tokenQuery !== secretConfigurado) {
        return NextResponse.json({ ok: false, error: 'Não autorizado' }, { status: 401 })
      }
    }

    const body = (await request.json()) as Record<string, unknown>
    const extraido = extrairPayloadEvolution(body)

    const config = await carregarConfigWhatsappInterna()
    if (config.grupoOsJid && extraido.remoteJid && config.grupoOsJid !== extraido.remoteJid) {
      return NextResponse.json({ ok: true, ignored: true, reason: 'JID fora do grupo de OS configurado' })
    }

    const pareceOrdemOuStl =
      extraido.arquivosStl.length > 0 ||
      /(pac(?:iente)?|dentista|dr\.?|dra\.?|protocolo|ppr|coroa|zirc[oô]nia|pr[oó]tese|dente|cor\s+[a-d][1-4]|\.stl)/i.test(extraido.texto)

    if (!pareceOrdemOuStl) {
      return NextResponse.json({ ok: true, ignored: true, reason: 'Mensagem comum sem indicadores de OS ou arquivo .STL' })
    }

    const item = await processarMensagemGrupoWhatsappInterna({
      texto: extraido.texto,
      arquivosStl: extraido.arquivosStl,
      remetenteNome: extraido.pushName,
      remetenteTelefone: extraido.participant,
      grupoJid: extraido.remoteJid,
    })

    return NextResponse.json({ ok: true, item })
  } catch (error) {
    console.error('Erro no webhook de WhatsApp:', error)
    return NextResponse.json({ ok: false, error: 'Falha ao processar mensagem do grupo' }, { status: 500 })
  }
}
