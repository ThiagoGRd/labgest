// Controle de tratamentos: junta as ordens de prótese do LabGest com a agenda do
// Clinicorp para mostrar ao gestor quantas consultas e quanto tempo cada prótese
// está consumindo, e com quem o trabalho ficou. Somente servidor.

import { prisma } from '@labgest/database'
import type { Prisma } from '@prisma/client'
import {
  TIPOS_CONTROLADOS,
  alertasDevidos,
  analisarConsultas,
  avaliarTratamento,
  consultasPrevistas,
  detectarRiscosOperacionais,
  diasEntre,
  dividirTempo,
  getFluxoProtese,
  getPassoProtese,
  inferirTipoProtese,
  isTipoProtese,
  limitePadrao,
  nomesParecidos,
  normalizarNome,
  somarDias,
  MARGEM_INICIO_DIAS,
  type AvaliacaoTratamento,
  type ConsultaAnalisada,
  type DivisaoTempo,
  type EventoHistorico,
  type LimiteTratamento,
  type Responsavel,
  type RiscoOperacional,
  type StatusConsulta,
  type TipoAlertaTratamento,
  type TipoProteseId,
} from '@labgest/shared'
import { buscarAgendaCompleta, clinicorpConfigurado } from '@/lib/clinicorp'
import { hojeIso } from '@/lib/labs-externos-utils'
import { consultarCustodiaExterna } from '@/lib/recepcao-externa-db'
import { sendWhatsAppMessage } from '@/lib/whatsapp'

/** Tratamentos encerrados continuam visíveis por este período, para comparação. */
export const JANELA_ENCERRADOS_DIAS = 180
const MAXIMO_RETROATIVO_DIAS = 400
const DIAS_FUTUROS = 60
const TIPOS_LEGADOS = ['protocolo', 'parcial_removivel', 'protese_total']
const STATUS_ENCERRADO = ['Finalizado', 'Entregue']

export interface AlertaPainel {
  id: number
  tipo: TipoAlertaTratamento
  mensagem: string
  criadoEm: string
  cienteEm: string | null
  cientePor: string | null
  cienteNota: string | null
}

export interface MotivoAjustePainel {
  ciclo: number
  etapa: string | null
  data: string | null
  motivo: string
}

export interface TratamentoPainel {
  ordemId: number
  paciente: string
  clinica: string
  servico: string
  tipo: TipoProteseId
  tipoNome: string
  status: string
  etapa: string
  encerrado: boolean
  pausado: boolean
  dataPedido: string
  dataFim: string | null
  diasAberto: number
  limite: LimiteTratamento
  consultasPrevistas: number
  consultas: { realizadas: number; semConfirmacao: number; faltas: number; futuras: number; lista: ConsultaAnalisada[] }
  dentistas: string[]
  dentistaOrdem: string | null
  tempo: DivisaoTempo
  provas: number
  ajustes: number
  motivosAjuste: MotivoAjustePainel[]
  avaliacao: AvaliacaoTratamento
  riscos: RiscoOperacional[]
  alertas: AlertaPainel[]
  vinculo: string | null
  sugestoes: string[]
}

export interface PainelTratamentos {
  hoje: string
  clinicorpConfigurado: boolean
  ultimaSincronizacao: { em: string; sucesso: boolean; erro: string | null; consultas: number } | null
  tratamentos: TratamentoPainel[]
  limites: Array<{ tipo: TipoProteseId; nome: string; previstas: number; limite: LimiteTratamento; personalizado: boolean }>
}

const SELECAO_ORDEM = {
  id: true, nomePaciente: true, clienteNome: true, servicoNome: true, tipoWorkflow: true,
  passoFluxoAtual: true, subetapaAtual: true, status: true, dataPedido: true, createdAt: true,
  dataFinalizacao: true, dataEntregaReal: true, historicoEtapas: true, localizacaoAtual: true,
  dentistaResponsavel: true,
} satisfies Prisma.OrdemSelect

