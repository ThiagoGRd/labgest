'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireUser } from '@/lib/auth-utils'
import { addDaysSkippingSundays } from '@/lib/date-utils'
import { PRAZO_RETORNO_LAB_DIAS } from '@/lib/producao-utils'
import {
  calcularPrazoPasso,
  getPrimeiroPassoLaboratorial,
  getWorkflowForServico,
  inferirTipoProtese,
  isTipoProtese,
} from '@/lib/workflow-config'
import {
  conciliarPacienteClinicorp,
  extrairDadosMensagemGrupoOs,
  type CandidatoClinicorp,
  type ItemTriagemWhatsappOs,
} from '@/lib/triagem-whatsapp-os'

const TIPO_TRIAGEM_OS = 'triagem_os'

async function carregarCandidatosClinicorpEOrdens(): Promise<CandidatoClinicorp[]> {
  const candidatos: CandidatoClinicorp[] = []
  try {
    if (typeof prisma.clinicorpConsulta?.findMany === 'function') {
      const consultas = await prisma.clinicorpConsulta.findMany({
        orderBy: { data: 'desc' },
        take: 300,
      })
      for (const c of consultas) {
        if (!c.pacienteNome?.trim()) continue
        candidatos.push({
          nome: c.pacienteNome.trim(),
          cpf: null,
          dentista: c.dentistaNome || null,
          dataConsultaIso: c.data.toISOString().slice(0, 10),
          origem: 'clinicorp',
        })
      }
    }
  } catch {
    // Continua com ordens existentes caso espelho Clinicorp não esteja disponível
  }

  try {
    if (typeof prisma.ordem?.findMany === 'function') {
      const ordens = await prisma.ordem.findMany({
        select: {
          nomePaciente: true,
          cpfPaciente: true,
          clienteNome: true,
          dentistaResponsavel: true,
        },
        orderBy: { id: 'desc' },
        take: 300,
      })
      for (const o of ordens) {
        if (!o.nomePaciente?.trim()) continue
        candidatos.push({
          nome: o.nomePaciente.trim(),
          cpf: o.cpfPaciente || null,
          dentista: o.dentistaResponsavel || o.clienteNome || null,
          dataConsultaIso: null,
          origem: 'ordem_existente',
        })
      }
    }
  } catch {
    // Ignora falha de leitura secundária
  }

  return candidatos
}

export async function processarMensagemGrupoWhatsappInterna(payload: {
  texto: string
  arquivosStl?: string[]
  remetenteNome?: string
  remetenteTelefone?: string
  grupoJid?: string
}): Promise<ItemTriagemWhatsappOs | null> {
  const arquivos = (payload.arquivosStl || []).filter(Boolean)
  const texto = (payload.texto || '').trim()
  if (!texto && arquivos.length === 0) return null

  const extraido = extrairDadosMensagemGrupoOs(texto, arquivos[0])
  const candidatos = await carregarCandidatosClinicorpEOrdens()
  const conciliacao = conciliarPacienteClinicorp(
    extraido.pacienteExtraido,
    candidatos,
    extraido.dentistaExtraido,
  )

  const match = conciliacao.melhorMatch
  const agoraIso = new Date().toISOString()

  const dadosItem: Omit<ItemTriagemWhatsappOs, 'id'> = {
    criadoEm: agoraIso,
    remetenteNome: payload.remetenteNome || 'Grupo WhatsApp Lab',
    remetenteTelefone: payload.remetenteTelefone || '',
    grupoJid: payload.grupoJid || '',
    textoOriginal: texto,
    arquivosStl: arquivos,
    pacienteExtraido: extraido.pacienteExtraido,
    pacienteSugerido: match ? match.nome : extraido.pacienteExtraido,
    cpfSugerido: match?.cpf || '',
    scoreConciliacao: match ? match.score : 0,
    origemConciliacao: match ? match.origem : 'manual',
    motivoConciliacao: match
      ? `${conciliacao.corrigidoAutomaticamente ? 'Nome corrigido pelo Clinicorp · ' : ''}${match.motivoMatch}`
      : 'Sem correspondência exata na agenda — confira o nome',
    dentistaSugerido: extraido.dentistaExtraido || match?.dentista || '',
    servicoSugerido: extraido.servicoExtraido,
    corSugerida: extraido.corExtraida,
    elementosSugeridos: extraido.elementosExtraidos,
    tipoProtese: extraido.tipoProteseInferido,
    status: 'pendente',
    ordemGeradaId: null,
  }

  if (typeof prisma.notificacao?.create === 'function') {
    const salvo = await prisma.notificacao.create({
      data: {
        tipo: TIPO_TRIAGEM_OS,
        titulo: `Pré-OS WhatsApp: ${dadosItem.pacienteSugerido}`,
        mensagem: JSON.stringify(dadosItem),
        data: new Date(),
        lida: false,
      },
    })
    return { id: salvo.id, ...dadosItem }
  }

  return { id: Date.now(), ...dadosItem }
}

