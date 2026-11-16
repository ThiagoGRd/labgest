/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const esbuild = require(require.resolve('esbuild', { paths: [path.resolve(__dirname, '..'), path.resolve(__dirname, '../..')] }))

const webRoot = path.resolve(__dirname, '..')

async function carregarModuloAgendaIa() {
  const build = await esbuild.build({
    entryPoints: [path.join(webRoot, 'src/lib/agenda-ia.ts')],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    plugins: [
      {
        name: 'alias-web',
        setup(b) {
          b.onResolve({ filter: /^@\// }, (args) => {
            const base = path.join(webRoot, 'src', args.path.slice(2))
            const found = ['.ts', '.tsx', '/index.ts'].map((ext) => base + ext).find((p) => fs.existsSync(p))
            return { path: found || base }
          })
          b.onResolve({ filter: /^@labgest\/shared$/ }, () => ({
            path: path.resolve(webRoot, '../packages/shared/src/index.ts'),
          }))
        },
      },
    ],
  })

  const mod = { exports: {} }
  const fn = new Function('require', 'module', 'exports', build.outputFiles[0].text)
  fn(require, mod, mod.exports)
  return mod.exports
}

test('aprenderTemposProteticos detecta quando o tempo diminuiu (mais rápido) ou estendeu (mais lento)', async () => {
  const ia = await carregarModuloAgendaIa()

  const historico = [
    // Otávio conclui 4 montagens em ~40-45 min (base é 60 min -> deve diminuir!)
    ...[1, 2, 3, 4].map((i) => ({
      id: i,
      ordemId: 100 + i,
      protetico: 'otavio',
      data: `2026-11-0${i}`,
      horaInicio: '09:00',
      horaFim: '10:00',
      etapaNome: 'Montagem de dentes',
      modo: 'bancada',
      status: 'concluido',
      paciente: `Paciente ${i}`,
      servico: 'Prótese total',
      iniciadoEm: `2026-11-0${i}T12:00:00Z`,
      concluidoEm: `2026-11-0${i}T12:42:00Z`, // 42 min reais
      atualizadoEm: `2026-11-0${i}T12:42:00Z`,
    })),
    // Napoleão conclui 3 placas em ~85-90 min (base é 60 min -> deve estender!)
    ...[1, 2, 3].map((i) => ({
      id: 10 + i,
      ordemId: 200 + i,
      protetico: 'napoleao',
      data: `2026-11-0${i}`,
      horaInicio: '14:00',
      horaFim: '15:00',
      etapaNome: 'Placa miorrelaxante',
      modo: 'bancada',
      status: 'concluido',
      paciente: `Placa ${i}`,
      servico: 'Placa Bruxismo',
      iniciadoEm: `2026-11-0${i}T17:00:00Z`,
      concluidoEm: `2026-11-0${i}T18:30:00Z`, // 90 min reais
      atualizadoEm: `2026-11-0${i}T18:30:00Z`,
    })),
  ]

  const perfis = ia.aprenderTemposProteticos(historico)
  const otavioMontagem = perfis.find((p) => p.protetico === 'otavio' && p.categoria === 'montagem')
  const napoleaoPlaca = perfis.find((p) => p.protetico === 'napoleao' && p.categoria === 'placa')

  assert.ok(otavioMontagem)
  assert.equal(otavioMontagem.tendencia, 'diminuiu')
  assert.ok(otavioMontagem.duracaoSugeridaMin < 60, `Esperava < 60m, recebeu ${otavioMontagem.duracaoSugeridaMin}`)
  assert.ok(otavioMontagem.desvioMin <= -10)

  assert.ok(napoleaoPlaca)
  assert.equal(napoleaoPlaca.tendencia, 'estendeu')
  assert.ok(napoleaoPlaca.duracaoSugeridaMin > 60, `Esperava > 60m, recebeu ${napoleaoPlaca.duracaoSugeridaMin}`)
  assert.ok(napoleaoPlaca.desvioMin >= 15)
})