type OrdemControlada = Prisma.OrdemGetPayload<{ select: typeof SELECAO_ORDEM }> & { tipo: TipoProteseId }

const isoDia = (data: Date) => data.toISOString().slice(0, 10)

async function carregarOrdens(hoje: string): Promise<OrdemControlada[]> {
  const corte = new Date(`${somarDias(hoje, -JANELA_ENCERRADOS_DIAS)}T00:00:00Z`)
  const ordens = await prisma.ordem.findMany({
    where: {
      status: { not: 'Cancelado' },
      AND: [
        { OR: [{ tipoWorkflow: { in: [...TIPOS_CONTROLADOS, ...TIPOS_LEGADOS] } }, { tipoWorkflow: null, status: { notIn: STATUS_ENCERRADO } }] },
        { OR: [{ status: { notIn: STATUS_ENCERRADO } }, { dataFinalizacao: { gte: corte } }, { dataEntregaReal: { gte: corte } }] },
      ],
    },
    select: SELECAO_ORDEM,
    orderBy: { dataPedido: 'asc' },
  })

  const controladas: OrdemControlada[] = []
  for (const ordem of ordens) {
    const tipo = isTipoProtese(ordem.tipoWorkflow) ? ordem.tipoWorkflow : inferirTipoProtese(ordem.servicoNome, ordem.tipoWorkflow)
    if (tipo && TIPOS_CONTROLADOS.includes(tipo)) controladas.push({ ...ordem, tipo })
  }
  return controladas
}

const encerrada = (ordem: { status: string | null }) => STATUS_ENCERRADO.includes(ordem.status || '')

function inicioDaOrdem(ordem: OrdemControlada) {
  if (ordem.dataPedido) return isoDia(ordem.dataPedido)
  return ordem.createdAt ? hojeIso(ordem.createdAt) : hojeIso()
}

function fimDaOrdem(ordem: OrdemControlada) {
  if (!encerrada(ordem)) return null
  if (ordem.dataEntregaReal) return hojeIso(ordem.dataEntregaReal)
  if (ordem.dataFinalizacao) return isoDia(ordem.dataFinalizacao)
  return inicioDaOrdem(ordem)
}

async function carregarLimites() {
  const linhas = await prisma.limiteTratamento.findMany()
  const personalizados = new Map(linhas.map((l) => [l.tipoWorkflow, {
    consultasAtencao: l.consultasAtencao, consultasMax: l.consultasMax, diasAtencao: l.diasAtencao, diasMax: l.diasMax,
  } satisfies LimiteTratamento]))
  return {
    de: (tipo: TipoProteseId) => personalizados.get(tipo) ?? limitePadrao(tipo),
    personalizado: (tipo: TipoProteseId) => personalizados.has(tipo),
  }
}

const MENSAGENS: Record<TipoAlertaTratamento, (t: TratamentoPainel) => string> = {
  consultas_atencao: (t) => `${t.paciente} (${t.tipoNome}) chegou a ${t.consultas.realizadas} consultas; o previsto são ${t.consultasPrevistas} e o máximo é ${t.limite.consultasMax}.`,
  consultas_critico: (t) => `${t.paciente} (${t.tipoNome}) atingiu o máximo de consultas: ${t.consultas.realizadas} de ${t.limite.consultasMax}.`,
  tempo_atencao: (t) => `${t.paciente} (${t.tipoNome}) está há ${t.diasAberto} dias em tratamento; o limite é ${t.limite.diasMax} dias.`,
  tempo_critico: (t) => `${t.paciente} (${t.tipoNome}) estourou o prazo: ${t.diasAberto} dias em aberto (limite de ${t.limite.diasMax}).`,
}

const NOMES_RESPONSAVEL: Record<Responsavel, string> = { laboratorio: 'o laboratório', clinica: 'a clínica', fornecedor: 'o fornecedor' }