export async function listarTriagemWhatsappOs(): Promise<ItemTriagemWhatsappOs[]> {
  try {
    await requireUser()
    if (typeof prisma.notificacao?.findMany !== 'function') return []
    const registros = await prisma.notificacao.findMany({
      where: { tipo: TIPO_TRIAGEM_OS, lida: false },
      orderBy: { id: 'desc' },
      take: 25,
    })

    const itens: ItemTriagemWhatsappOs[] = []
    for (const reg of registros) {
      try {
        const parsed = JSON.parse(reg.mensagem) as Omit<ItemTriagemWhatsappOs, 'id'>
        if (parsed.status === 'pendente') {
          itens.push({ id: reg.id, ...parsed })
        }
      } catch {
        // Ignora registros malformados
      }
    }
    return itens
  } catch {
    return []
  }
}

export async function registrarMensagemGrupoWhatsappManual(input: {
  texto: string
  arquivoStlUrl?: string
  remetenteNome?: string
}) {
  await requireUser()
  const arquivos = input.arquivoStlUrl?.trim() ? [input.arquivoStlUrl.trim()] : []
  const item = await processarMensagemGrupoWhatsappInterna({
    texto: input.texto,
    arquivosStl: arquivos,
    remetenteNome: input.remetenteNome || 'Grupo WhatsApp (OS + STL)',
  })

  if (!item) {
    return { success: false, error: 'Informe o texto da mensagem ou o arquivo .STL enviado no grupo.' }
  }

  revalidatePath('/lab-interno')
  revalidatePath('/ordens')
  return { success: true, item }
}

