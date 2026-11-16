/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const esbuild = require(require.resolve('esbuild', { paths: [path.resolve(__dirname, '..'), path.resolve(__dirname, '../..')] }))

const webRoot = path.resolve(__dirname, '..')

async function carregarModuloAgendaTv() {
  const build = await esbuild.build({
    entryPoints: [path.join(webRoot, 'src/lib/agenda-tv.ts')],
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

test('normalizarProteticoId aceita Tavá, tava, Otávio e Napoleão', async () => {
  const tv = await carregarModuloAgendaTv()
  assert.equal(tv.normalizarProteticoId('Tavá'), 'otavio')
  assert.equal(tv.normalizarProteticoId(' tava '), 'otavio')
  assert.equal(tv.normalizarProteticoId('Otávio'), 'otavio')
  assert.equal(tv.normalizarProteticoId(' otavio '), 'otavio')
  assert.equal(tv.normalizarProteticoId('NAPOLEÃO'), 'napoleao')
  assert.equal(tv.normalizarProteticoId('napoleao'), 'napoleao')
  assert.equal(tv.normalizarProteticoId('outro'), null)
})

test('sugerirBlocosEtapa divide acrilização entre bancada ativa e panela passiva quando habilitado', async () => {
  const tv = await carregarModuloAgendaTv()
  const blocos = tv.sugerirBlocosEtapa({
    etapaNome: 'Acrilização',
    horaInicioBase: '10:00',
    dividirAcrilizacao: true,
  })
  assert.equal(blocos.length, 3)
  assert.equal(blocos[0].horaInicio, '10:00')
  assert.equal(blocos[0].horaFim, '10:35')
  assert.equal(blocos[0].modo, 'bancada')

  assert.equal(blocos[1].horaInicio, '10:35')
  assert.equal(blocos[1].horaFim, '11:50')
  assert.equal(blocos[1].modo, 'maquina')
  assert.equal(blocos[1].equipamento, 'Panela Térmica 1')

  assert.equal(blocos[2].horaInicio, '11:50')
  assert.equal(blocos[2].horaFim, '12:25')
  assert.equal(blocos[2].modo, 'bancada')

  const montagemDupla = tv.sugerirBlocosEtapa({
    etapaNome: 'Montagem de dentes',
    arcadas: 2,
    horaInicioBase: '09:00',
  })
  assert.equal(montagemDupla.length, 1)
  assert.equal(montagemDupla[0].horaInicio, '09:00')
  assert.equal(montagemDupla[0].horaFim, '11:00')
})

test('calcularRiscoClinicorp alerta quando consulta está muito próxima ou anterior ao fim do bloco', async () => {
  const tv = await carregarModuloAgendaTv()
  assert.equal(
    tv.calcularRiscoClinicorp(
      { data: '2026-11-16', horaFim: '14:00', status: 'agendado' },
      { data: '2026-11-16', hora: '14:30' },
    ),
    true,
  )
  assert.equal(
    tv.calcularRiscoClinicorp(
      { data: '2026-11-16', horaFim: '14:00', status: 'agendado' },
      { data: '2026-11-16', hora: '16:00' },
    ),
    false,
  )
  assert.equal(
    tv.calcularRiscoClinicorp(
      { data: '2026-11-16', horaFim: '14:00', status: 'concluido' },
      { data: '2026-11-16', hora: '14:15' },
    ),
    false,
  )
})

test('resumirBancadaProtetico destaca bloco em bancada, máquina pronta e backlog fallback', async () => {
  const tv = await carregarModuloAgendaTv()
  const hoje = '2026-11-16'
  const blocos = [
    {
      id: 1,
      ordemId: 101,
      protetico: 'otavio',
      data: hoje,
      horaInicio: '09:00',
      horaFim: '10:00',
      etapaNome: 'Montagem de dentes',
      modo: 'bancada',
      status: 'em_andamento',
      paciente: 'Rita de Cássia',
      servico: 'Prótese total',
      atualizadoEm: '2026-11-16T09:00:00Z',
      clinicorpConsultaLabel: 'Hoje 15:00',
      riscoClinicorp: false,
      prioridadeOrdem: 'Normal',
      diasVencidosTotal: 0,
      cicloObs: null,
      cicloDentistaDeci: null,
    },
    {
      id: 2,
      ordemId: 102,
      protetico: 'otavio',
      data: hoje,
      horaInicio: '08:30',
      horaFim: '09:45',
      etapaNome: 'Acrilização · Polimerização',
      modo: 'maquina',
      status: 'em_andamento',
      paciente: 'João Silva',
      servico: 'Protocolo',
      equipamento: 'Panela Térmica 1',
      atualizadoEm: '2026-11-16T08:30:00Z',
      clinicorpConsultaLabel: null,
      riscoClinicorp: false,
      prioridadeOrdem: 'Normal',
      diasVencidosTotal: 0,
      cicloObs: null,
      cicloDentistaDeci: null,
    },
  ]

  const ordensNoLab = [
    {
      id: 101,
      paciente: 'Rita de Cássia',
      dentista: 'Dr. Marcos',
      servico: 'Prótese total',
      status: 'Em Produção',
      updatedAt: '2026-11-16T09:00:00Z',
      etapa: 'confeccao',
      prioridade: 'Normal',
      entrega: '2026-11-18T18:00:00Z',
    },
    {
      id: 205,
      paciente: 'Ana Beatriz',
      dentista: 'Dra. Carla',
      servico: 'Placa Bruxismo',
      status: 'Em Produção',
      updatedAt: '2026-11-16T08:00:00Z',
      etapa: 'confeccao',
      prioridade: 'Urgente',
      entrega: '2026-11-16T18:00:00Z',
    },
  ]

  // Hora atual 09:50 -> Montagem está 50m de 60m (83%); Panela termina às 09:45 -> PRONTA!
  const resumoOtavio = tv.resumirBancadaProtetico({
    protetico: 'otavio',
    blocos,
    ordensNoLab,
    dataReferencia: hoje,
    dataHoje: hoje,
    horaMinAtual: 9 * 60 + 50,
  })

  assert.equal(resumoOtavio.blocoAtual.paciente, 'Rita de Cássia')
  assert.equal(resumoOtavio.blocoAtual.progressoPct, 83)
  assert.equal(resumoOtavio.emMaquina.length, 1)
  assert.equal(resumoOtavio.emMaquina[0].prontoParaRetirar, true)
  assert.equal(resumoOtavio.emMaquina[0].restanteMin, 0)
  // Ordem 101 já está agendada hoje, então backlog traz 205
  assert.deepEqual(
    resumoOtavio.backlog.map((o) => o.id),
    [205],
  )

  // Napoleão sem agenda hoje recebe sugestão automática da fila
  const resumoNapoleao = tv.resumirBancadaProtetico({
    protetico: 'napoleao',
    blocos,
    ordensNoLab,
    dataReferencia: hoje,
    dataHoje: hoje,
    horaMinAtual: 9 * 60 + 50,
  })
  assert.equal(resumoNapoleao.blocoAtual, null)
  assert.equal(resumoNapoleao.sugeridoDaFila.id, 205)
})

test('parseBlocoNotificacao trata JSON válido e ignora registros corrompidos', async () => {
  const tv = await carregarModuloAgendaTv()
  const ok = tv.parseBlocoNotificacao({
    id: 42,
    mensagem: JSON.stringify({
      protetico: 'Napoleão',
      ordemId: 99,
      data: '2026-11-16',
      horaInicio: '10:00',
      horaFim: '12:00',
      etapaNome: 'Acrilização',
      modo: 'maquina',
      status: 'agendado',
      paciente: 'Rita de Cássia',
      servico: 'PT',
    }),
  })
  assert.equal(ok.id, 42)
  assert.equal(ok.protetico, 'napoleao')
  assert.equal(ok.modo, 'maquina')
  assert.equal(tv.parseBlocoNotificacao({ id: 43, mensagem: '{invalido' }), null)
})