/** Monta o painel completo. Não escreve nada no banco. */
export async function montarPainel(): Promise<PainelTratamentos> {
  const hoje = hojeIso()
  const ordens = await carregarOrdens(hoje)
  const ids = ordens.map((o) => o.id)

  const [vinculos, limites, alertas, ciclos, ultima] = await Promise.all([
    prisma.tratamentoVinculo.findMany({ where: { ordemId: { in: ids } } }),
    carregarLimites(),
    prisma.alertaTratamento.findMany({ where: { ordemId: { in: ids }, resolvidoEm: null }, orderBy: { criadoEm: 'asc' } }),
    prisma.cicloProducao.findMany({
      where: { ordemId: { in: ids } },
      select: {
        ordemId: true,
        numeroCiclo: true,
        etapa: true,
        decisao: true,
        dataSaida: true,
        dataRetorno: true,
        status: true,
        observacoesDentista: true,
      },
      orderBy: { numeroCiclo: 'desc' },
    }),
    prisma.clinicorpSincronizacao.findFirst({ where: { concluidaEm: { not: null } }, orderBy: { id: 'desc' } }),
  ])

  const vinculoPorOrdem = new Map(vinculos.map((v) => [v.ordemId, v]))
  const chaveDe = (ordem: OrdemControlada) => vinculoPorOrdem.get(ordem.id)?.pacienteChave ?? normalizarNome(ordem.nomePaciente)
  const chaves = [...new Set(ordens.map(chaveDe).filter(Boolean))]
  const consultas = chaves.length
    ? await prisma.clinicorpConsulta.findMany({ where: { pacienteChave: { in: chaves } }, orderBy: [{ data: 'asc' }, { horaInicio: 'asc' }] })
    : []

  const consultasPorChave = new Map<string, typeof consultas>()
  for (const consulta of consultas) {
    const lista = consultasPorChave.get(consulta.pacienteChave) ?? []
    lista.push(consulta)
    consultasPorChave.set(consulta.pacienteChave, lista)
  }

  const sugestoes = (ultima?.sugestoes && typeof ultima.sugestoes === 'object' && !Array.isArray(ultima.sugestoes)
    ? ultima.sugestoes : {}) as Record<string, unknown>

  const tratamentos = ordens.map((ordem): TratamentoPainel => {
    const inicio = inicioDaOrdem(ordem)
    const fim = fimDaOrdem(ordem)
    const limite = limites.de(ordem.tipo)
    const resumo = analisarConsultas(
      (consultasPorChave.get(chaveDe(ordem)) ?? []).map((c) => ({
        id: c.clinicorpId,
        data: isoDia(c.data),
        hora: c.horaInicio,
        status: c.status as StatusConsulta,
        dentista: c.dentistaNome ?? (c.dentistaId ? `Profissional ${c.dentistaId}` : null),
        categoria: c.categoria,
        observacoes: c.observacoes,
        contaManual: c.contaManual,
      })),
      { inicio, fim, hoje },
    )
    const diasAberto = diasEntre(inicio, fim ?? hoje)
    const historico = (Array.isArray(ordem.historicoEtapas) ? ordem.historicoEtapas : []) as EventoHistorico[]
    const inicioTempo = (ordem.dataPedido ?? ordem.createdAt ?? new Date()).toISOString()
    const fimTempo = fim ? (ordem.dataEntregaReal ?? ordem.dataFinalizacao ?? new Date()).toISOString() : new Date().toISOString()
    const tempo = dividirTempo(historico, inicioTempo, fimTempo)
    const passo = ordem.passoFluxoAtual ? getPassoProtese(ordem.tipo, ordem.passoFluxoAtual) : null
    if (!tempo.temRegistro && !fim) {
      // Sem movimentação registrada: ao menos indica com quem a etapa atual está.
      tempo.comQuem = passo?.responsavel ?? (ordem.localizacaoAtual === 'laboratorio' ? 'laboratorio' : 'clinica')
    }
    const ciclosDaOrdem = ciclos.filter((c) => c.ordemId === ordem.id)
    const motivosAjuste = ciclosDaOrdem
      .filter((c) => c.decisao === 'ajustes' && Boolean(c.observacoesDentista?.trim()))
      .map((c) => ({
        ciclo: c.numeroCiclo,
        etapa: c.etapa?.trim() || null,
        data: c.dataRetorno ? isoDia(c.dataRetorno) : null,
        motivo: c.observacoesDentista!.trim(),
      }))
    const sugestao = sugestoes[String(ordem.id)]
    const encerrado = Boolean(fim)
    const pausado = ordem.status === 'Pausado'

    return {
      ordemId: ordem.id,
      paciente: ordem.nomePaciente,
      clinica: ordem.clienteNome,
      servico: ordem.servicoNome,
      tipo: ordem.tipo,
      tipoNome: getFluxoProtese(ordem.tipo).nomeCurto,
      status: ordem.status || 'Aguardando',
      etapa: passo?.nome ?? ordem.subetapaAtual ?? '—',
      encerrado,
      pausado,
      dataPedido: inicio,
      dataFim: fim,
      diasAberto,
      limite,
      consultasPrevistas: consultasPrevistas(ordem.tipo),
      consultas: resumo,
      dentistas: [...new Set(resumo.lista.filter((c) => c.situacao !== 'fora' && c.dentista).map((c) => c.dentista as string))],
      dentistaOrdem: ordem.dentistaResponsavel?.trim() || null,
      tempo,
      provas: ciclosDaOrdem.filter((c) => Boolean(c.dataSaida) && (c.status === 'em_prova' || Boolean(c.decisao))).length,
      ajustes: ciclosDaOrdem.filter((c) => c.decisao === 'ajustes').length,
      motivosAjuste,
      avaliacao: avaliarTratamento(resumo.realizadas, diasAberto, limite),
      riscos: detectarRiscosOperacionais({ encerrado, pausado, hoje, tempo, consultas: resumo }),
      alertas: alertas.filter((a) => a.ordemId === ordem.id).map((a) => ({
        id: a.id,
        tipo: a.tipo as TipoAlertaTratamento,
        mensagem: a.mensagem,
        criadoEm: a.criadoEm.toISOString(),
        cienteEm: a.cienteEm?.toISOString() ?? null,
        cientePor: a.cientePor,
        cienteNota: a.cienteNota,
      })),
      vinculo: vinculoPorOrdem.get(ordem.id)?.pacienteNome ?? null,
      sugestoes: resumo.lista.length === 0 && Array.isArray(sugestao) ? sugestao.filter((s): s is string => typeof s === 'string') : [],
    }
  })

  return {
    hoje,
    clinicorpConfigurado: clinicorpConfigurado(),
    ultimaSincronizacao: ultima?.concluidaEm
      ? { em: ultima.concluidaEm.toISOString(), sucesso: ultima.sucesso, erro: ultima.erro, consultas: ultima.consultas }
      : null,
    tratamentos,
    limites: TIPOS_CONTROLADOS.map((tipo) => ({
      tipo,
      nome: getFluxoProtese(tipo).nome,
      previstas: consultasPrevistas(tipo),
      limite: limites.de(tipo),
      personalizado: limites.personalizado(tipo),
    })),
  }
}

