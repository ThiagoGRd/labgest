'use server'

import { prisma } from '@labgest/database'
import type { Prisma } from '@prisma/client'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'
import { addDaysSkippingSundays } from '@/lib/date-utils'
import { PRAZO_RETORNO_LAB_DIAS } from '@/lib/producao-utils'
import { getFluxoProtese, isTipoProtese, calcularPrazoPasso } from '@/lib/workflow-config'
import {
  CONFIG_WHATSAPP_PADRAO,
  enviarWhatsapp,
  formatarMensagemTransicaoWhatsapp,
  montarUrlCheckinOrdem,
  normalizarDestinoWhatsapp,
  type ConfigNotificacoesWhatsapp,
  type EventoNotificacaoTransicao,
} from '@/lib/whatsapp'

const TIPO_CONFIG_WHATSAPP = 'config_whatsapp'

function revalidarFluxoGlobal() {
  revalidatePath('/lab-interno')
  revalidatePath('/producao')
  revalidatePath('/ordens')
  revalidatePath('/recepcao')
  revalidatePath('/prioridades')
}

export async function carregarConfigWhatsappInterna(): Promise<ConfigNotificacoesWhatsapp> {
  try {
    if (typeof prisma.notificacao?.findFirst !== 'function') {
      return { ...CONFIG_WHATSAPP_PADRAO }
    }
    const registro = await prisma.notificacao.findFirst({
      where: { tipo: TIPO_CONFIG_WHATSAPP },
      orderBy: { id: 'desc' },
    })
    if (!registro?.mensagem) return { ...CONFIG_WHATSAPP_PADRAO }
    const parsed = JSON.parse(registro.mensagem) as Partial<ConfigNotificacoesWhatsapp>
    return {
      ...CONFIG_WHATSAPP_PADRAO,
      ...parsed,
    }
  } catch {
    return { ...CONFIG_WHATSAPP_PADRAO }
  }
}

export async function getNotificacoesConfig(): Promise<ConfigNotificacoesWhatsapp> {
  await requireUser()
  return carregarConfigWhatsappInterna()
}

export async function saveNotificacoesConfig(config: Partial<ConfigNotificacoesWhatsapp>) {
  await requireUser()
  const atual = await carregarConfigWhatsappInterna()
  const mesclado: ConfigNotificacoesWhatsapp = {
    ...atual,
    ...config,
    recepcaoTelefone: String(config.recepcaoTelefone ?? atual.recepcaoTelefone ?? '').trim(),
    labTelefone: String(config.labTelefone ?? atual.labTelefone ?? '').trim(),
    gestorTelefone: String(config.gestorTelefone ?? atual.gestorTelefone ?? '').trim(),
    grupoOsJid: String(config.grupoOsJid ?? atual.grupoOsJid ?? '').trim(),
  }

  try {
    if (typeof prisma.notificacao?.findFirst === 'function') {
      const existente = await prisma.notificacao.findFirst({
        where: { tipo: TIPO_CONFIG_WHATSAPP },
        orderBy: { id: 'desc' },
      })
      if (existente && typeof prisma.notificacao?.update === 'function') {
        await prisma.notificacao.update({
          where: { id: existente.id },
          data: {
            titulo: 'Configuração de Automação WhatsApp',
            mensagem: JSON.stringify(mesclado),
          },
        })
      } else if (typeof prisma.notificacao?.create === 'function') {
        await prisma.notificacao.create({
          data: {
            tipo: TIPO_CONFIG_WHATSAPP,
            titulo: 'Configuração de Automação WhatsApp',
            mensagem: JSON.stringify(mesclado),
            data: new Date(),
            lida: true,
          },
        })
      }
    }
  } catch (error) {
    console.error('Erro ao salvar configurações de WhatsApp:', error)
    return { success: false, error: 'Não foi possível salvar as preferências de notificações.' }
  }

  revalidatePath('/configuracoes')
  return { success: true, config: mesclado }
}

