export interface ConfigNotificacoesWhatsapp {
  novaOrdem: boolean
  atrasos: boolean
  estoqueBaixo: boolean
  ordemFinalizada: boolean
  resumoDiario: boolean
  saidaLabRecepcao: boolean
  chegadaRecepcaoDentista: boolean
  cobrancaProva24h: boolean
  problemaTecnico: boolean
  notificarSaidaLabParaRecepcao: boolean
  notificarChegadaRecepcaoParaDentista: boolean
  cobrarRetornoProvaSemDecisao: boolean
  notificarProblemaTecnico: boolean
  recepcaoTelefone: string
  labTelefone: string
  gestorTelefone: string
  grupoOsJid: string
}

export const CONFIG_WHATSAPP_PADRAO: ConfigNotificacoesWhatsapp = {
  novaOrdem: true,
  atrasos: true,
  estoqueBaixo: true,
  ordemFinalizada: true,
  resumoDiario: true,
  saidaLabRecepcao: true,
  chegadaRecepcaoDentista: true,
  cobrancaProva24h: true,
  problemaTecnico: true,
  notificarSaidaLabParaRecepcao: true,
  notificarChegadaRecepcaoParaDentista: true,
  cobrarRetornoProvaSemDecisao: true,
  notificarProblemaTecnico: true,
  recepcaoTelefone: process.env.RECEPCAO_WHATSAPP || '',
  labTelefone: process.env.LAB_WHATSAPP || '',
  gestorTelefone: process.env.GESTOR_WHATSAPP || '',
  grupoOsJid: process.env.WHATSAPP_GRUPO_OS_JID || '',
}

export function normalizarDestinoWhatsapp(phoneOrJid: string): string | null {
  const limpo = phoneOrJid.trim()
  if (!limpo) return null
  if (limpo.endsWith('@g.us') || limpo.endsWith('@s.whatsapp.net')) return limpo
  let digits = limpo.replace(/\D/g, '')
  if (!digits || digits.length < 10) return null
  if (digits.length <= 11 && !digits.startsWith('55')) {
    digits = `55${digits}`
  }
  return digits
}

export function montarUrlCheckinOrdem(tokenOuId: string | number): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || 'https://labgest-web.vercel.app').replace(/\/$/, '')
  return `${base}/check/${tokenOuId}`
}

export interface EventoNotificacaoTransicao {
  tipo: 'saida_lab_recepcao' | 'chegada_recepcao_dentista' | 'cobranca_decisao_prova' | 'resposta_prova_lab' | 'problema_tecnico' | 'estoque_baixo'
  ordemId?: number
  paciente?: string
  servico?: string
  dentista?: string
  finalidade?: 'prova' | 'entrega' | 'instalacao' | string
  etapa?: string
  etapaOuFinalidade?: string
  decisao?: 'aprovado' | 'ajustes' | string
  observacoes?: string | null
  motivo?: string
  motivoOuObservacao?: string
  tokenOuId?: string | number
  urlCheckin?: string
  nomeItem?: string
  insumoNome?: string
  quantidadeAtual?: number
  quantidadeMinima?: number
  unidade?: string
}

export type EventoTransicaoWhatsapp = EventoNotificacaoTransicao