test('avaliarPrioridadesComAntiInanicao prioriza urgentes sem deixar ordens normais presas para sempre', async () => {
  const ia = await carregarModuloAgendaIa()
  const hoje = '2026-11-16'

  const mkOrdem = (id, prioridade, dataPedido, entrega, diasClinicorp = null) => ({
    id,
    paciente: `Paciente ${id}`,
    dentista: 'Dr. Marcos',
    servico: 'Prótese total',
    status: 'Em Produção',
    dataPedido,
    entrega,
    updatedAt: dataPedido,
    etapa: 'confeccao',
    subetapa: 'Montagem de dentes',
    prioridade,
    clinicorpEtapa:
      diasClinicorp !== null
        ? { proximaConsulta: { data: diasClinicorp, hora: '14:00', categoria: 'Prova' } }
        : null,
  })

  // 5 ordens urgentes/vencidas + 2 ordens normais (uma antiga esperando há 8 dias e uma nova)
  const ordens = [
    mkOrdem(1, 'Urgente', '2026-11-14', '2026-11-15', hoje),
    mkOrdem(2, 'Urgente', '2026-11-14', '2026-11-15'),
    mkOrdem(3, 'Urgente', '2026-11-14', '2026-11-15'),
    mkOrdem(4, 'Alta', '2026-11-13', '2026-11-16'),
    mkOrdem(5, 'Urgente', '2026-11-15', '2026-11-15'),
    mkOrdem(6, 'Normal', '2026-11-08', '2026-11-22'), // 8 dias esperando na fila!
    mkOrdem(7, 'Normal', '2026-11-16', '2026-11-25'),
  ]

  const fila = ia.avaliarPrioridadesComAntiInanicao(ordens, hoje)
  // Top 1 deve ser a crítica com Clinicorp HOJE (#1)
  assert.equal(fila[0].ordem.id, 1)
  assert.equal(fila[0].faixa, 'critica')

  // Pela janela de justiça 3:1, a ordem normal envelhecida (#6) deve entrar já na posição 4 (índice 3),
  // impedindo que fique presa atrás das outras urgentes #4 e #5!
  const posNormal6 = fila.findIndex((x) => x.ordem.id === 6)
  assert.equal(posNormal6, 3, `Ordem normal #6 deveria furar na janela 3:1 (índice 3), ficou em ${posNormal6}`)
  assert.match(fila[posNormal6].motivoPrioridade, /Rodízio anti-pendência|Anti-fila/)
})

test('gerarPlanoAgendaAutomatico distribui entre Otávio e Napoleão, respeita almoço, usa tempos aprendidos e divide Acrilização', async () => {
  const ia = await carregarModuloAgendaIa()
  const hoje = '2026-11-16'

  const historico = [1, 2, 3, 4].map((i) => ({
    id: i,
    ordemId: i,
    protetico: 'otavio',
    data: `2026-11-0${i}`,
    horaInicio: '09:00',
    horaFim: '10:00',
    etapaNome: 'Montagem de dentes',
    modo: 'bancada',
    status: 'concluido',
    paciente: `Hist ${i}`,
    servico: 'Prótese total',
    iniciadoEm: `2026-11-0${i}T12:00:00Z`,
    concluidoEm: `2026-11-0${i}T12:45:00Z`, // Otávio faz montagem em 45m (base 60m)
    atualizadoEm: `2026-11-0${i}T12:45:00Z`,
  }))

  const ordensNoLab = [
    {
      id: 301,
      paciente: 'Rita de Cássia',
      dentista: 'Dr. Marcos',
      servico: 'Prótese total',
      status: 'Em Produção',
      dataPedido: '2026-11-14',
      entrega: '2026-11-16',
      updatedAt: '2026-11-14T10:00:00Z',
      etapa: 'confeccao',
      subetapa: 'Montagem de dentes',
      prioridade: 'Urgente',
      arcadas: 1,
    },
    {
      id: 302,
      paciente: 'Carlos Eduardo',
      dentista: 'Dra. Carla',
      servico: 'PPR Inferior',
      status: 'Em Produção',
      dataPedido: '2026-11-14',
      entrega: '2026-11-17',
      updatedAt: '2026-11-14T10:00:00Z',
      etapa: 'confeccao',
      subetapa: 'Acrilização',
      prioridade: 'Alta',
      arcadas: 1,
    },
    {
      id: 303,
      paciente: 'Lúcia Helena',
      dentista: 'Dr. Marcos',
      servico: 'Placa Bruxismo',
      status: 'Em Produção',
      dataPedido: '2026-11-15',
      entrega: '2026-11-18',
      updatedAt: '2026-11-15T10:00:00Z',
      etapa: 'confeccao',
      subetapa: 'Placa oclusal',
      prioridade: 'Normal',
      arcadas: 1,
    },
  ]

  const plano = ia.gerarPlanoAgendaAutomatico({
    dataAlvo: hoje,
    dataHoje: hoje,
    horaMinAtual: 8 * 60, // 08:00
    ordensNoLab,
    blocosExistentesNoDia: [],
    historicoConcluidos: historico,
    dividirAcrilizacao: true,
  })

  // Rita (#301 Montagem) vai para Otávio com duração adaptada (< 60m, ~45-50m)!
  const blocoRita = plano.blocos.find((b) => b.ordemId === 301)
  assert.ok(blocoRita)
  assert.equal(blocoRita.protetico, 'otavio')
  assert.ok(blocoRita.duracaoPlanejadaMin <= 50, `Deveria reduzir para <=50m, gerou ${blocoRita.duracaoPlanejadaMin}m`)

  // Carlos (#302 Acrilização) vai para Napoleão dividido em 3 blocos (bancada + Panela + bancada),
  // e Lúcia (#303 Placa) entra na janela livre durante os 75m em que #302 está na Panela!
  const blocosCarlos = plano.blocos.filter((b) => b.ordemId === 302)
  assert.equal(blocosCarlos.length, 3)
  assert.equal(blocosCarlos[0].protetico, 'napoleao')
  assert.equal(blocosCarlos[1].modo, 'maquina')
  assert.ok(blocosCarlos[0].grupoSequenciaId)

  const blocoLucia = plano.blocos.find((b) => b.ordemId === 303)
  assert.ok(blocoLucia)
  assert.equal(blocoLucia.protetico, 'napoleao')
  // Nenhum bloco de bancada invade almoço 12:00-13:30
  for (const b of plano.blocos.filter((x) => x.modo === 'bancada')) {
    const ini = Number(b.horaInicio.slice(0, 2)) * 60 + Number(b.horaInicio.slice(3, 5))
    const fim = Number(b.horaFim.slice(0, 2)) * 60 + Number(b.horaFim.slice(3, 5))
    const invadeAlmoco = ini < 13 * 60 + 30 && fim > 12 * 60
    assert.equal(invadeAlmoco, false, `Bloco ${b.horaInicio}-${b.horaFim} invadiu o almoço`)
  }
})