export async function notificarTransicaoOrdemWhatsapp(params: {
  ordemId: number
  tipo: EventoNotificacaoTransicao['tipo']
  etapaOuFinalidade?: string
  motivoOuObservacao?: string
}) {
  try {
    if (typeof prisma.ordem?.findUnique !== 'function') {
      return { success: false, skipped: true }
    }
    const [config, ordem] = await Promise.all([
      carregarConfigWhatsappInterna(),
      prisma.ordem.findUnique({
        where: { id: params.ordemId },
        include: { cliente: true },
      }),
    ])

    if (!ordem) return { success: false, error: 'Ordem não encontrada.' }

    const urlCheckin = montarUrlCheckinOrdem(ordem.tokenRastreamento || ordem.id)
    const dentistaNome = ordem.dentistaResponsavel || ordem.cliente?.dentista || ordem.cliente?.nome || ordem.clienteNome
    const mensagem = formatarMensagemTransicaoWhatsapp({
      tipo: params.tipo,
      ordemId: ordem.id,
      paciente: ordem.nomePaciente,
      dentista: dentistaNome,
      servico: ordem.servicoNome,
      etapaOuFinalidade: params.etapaOuFinalidade || ordem.subetapaAtual || ordem.etapaAtual || undefined,
      motivoOuObservacao: params.motivoOuObservacao,
      urlCheckin,
    })

    const destinos: string[] = []
    if (params.tipo === 'saida_lab_recepcao' && config.notificarSaidaLabParaRecepcao && config.recepcaoTelefone) {
      destinos.push(config.recepcaoTelefone)
    }
    if (params.tipo === 'chegada_recepcao_dentista' && config.notificarChegadaRecepcaoParaDentista) {
      if (ordem.cliente?.telefone) destinos.push(ordem.cliente.telefone)
      if (config.recepcaoTelefone) destinos.push(config.recepcaoTelefone)
    }
    if (params.tipo === 'cobranca_decisao_prova' && config.cobrarRetornoProvaSemDecisao) {
      if (ordem.cliente?.telefone) destinos.push(ordem.cliente.telefone)
      if (config.recepcaoTelefone) destinos.push(config.recepcaoTelefone)
    }
    if (params.tipo === 'resposta_prova_lab') {
      if (config.labTelefone) destinos.push(config.labTelefone)
      if (config.recepcaoTelefone) destinos.push(config.recepcaoTelefone)
    }
    if (params.tipo === 'problema_tecnico' && config.notificarProblemaTecnico) {
      if (ordem.cliente?.telefone) destinos.push(ordem.cliente.telefone)
      if (config.recepcaoTelefone) destinos.push(config.recepcaoTelefone)
      if (config.gestorTelefone) destinos.push(config.gestorTelefone)
    }

    const destinosUnicos = [...new Set(destinos.map((d) => normalizarDestinoWhatsapp(d)).filter((d): d is string => Boolean(d)))]
    let enviados = 0
    for (const destino of destinosUnicos) {
      const res = await enviarWhatsapp(destino, mensagem)
      if (res.ok) enviados += 1
    }

    const telefoneLink = normalizarDestinoWhatsapp(ordem.cliente?.telefone || config.recepcaoTelefone || '')
    const whatsappLink = telefoneLink && !telefoneLink.includes('@g.us')
      ? `https://wa.me/${telefoneLink}?text=${encodeURIComponent(mensagem)}`
      : null

    return { success: true, enviados, mensagem, whatsappLink, urlCheckin }
  } catch (error) {
    console.error('Erro ao notificar transição via WhatsApp:', error)
    return { success: false, error: 'Falha ao disparar notificação WhatsApp.' }
  }
}

export async function reportarProblemaTecnicoOrdem(ordemId: number, motivo: string) {
  const usuario = await requireUser()
  const textoMotivo = motivo.trim()
  if (!textoMotivo) {
    return { success: false, error: 'Descreva o problema técnico encontrado na peça ou moldagem.' }
  }

  const ordem = await prisma.ordem.findUnique({
    where: { id: ordemId },
    include: { cliente: true },
  })
  if (!ordem) {
    return { success: false, error: 'Ordem não encontrada.' }
  }

  const agora = new Date()
  const historico = Array.isArray(ordem.historicoEtapas)
    ? [...(ordem.historicoEtapas as Prisma.InputJsonObject[])]
    : []
  historico.push({
    etapa: ordem.subetapaAtual || ordem.etapaAtual || 'laboratorio',
    acao: 'problema_tecnico',
    motivo: textoMotivo,
    data: agora.toISOString(),
    por: usuario.email,
    responsavel: usuario.nome,
  })

  const mensagens = Array.isArray(ordem.mensagens)
    ? [...(ordem.mensagens as Prisma.InputJsonObject[])]
    : []
  mensagens.push({
    id: `${Date.now()}`,
    role: 'lab',
    nome: usuario.nome || 'Laboratório',
    texto: `⚠️ Problema técnico reportado na OS #${ordem.id}: ${textoMotivo}`,
    createdAt: agora.toISOString(),
  })

  await prisma.ordem.update({
    where: { id: ordemId },
    data: {
      historicoEtapas: historico,
      mensagens,
    },
  })

  const notificacao = await notificarTransicaoOrdemWhatsapp({
    ordemId,
    tipo: 'problema_tecnico',
    motivoOuObservacao: textoMotivo,
  })

  revalidarFluxoGlobal()
  return {
    success: true,
    enviados: notificacao.enviados || 0,
    whatsappLink: notificacao.whatsappLink || null,
  }
}