/**
 * Cria os alertas que passaram a ser devidos e encerra os que deixaram de valer
 * (tratamento concluído ou limite ampliado). Cada alerta nasce uma única vez por
 * ordem; o gestor é avisado por WhatsApp quando houver número configurado.
 */
export async function atualizarAlertas() {
  const painel = await montarPainel()
  const ativos = painel.tratamentos.filter((t) => !t.encerrado)
  const devidos = new Map<string, { tratamento: TratamentoPainel; tipo: TipoAlertaTratamento }>()
  for (const tratamento of ativos) {
    if (tratamento.pausado) continue
    for (const tipo of alertasDevidos(tratamento.avaliacao)) devidos.set(`${tratamento.ordemId}:${tipo}`, { tratamento, tipo })
  }

  const existentes = await prisma.alertaTratamento.findMany({ select: { id: true, ordemId: true, tipo: true, resolvidoEm: true } })
  const chavesExistentes = new Map(existentes.map((a) => [`${a.ordemId}:${a.tipo}`, a]))

  const novos = [...devidos.entries()].filter(([chave]) => !chavesExistentes.has(chave)).map(([, valor]) => valor)
  const reabrir = existentes.filter((a) => a.resolvidoEm && devidos.has(`${a.ordemId}:${a.tipo}`)).map((a) => a.id)
  const resolver = existentes.filter((a) => !a.resolvidoEm && !devidos.has(`${a.ordemId}:${a.tipo}`)).map((a) => a.id)

  const criados = novos.length
    ? await prisma.alertaTratamento.createMany({
        data: novos.map(({ tratamento, tipo }) => ({ ordemId: tratamento.ordemId, tipo, mensagem: MENSAGENS[tipo](tratamento) })),
        skipDuplicates: true,
      })
    : { count: 0 }
  if (reabrir.length) await prisma.alertaTratamento.updateMany({ where: { id: { in: reabrir } }, data: { resolvidoEm: null } })
  if (resolver.length) await prisma.alertaTratamento.updateMany({ where: { id: { in: resolver } }, data: { resolvidoEm: new Date() } })

  // Só avisa quando esta execução realmente criou os alertas (evita aviso duplicado em corrida).
  const telefoneEnv = process.env.GESTOR_WHATSAPP
  if (criados.count === novos.length && novos.length > 0) {
    const criticos = novos.filter((n) => n.tipo.endsWith('critico'))
    // Quando o crítico nasce junto com o de atenção, basta avisar do crítico.
    const relevantes = novos.filter((n) => n.tipo.endsWith('critico') || !criticos.some((c) => c.tratamento.ordemId === n.tratamento.ordemId && c.tipo.split('_')[0] === n.tipo.split('_')[0]))
    const linhas = relevantes.slice(0, 15).map(({ tratamento, tipo }) =>
      `${tipo.endsWith('critico') ? '🔴' : '🟡'} ${MENSAGENS[tipo](tratamento)} Está com ${NOMES_RESPONSAVEL[tratamento.tempo.comQuem]} (OS #${tratamento.ordemId}).`)
    const resto = relevantes.length > 15 ? `\n… e mais ${relevantes.length - 15}.` : ''
    try {
      const destinos = new Set<string>()
      if (telefoneEnv) destinos.add(telefoneEnv)
      try {
        const { carregarConfigWhatsappInterna } = await import('@/actions/notificacoes')
        const cfg = await carregarConfigWhatsappInterna()
        if (cfg.gestorTelefone) destinos.add(cfg.gestorTelefone)
      } catch {
        // Ignora caso config de notificações não esteja disponível
      }
      for (const dest of destinos) {
        await sendWhatsAppMessage(dest, `*LabGest — controle de tratamentos*\n\n${linhas.join('\n\n')}${resto}`)
      }
    } catch (falhaWhatsapp) {
      console.error('Falha ao enviar alerta WhatsApp de tratamentos:', falhaWhatsapp)
    }
  }

  return { novos: criados.count, resolvidos: resolver.length, painel }
}