export async function aprovarTriagemGerarOrdem(
  triagemId: number,
  overrides?: {
    paciente?: string
    dentista?: string
    servico?: string
    corDentes?: string
    elementos?: string
  },
) {
  const usuario = await requireUser()
  try {
    const reg = await prisma.notificacao.findUnique({ where: { id: triagemId } })
    if (!reg || reg.tipo !== TIPO_TRIAGEM_OS) {
      return { success: false, error: 'Item de triagem não encontrado.' }
    }

    const item = JSON.parse(reg.mensagem) as Omit<ItemTriagemWhatsappOs, 'id'>
    const nomePaciente = (overrides?.paciente ?? item.pacienteSugerido ?? item.pacienteExtraido).trim()
    const nomeDentista = (overrides?.dentista ?? item.dentistaSugerido).trim()
    const nomeServico = (overrides?.servico ?? item.servicoSugerido).trim()
    const corDentes = (overrides?.corDentes ?? item.corSugerida ?? '').trim()
    const elementos = (overrides?.elementos ?? item.elementosSugeridos ?? '').trim()

    if (!nomePaciente) {
      return { success: false, error: 'Informe o nome do paciente para gerar a OS.' }
    }

    // Localiza dentista/clínica correspondente ou usa o primeiro ativo
    const clientesAtivos = await prisma.cliente.findMany({
      where: { ativo: true },
      orderBy: { id: 'asc' },
    })
    if (clientesAtivos.length === 0) {
      return { success: false, error: 'Cadastre pelo menos uma clínica/dentista ativo antes de aprovar a Pré-OS.' }
    }

    const clienteMatch = nomeDentista
      ? clientesAtivos.find(
          (c) =>
            c.nome.toLowerCase().includes(nomeDentista.toLowerCase()) ||
            (c.dentista && c.dentista.toLowerCase().includes(nomeDentista.toLowerCase())),
        ) || clientesAtivos[0]
      : clientesAtivos[0]

    // Localiza serviço correspondente ou usa o primeiro ativo
    const servicosAtivos = await prisma.servico.findMany({
      where: { ativo: true },
      orderBy: { id: 'asc' },
    })
    if (servicosAtivos.length === 0) {
      return { success: false, error: 'Cadastre pelo menos um serviço ativo antes de aprovar a Pré-OS.' }
    }

    const servicoMatch = nomeServico
      ? servicosAtivos.find((s) => s.nome.toLowerCase().includes(nomeServico.toLowerCase())) || servicosAtivos[0]
      : servicosAtivos[0]

    const tipoProtese = isTipoProtese(item.tipoProtese)
      ? item.tipoProtese
      : isTipoProtese(servicoMatch.tipoWorkflow)
        ? servicoMatch.tipoWorkflow
        : inferirTipoProtese(`${nomeServico} ${servicoMatch.nome}`)

    const primeiroPasso = tipoProtese ? getPrimeiroPassoLaboratorial(tipoProtese) : null
    const tipoWorkflow = tipoProtese || getWorkflowForServico(servicoMatch.nome)
    const primeiraEtapa = primeiroPasso?.macroetapa || 'execucao'
    const agora = new Date()
    const dataEntrega = addDaysSkippingSundays(servicoMatch.tempoProducao || PRAZO_RETORNO_LAB_DIAS, agora)
    const valor = Number(servicoMatch.preco)

    const novaOrdem = await prisma.ordem.create({
      data: {
        clienteId: clienteMatch.id,
        clienteNome: clienteMatch.nome,
        dentistaResponsavel: nomeDentista || clienteMatch.dentista || clienteMatch.nome,
        servicoId: servicoMatch.id,
        servicoNome: servicoMatch.nome,
        nomePaciente,
        cpfPaciente: item.cpfSugerido || null,
        dataEntrega,
        valor,
        valorFinal: valor,
        prioridade: 'Normal',
        corDentes,
        elementos,
        observacoes: item.textoOriginal
          ? `[Grupo WhatsApp] ${item.textoOriginal}`
          : 'Gerada automaticamente via Triagem WhatsApp + Clinicorp',
        status: 'Em Produção',
        localizacaoAtual: 'laboratorio',
        situacaoLogistica: 'no_laboratorio',
        etapaAtual: primeiraEtapa,
        subetapaAtual: primeiroPasso?.nome || 'Na bancada',
        tipoWorkflow,
        passoFluxoAtual: primeiroPasso?.id || null,
        arcadas: 1,
        prazoEtapaAtual: primeiroPasso ? calcularPrazoPasso(agora, primeiroPasso, 1) : dataEntrega,
        tentativaAtual: 0,
        arquivoStl: item.arquivosStl || [],
        historicoEtapas: [
          {
            etapa: primeiraEtapa,
            acao: 'criou',
            origem: 'triagem_whatsapp_clinicorp',
            pacienteOriginalGrupo: item.pacienteExtraido,
            scoreConciliacao: item.scoreConciliacao,
            data: agora.toISOString(),
            por: usuario.email,
          },
        ],
        checklistEstetico: {},
      },
    })

    await prisma.notificacao.update({
      where: { id: triagemId },
      data: {
        lida: true,
        mensagem: JSON.stringify({
          ...item,
          status: 'aprovada',
          ordemGeradaId: novaOrdem.id,
        }),
      },
    })

    revalidatePath('/lab-interno')
    revalidatePath('/ordens')
    revalidatePath('/producao')
    revalidatePath('/recepcao')
    return { success: true, ordemId: novaOrdem.id, paciente: nomePaciente }
  } catch (error) {
    console.error('Erro ao aprovar triagem WhatsApp:', error)
    return { success: false, error: 'Não foi possível gerar a OS a partir da triagem.' }
  }
}

export async function descartarTriagemWhatsapp(triagemId: number) {
  await requireUser()
  try {
    const reg = await prisma.notificacao.findUnique({ where: { id: triagemId } })
    if (!reg) return { success: false, error: 'Item não encontrado.' }
    const item = JSON.parse(reg.mensagem) as Record<string, unknown>
    await prisma.notificacao.update({
      where: { id: triagemId },
      data: {
        lida: true,
        mensagem: JSON.stringify({ ...item, status: 'descartada' }),
      },
    })
    revalidatePath('/lab-interno')
    revalidatePath('/ordens')
    return { success: true }
  } catch {
    return { success: false, error: 'Não foi possível descartar o item.' }
  }
}