export async function executarCheckinRapidoOrdem(
  tokenOuId: string,
  acao: 'receber_recepcao' | 'entregar_dentista' | 'aprovar_prova' | 'pedir_ajuste' | 'confirmar_entrada_lab',
  observacao?: string,
) {
  try {
    const limpo = tokenOuId.trim()
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(limpo)
    const idNumerico = /^\d+$/.test(limpo) ? Number(limpo) : null

    const ordem = isUuid
      ? await prisma.ordem.findUnique({
          where: { tokenRastreamento: limpo },
          include: { ciclos: { where: { status: 'em_prova' }, orderBy: { numeroCiclo: 'desc' }, take: 1 } },
        })
      : idNumerico
        ? await prisma.ordem.findUnique({
            where: { id: idNumerico },
            include: { ciclos: { where: { status: 'em_prova' }, orderBy: { numeroCiclo: 'desc' }, take: 1 } },
          })
        : null

    if (!ordem) {
      return { success: false, error: 'Ordem não encontrada para este código.' }
    }
    if (['Entregue', 'Cancelado'].includes(ordem.status || '')) {
      return { success: false, error: 'Esta ordem já está encerrada.' }
    }

    const agora = new Date()
    const historico = Array.isArray(ordem.historicoEtapas)
      ? [...(ordem.historicoEtapas as Prisma.InputJsonObject[])]
      : []

    if (acao === 'receber_recepcao') {
      historico.push({
        acao: 'recebeu_recepcao',
        local: 'Recepção (QR Check-in)',
        data: agora.toISOString(),
        responsavel: 'Check-in Rápido QR',
      })
      await prisma.ordem.update({
        where: { id: ordem.id },
        data: {
          localizacaoAtual: 'recepcao',
          situacaoLogistica: 'aguardando_distribuicao',
          movimentacaoLogisticaEm: agora,
          historicoEtapas: historico,
        },
      })
      await notificarTransicaoOrdemWhatsapp({
        ordemId: ordem.id,
        tipo: 'chegada_recepcao_dentista',
      })
      revalidarFluxoGlobal()
      revalidatePath(`/check/${tokenOuId}`)
      return { success: true, mensagem: 'Chegada na recepção confirmada e dentista avisado!' }
    }

    if (acao === 'entregar_dentista') {
      historico.push({
        acao: 'entregou_dentista',
        dentista: ordem.dentistaResponsavel || ordem.clienteNome,
        finalidade: ordem.finalidadeClinica || (ordem.status === 'Finalizado' ? 'entrega' : 'prova'),
        data: agora.toISOString(),
        responsavel: 'Check-in Rápido QR',
      })
      await prisma.ordem.update({
        where: { id: ordem.id },
        data: {
          localizacaoAtual: 'dentista',
          situacaoLogistica: 'com_dentista',
          movimentacaoLogisticaEm: agora,
          historicoEtapas: historico,
        },
      })
      revalidarFluxoGlobal()
      revalidatePath(`/check/${tokenOuId}`)
      return { success: true, mensagem: 'Entrega ao dentista registrada!' }
    }

    if (acao === 'aprovar_prova' || acao === 'pedir_ajuste') {
      const decisao = acao === 'aprovar_prova' ? 'aprovado' : 'ajustar'
      const obsTexto = observacao?.trim() || (decisao === 'aprovado' ? 'Prova aprovada via QR Check-in' : 'Ajuste solicitado via QR Check-in')
      const cicloAtivo = ordem.ciclos[0]

      if (cicloAtivo) {
        await prisma.cicloProducao.update({
          where: { id: cicloAtivo.id },
          data: {
            decisao,
            observacoesDentista: obsTexto,
          },
        })
      }

      historico.push({
        acao: decisao === 'aprovado' ? 'aprovou_prova_qr' : 'solicitou_ajuste_qr',
        observacao: obsTexto,
        data: agora.toISOString(),
        responsavel: ordem.dentistaResponsavel || ordem.clienteNome,
      })

      await prisma.ordem.update({
        where: { id: ordem.id },
        data: {
          situacaoLogistica: 'aguardando_envio_laboratorio',
          movimentacaoLogisticaEm: agora,
          historicoEtapas: historico,
        },
      })

      await notificarTransicaoOrdemWhatsapp({
        ordemId: ordem.id,
        tipo: 'resposta_prova_lab',
        motivoOuObservacao: `${decisao === 'aprovado' ? 'Prova APROVADA' : 'AJUSTE solicitado'}: ${obsTexto}`,
      })

      revalidarFluxoGlobal()
      revalidatePath(`/check/${tokenOuId}`)
      return {
        success: true,
        mensagem: decisao === 'aprovado'
          ? 'Prova aprovada! Laboratório avisado para finalizar.'
          : 'Solicitação de ajuste registrada! Laboratório avisado.',
      }
    }

    if (acao === 'confirmar_entrada_lab') {
      const novaDataComprometida = addDaysSkippingSundays(PRAZO_RETORNO_LAB_DIAS, agora)
      const cicloAtivo = ordem.ciclos[0]
      if (cicloAtivo) {
        await prisma.cicloProducao.update({
          where: { id: cicloAtivo.id },
          data: {
            status: 'retornou_lab',
            dataRetorno: agora,
            dataComprometida: novaDataComprometida,
          },
        })
      }

      let proximoPassoId = ordem.passoFluxoAtual
      let proximaEtapa = ordem.etapaAtual || 'execucao'
      let proximaSubetapa = ordem.subetapaAtual
      let novoPrazoEtapa: Date | null = novaDataComprometida

      if (isTipoProtese(ordem.tipoWorkflow)) {
        const fluxo = getFluxoProtese(ordem.tipoWorkflow)
        const idxAtual = fluxo.passos.findIndex((p) => p.id === ordem.passoFluxoAtual)
        const proximoPassoLab = fluxo.passos.slice(Math.max(0, idxAtual)).find((p) => p.responsavel === 'laboratorio')
        if (proximoPassoLab) {
          proximoPassoId = proximoPassoLab.id
          proximaEtapa = proximoPassoLab.macroetapa
          proximaSubetapa = proximoPassoLab.nome
          const prazoPasso = calcularPrazoPasso(agora, proximoPassoLab, ordem.arcadas || 1)
          novoPrazoEtapa = prazoPasso && prazoPasso > novaDataComprometida ? prazoPasso : novaDataComprometida
        }
      }

      historico.push({
        acao: 'recebeu_laboratorio',
        local: 'Laboratório (QR Check-in)',
        prazoCicloDias: PRAZO_RETORNO_LAB_DIAS,
        novoPrazoComprometido: novaDataComprometida.toISOString(),
        data: agora.toISOString(),
        responsavel: 'Bancada / Lab',
      })

      await prisma.ordem.update({
        where: { id: ordem.id },
        data: {
          status: 'Em Produção',
          localizacaoAtual: 'laboratorio',
          situacaoLogistica: 'no_laboratorio',
          movimentacaoLogisticaEm: agora,
          agendamentoConfirmado: false,
          passoFluxoAtual: proximoPassoId,
          etapaAtual: proximaEtapa,
          subetapaAtual: proximaSubetapa,
          prazoEtapaAtual: novoPrazoEtapa,
          historicoEtapas: historico,
        },
      })

      revalidarFluxoGlobal()
      revalidatePath(`/check/${tokenOuId}`)
      return {
        success: true,
        mensagem: `Entrada no laboratório confirmada! Novo prazo de ${PRAZO_RETORNO_LAB_DIAS} dias úteis iniciado.`,
      }
    }

    return { success: false, error: 'Ação inválida.' }
  } catch (error) {
    console.error('Erro no check-in rápido:', error)
    return { success: false, error: 'Não foi possível registrar o check-in.' }
  }
}