export interface ResultadoSincronizacao {
  sucesso: boolean
  consultas: number
  erro?: string
  alertasNovos: number
}

const SITUACOES_RECEPCAO_SYNC = [
  'aguardando_recepcao',
  'aguardando_distribuicao',
  'com_dentista',
  'aguardando_resultado_dentista',
  'aguardando_envio_laboratorio',
  'em_transito_laboratorio',
]

async function carregarChavesRecepcao(): Promise<string[]> {
  const inicioFinalizadosRecentes = new Date()
  inicioFinalizadosRecentes.setDate(inicioFinalizadosRecentes.getDate() - 60)

  const ordensRecepcao = await prisma.ordem.findMany({
    where: {
      status: { notIn: ['Entregue', 'Cancelado'] },
      OR: [
        { situacaoLogistica: { in: SITUACOES_RECEPCAO_SYNC } },
        { status: 'Em Prova' },
        { situacaoLogistica: 'no_laboratorio', historicoEtapas: { array_contains: [{ acao: 'registrou_no_laboratorio' }] } },
        { status: 'Finalizado', dataFinalizacao: { gte: inicioFinalizadosRecentes } },
      ],
    },
    select: { id: true, nomePaciente: true },
  })

  const vinculosRecepcao = ordensRecepcao.length
    ? await prisma.tratamentoVinculo.findMany({
        where: { ordemId: { in: ordensRecepcao.map((o) => o.id) } },
        select: { ordemId: true, pacienteChave: true },
      })
    : []
  const vinculoPorOrdem = new Map(vinculosRecepcao.map((v) => [v.ordemId, v.pacienteChave]))

  const chaves = ordensRecepcao.map((o) => vinculoPorOrdem.get(o.id) ?? normalizarNome(o.nomePaciente))
  try {
    const externos = await consultarCustodiaExterna(prisma)
    if (externos.disponivel) {
      for (const item of externos.itens) chaves.push(normalizarNome(item.paciente))
    }
  } catch {
    // Isola falha de recepção externa para não interromper a sincronização principal.
  }
  return chaves.filter(Boolean)
}