export function formatarMensagemTransicaoWhatsapp(evento: EventoNotificacaoTransicao): string {
  const link = evento.urlCheckin || montarUrlCheckinOrdem(evento.tokenOuId ?? evento.ordemId ?? '')
  const etapaTexto = evento.etapa || evento.etapaOuFinalidade || 'Prova clínica'
  const motivoTexto = evento.motivo || evento.motivoOuObservacao || ''

  switch (evento.tipo) {
    case 'saida_lab_recepcao': {
      const acao = evento.finalidade === 'entrega' || evento.etapaOuFinalidade === 'entrega'
        ? 'Finalizada p/ entrega'
        : `Enviada p/ ${etapaTexto}`
      return [
        `📦 *Peça saindo do Laboratório -> Recepção*`,
        `Paciente: *${evento.paciente}* (OS #${evento.ordemId})`,
        `Trabalho: ${evento.servico} (${acao})`,
        `Dentista: ${evento.dentista}`,
        `👉 Confirme a chegada na recepção com 1 toque: ${link}`,
      ].join('\n')
    }
    case 'chegada_recepcao_dentista': {
      return [
        `🦷 *Peça disponível na Recepção — LabGest*`,
        `Olá Dr(a). *${evento.dentista}*, o trabalho do(a) paciente *${evento.paciente}* (${evento.servico} · ${etapaTexto}) já chegou na recepção.`,
        `👉 Para aprovar a prova ou solicitar ajustes em 10 segundos pelo celular: ${link}`,
      ].join('\n')
    }
    case 'cobranca_decisao_prova': {
      return [
        `⏳ *Lembrete de Prova Pendente — LabGest*`,
        `Olá Dr(a). *${evento.dentista}*, a peça de *${evento.paciente}* (${evento.servico}, OS #${evento.ordemId}) aguarda o resultado da prova para voltar à bancada.`,
        `👉 Toque abaixo para *Aprovar* ou *Pedir Ajustes*: ${link}`,
      ].join('\n')
    }
    case 'resposta_prova_lab': {
      const obs = evento.observacoes || motivoTexto
      const selo = evento.decisao === 'aprovado' || obs.includes('APROVADA') ? '✅ APROVADA' : '🛠️ AJUSTES SOLICITADOS'
      return [
        `${selo} *Retorno de Prova Registrado*`,
        `Paciente: *${evento.paciente}* (OS #${evento.ordemId})`,
        `Dentista: ${evento.dentista}`,
        obs ? `Observação: "${obs}"` : null,
        `👉 Confirmar entrada no laboratório (+10 dias de prazo): ${link}`,
      ].filter(Boolean).join('\n')
    }
    case 'problema_tecnico': {
      return [
        `⚠️ *Alerta Técnico da Bancada — OS #${evento.ordemId}*`,
        `Paciente: *${evento.paciente}* (${evento.servico})`,
        `Dentista: ${evento.dentista}`,
        `Ocorrência: *${motivoTexto}*`,
        `Verifique na recepção/Clinicorp se é necessário reagendar o paciente. Detalhes: ${link}`,
      ].join('\n')
    }
    case 'estoque_baixo': {
      return [
        `📉 *Alerta de Reposição de Estoque — LabGest*`,
        `Insumo: *${evento.nomeItem || evento.insumoNome}*`,
        `Saldo atual: *${evento.quantidadeAtual} ${evento.unidade}* (Mínimo: ${evento.quantidadeMinima} ${evento.unidade})`,
        `Providencie a compra para evitar parada na bancada.`,
      ].join('\n')
    }
  }
}

export async function sendWhatsAppMessage(phone: string, message: string) {
  const apiUrl = process.env.EVOLUTION_API_URL
  const apiKey = process.env.EVOLUTION_API_KEY
  const instance = process.env.EVOLUTION_INSTANCE

  const number = normalizarDestinoWhatsapp(phone)
  if (!number) {
    return { ok: false, success: false, error: 'Número de destino inválido' }
  }

  if (!apiUrl || !apiKey || !instance) {
    console.warn('Evolution API não configurada')
    return { ok: false, success: false, error: 'API não configurada' }
  }

  try {
    const response = await fetch(`${apiUrl}/message/sendText/${instance}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': apiKey,
      },
      body: JSON.stringify({
        number,
        text: message,
        options: {
          delay: 1200,
          presence: 'composing',
          linkPreview: false,
        },
        textMessage: {
          text: message,
        },
      }),
      signal: AbortSignal.timeout(8_000),
    })

    const data = await response.json()

    if (response.ok) {
      return { ok: true, success: true, data }
    } else {
      console.error('Erro Evolution API:', data)
      return { ok: false, success: false, error: 'Falha ao enviar mensagem' }
    }
  } catch (error) {
    console.error('Erro ao conectar com Evolution API:', error)
    return { ok: false, success: false, error: 'Erro de conexão' }
  }
}

export async function enviarWhatsapp(phone: string, message: string) {
  return sendWhatsAppMessage(phone, message)
}