test('recalibrarAgendaPorExecucao empurra agenda quando estende e antecipa quando termina mais rápido', async () => {
  const ia = await carregarModuloAgendaIa()
  const hoje = '2026-11-16'

  const blocosDia = [
    {
      id: 1,
      ordemId: 10,
      protetico: 'otavio',
      data: hoje,
      horaInicio: '09:00',
      horaFim: '10:00',
      etapaNome: 'Montagem',
      modo: 'bancada',
      status: 'em_andamento',
      paciente: 'Paciente A',
      servico: 'Prótese total',
      atualizadoEm: '2026-11-16T09:00:00Z',
    },
    {
      id: 2,
      ordemId: 11,
      protetico: 'otavio',
      data: hoje,
      horaInicio: '10:05',
      horaFim: '11:05',
      etapaNome: 'Montagem',
      modo: 'bancada',
      status: 'agendado',
      paciente: 'Paciente B',
      servico: 'Prótese total',
      atualizadoEm: '2026-11-16T08:00:00Z',
    },
    {
      id: 3,
      ordemId: 12,
      protetico: 'otavio',
      data: hoje,
      horaInicio: '11:10',
      horaFim: '11:55',
      etapaNome: 'Acabamento',
      modo: 'bancada',
      status: 'agendado',
      paciente: 'Paciente C',
      servico: 'Prótese total',
      atualizadoEm: '2026-11-16T08:00:00Z',
    },
  ]

  // Caso 1: Bloco 1 ESTENDEU até 10:25 (+25m) -> Bloco 2 vai p/ 10:30-11:30 e Bloco 3 (45m) pula o almoço p/ 13:30-14:15!
  const recAtraso = ia.recalibrarAgendaPorExecucao({
    blocosDoDia: blocosDia,
    blocoAlteradoId: 1,
    novoFimMin: 10 * 60 + 25,
  })
  assert.equal(recAtraso.direcao, 'estendeu')
  assert.equal(recAtraso.deltaMin, 25)
  assert.equal(recAtraso.blocosAtualizados.length, 2)
  assert.equal(recAtraso.blocosAtualizados[0].horaInicio, '10:30')
  assert.equal(recAtraso.blocosAtualizados[0].horaFim, '11:30')
  assert.equal(recAtraso.blocosAtualizados[1].horaInicio, '13:30')
  assert.equal(recAtraso.blocosAtualizados[1].horaFim, '14:15')

  // Caso 2: Bloco 1 terminou MAIS RÁPIDO às 09:35 (-25m) -> Bloco 2 e Bloco 3 são antecipados!
  const recRapido = ia.recalibrarAgendaPorExecucao({
    blocosDoDia: blocosDia,
    blocoAlteradoId: 1,
    novoFimMin: 9 * 60 + 35,
  })
  assert.equal(recRapido.direcao, 'diminuiu')
  assert.equal(recRapido.deltaMin, -25)
  assert.equal(recRapido.blocosAtualizados.length, 2)
  assert.equal(recRapido.blocosAtualizados[0].horaInicio, '09:40')
  assert.equal(recRapido.blocosAtualizados[0].horaFim, '10:40')
  assert.equal(recRapido.blocosAtualizados[1].horaInicio, '10:45')
  assert.equal(recRapido.blocosAtualizados[1].horaFim, '11:30')
})