export async function dispararResumoMatinalWhatsapp() {
  await requireUser()
  const config = await carregarConfigWhatsappInterna()
  const hoje = new Date().toISOString().slice(0, 10)
  const amanhaDate = new Date()
  amanhaDate.setDate(amanhaDate.getDate() + 1)
  const amanha = amanhaDate.toISOString().slice(0, 10)

  const ordensAtivas = await prisma.ordem.findMany({
    where: { status: { notIn: ['Finalizado', 'Entregue', 'Cancelado'] } },
    select: {
      id: true,
      nomePaciente: true,
      clienteNome: true,
      servicoNome: true,
      dataEntrega: true,
      localizacaoAtual: true,
    },
    orderBy: { dataEntrega: 'asc' },
    take: 100,
  })

  const vencidas = ordensAtivas.filter((o) => o.dataEntrega.toISOString().slice(0, 10) < hoje)
  const vencemHojeOuAmanha = ordensAtivas.filter((o) => {
    const iso = o.dataEntrega.toISOString().slice(0, 10)
    return iso === hoje || iso === amanha
  })

  const linhas = [
    `☀️ *LabGest — Resumo Matinal (${hoje.split('-').reverse().join('/')})*`,
    `• Ordens em andamento: *${ordensAtivas.length}*`,
    `• Vencidas no total: *${vencidas.length}*`,
    `• Entregas para hoje/amanhã: *${vencemHojeOuAmanha.length}*`,
  ]

  if (vencidas.length > 0) {
    linhas.push('', '🚨 *Top Prioridades (Mais tempo vencidas):*')
    for (const o of vencidas.slice(0, 5)) {
      const dias = Math.max(1, Math.round((new Date(`${hoje}T12:00:00Z`).getTime() - new Date(`${o.dataEntrega.toISOString().slice(0, 10)}T12:00:00Z`).getTime()) / 86400000))
      linhas.push(`- OS #${o.id} • ${o.nomePaciente} (${o.servicoNome}) — *${dias}d vencida*`)
    }
  }

  const mensagem = linhas.join('\n')
  const destinos = [config.recepcaoTelefone, config.labTelefone, config.gestorTelefone]
    .map((d) => normalizarDestinoWhatsapp(d || ''))
    .filter((d): d is string => Boolean(d))

  let enviados = 0
  for (const destino of [...new Set(destinos)]) {
    const r = await enviarWhatsapp(destino, mensagem)
    if (r.ok) enviados += 1
  }

  return { success: true, enviados, mensagem }
}