/** Lê a agenda do Clinicorp, guarda as consultas dos pacientes acompanhados e reavalia os alertas. */
export async function sincronizarClinicorp(origem: 'manual' | 'cron'): Promise<ResultadoSincronizacao> {
  const hoje = hojeIso()
  const registro = await prisma.clinicorpSincronizacao.create({ data: { origem } })
  let consultasGravadas = 0
  let erro: string | undefined

  try {
    if (!clinicorpConfigurado()) throw new Error('Clinicorp não configurado: defina CLINICORP_URL, CLINICORP_SUBSCRIBER e CLINICORP_AUTH.')

    const [ordens, chavesRecepcao] = await Promise.all([carregarOrdens(hoje), carregarChavesRecepcao()])
    const vinculos = await prisma.tratamentoVinculo.findMany({ where: { ordemId: { in: ordens.map((o) => o.id) } } })
    const vinculoPorOrdem = new Map(vinculos.map((v) => [v.ordemId, v.pacienteChave]))
    const chaveDe = (ordem: OrdemControlada) => vinculoPorOrdem.get(ordem.id) ?? normalizarNome(ordem.nomePaciente)
    const chaves = new Set([...ordens.map(chaveDe), ...chavesRecepcao].filter(Boolean))

    const maisAntiga = ordens.length ? ordens.map(inicioDaOrdem).sort()[0] : somarDias(hoje, -30)
    const piso = somarDias(hoje, -MAXIMO_RETROATIVO_DIAS)
    const de = [somarDias(maisAntiga, -MARGEM_INICIO_DIAS), piso].sort()[1]
    const ate = somarDias(hoje, DIAS_FUTUROS)
    const deRecentePreOs = somarDias(hoje, -14)

    const { consultas: agenda, profissionais } = await buscarAgendaCompleta(de, ate)
    for (const c of agenda) {
      if (c.data >= deRecentePreOs && c.pacienteNome?.trim()) {
        chaves.add(normalizarNome(c.pacienteNome))
      }
    }
    const relevantes = agenda.filter((c) => chaves.has(normalizarNome(c.pacienteNome)))
    const agora = new Date()

    for (let i = 0; i < relevantes.length; i += 100) {
      await prisma.$transaction(relevantes.slice(i, i + 100).map((c) => {
        const dados = {
          pacienteNome: c.pacienteNome,
          pacienteChave: normalizarNome(c.pacienteNome),
          data: new Date(`${c.data}T00:00:00Z`),
          horaInicio: c.horaInicio,
          horaFim: c.horaFim,
          status: c.status,
          dentistaId: c.dentistaId,
          dentistaNome: c.dentistaNome,
          categoria: c.categoria,
          observacoes: c.observacoes,
          sincronizadoEm: agora,
        }
        // `contaManual` fica de fora do update: a decisão do gestor sobrevive às sincronizações.
        return prisma.clinicorpConsulta.upsert({ where: { clinicorpId: c.clinicorpId }, create: { clinicorpId: c.clinicorpId, ...dados }, update: dados })
      }))
    }
    consultasGravadas = relevantes.length

    // Preenche nomes de profissionais em consultas antigas já gravadas sem dentistaNome.
    if (profissionais.size > 0) {
      const semNome = await prisma.clinicorpConsulta.findMany({
        where: { dentistaId: { not: null }, dentistaNome: null },
        select: { dentistaId: true },
        distinct: ['dentistaId'],
      })
      const atualizacoes = semNome
        .map((linha) => ({ id: linha.dentistaId, nome: linha.dentistaId ? profissionais.get(linha.dentistaId) : undefined }))
        .filter((item): item is { id: string; nome: string } => Boolean(item.id && item.nome))
      if (atualizacoes.length > 0) {
        await prisma.$transaction(
          atualizacoes.map(({ id, nome }) =>
            prisma.clinicorpConsulta.updateMany({
              where: { dentistaId: id, dentistaNome: null },
              data: { dentistaNome: nome },
            }),
          ),
        )
      }
    }

    // Consulta remarcada ou cancelada some da agenda: remove a cópia ainda "agendada".
    // Comparecimentos e faltas são fatos e permanecem.
    const naAgenda = new Set(agenda.map((c) => c.clinicorpId))
    const agendadas = await prisma.clinicorpConsulta.findMany({
      where: { status: 'agendado', data: { gte: new Date(`${de}T00:00:00Z`), lte: new Date(`${ate}T00:00:00Z`) } },
      select: { id: true, clinicorpId: true },
    })
    const sumiram = agendadas.filter((c) => !naAgenda.has(c.clinicorpId)).map((c) => c.id)
    if (sumiram.length) await prisma.clinicorpConsulta.deleteMany({ where: { id: { in: sumiram } } })
    // Não guarda consultas de pacientes que deixaram de ser acompanhados.
    await prisma.clinicorpConsulta.deleteMany({ where: { pacienteChave: { notIn: [...chaves] } } })

    // Ordens ativas sem nenhuma consulta: procura nomes parecidos para o gestor confirmar.
    const comConsulta = new Set(relevantes.map((c) => normalizarNome(c.pacienteNome)))
    const nomesAgenda = [...new Set(agenda.map((c) => c.pacienteNome))]
    const sugestoes: Record<string, string[]> = {}
    for (const ordem of ordens) {
      if (encerrada(ordem) || comConsulta.has(chaveDe(ordem))) continue
      const parecidos = nomesAgenda.filter((nome) => nomesParecidos(nome, ordem.nomePaciente)).slice(0, 3)
      if (parecidos.length) sugestoes[String(ordem.id)] = parecidos
    }

    await prisma.clinicorpSincronizacao.update({
      where: { id: registro.id },
      data: { concluidaEm: new Date(), sucesso: true, consultas: consultasGravadas, sugestoes },
    })
  } catch (falha) {
    erro = (falha instanceof Error ? falha.message : String(falha)).slice(0, 500)
    console.error('Falha na sincronização com o Clinicorp:', erro)
    await prisma.clinicorpSincronizacao.update({ where: { id: registro.id }, data: { concluidaEm: new Date(), sucesso: false, erro } })
  }

  // Os alertas de tempo independem do Clinicorp: são reavaliados mesmo se a agenda falhar.
  const alertas = await atualizarAlertas()
  return { sucesso: !erro, consultas: consultasGravadas, erro, alertasNovos: alertas.novos }
}