export async function gerarNotificacaoWhatsApp(ordemId: number) {
  await requireUser()
  try {
    const ordem = await prisma.ordem.findUnique({
      where: { id: ordemId },
      include: { cliente: true }
    })

    if (!ordem || !ordem.cliente || !ordem.cliente.telefone) {
      return { success: false, error: 'Cliente sem telefone cadastrado ou ordem não encontrada.' }
    }

    // Limpar telefone (apenas números)
    const telefone = ordem.cliente.telefone.replace(/\D/g, '')
    const telefoneWhatsapp = telefone.startsWith('55') ? telefone : `55${telefone}`
    if (telefoneWhatsapp.length < 12 || telefoneWhatsapp.length > 13) {
      return { success: false, error: 'Telefone do cliente inválido para WhatsApp.' }
    }
    
    const urlCheckin = montarUrlCheckinOrdem(ordem.tokenRastreamento || ordem.id)
    const statusAtual = ordem.status || 'Aguardando'
    let mensagem = ''
    if (statusAtual === 'Finalizado') {
      mensagem = `Olá Dr(a). ${ordem.cliente.nome}, tudo bem? \nO trabalho do paciente *${ordem.nomePaciente}* (${ordem.servicoNome}) foi finalizado e está pronto para combinar a entrega.\nAcompanhe / confirme em 1 toque: ${urlCheckin}`
    } else if (statusAtual === 'Entregue') {
      mensagem = `Olá Dr(a). ${ordem.cliente.nome}, o trabalho do paciente *${ordem.nomePaciente}* (${ordem.servicoNome}) foi registrado como entregue.`
    } else {
      mensagem = `Olá Dr(a). ${ordem.cliente.nome}, o status atual do pedido *${ordem.nomePaciente}* é: *${statusAtual}*.\nRastreio / Check-in: ${urlCheckin}`
    }

    const encodedMsg = encodeURIComponent(mensagem)
    const whatsappLink = `https://wa.me/${telefoneWhatsapp}?text=${encodedMsg}`

    return { success: true, whatsappLink }
  } catch (error) {
    console.error('Erro ao gerar notificação:', error)
    return { success: false, error: 'Erro interno ao processar notificação.' }
  }
}

