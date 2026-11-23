/* eslint-disable @typescript-eslint/no-require-imports */
// Run against a fresh loopback-only database created from the Prisma schema.
const { test, after } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const vm = require('node:vm')
const ts = require('typescript')
const { Prisma, PrismaClient } = require('@prisma/client')
const url = new URL(process.env.LABGEST_RECEPTION_TEST_URL || 'http://missing')
assert.equal(url.protocol, 'postgresql:')
assert.equal(url.hostname, '127.0.0.1')
assert.equal(url.username, 'labgest_reception_test')
assert.equal(url.pathname, '/labgest_reception_test')
const prisma = new PrismaClient({ datasourceUrl: url.href })
after(() => prisma.$disconnect())

function load(file, imports) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS },
  }).outputText, { exports, Date, require: name => imports[name] ?? require(name) }, { filename: file })
  return exports
}
const sourceRoot = 'web/src'
const actions = load(sourceRoot + '/actions/recepcao.ts', {
  '@labgest/database': { prisma }, '@prisma/client': { Prisma },
  'next/cache': { revalidatePath() {} },
  '@/lib/auth-utils': { requireRecepcao: async () => ({ id: 1, email: 'test@example.invalid', nome: 'Recepção de teste', tipo: 'recepcao' }) },
  '@/lib/entrega-interna-recepcao': {},
  '@/lib/recepcao-externa-db': { consultarCustodiaExterna: async () => ({ disponivel: true, itens: [] }) },
  '@/lib/clinicorp': { clinicorpConfigurado: () => false },
  '@/lib/labs-externos-utils': { hojeIso: () => '2026-11-23' },
  '@/lib/recepcao-clinicorp': { historicoIndicaNoLabAtual: () => false, ordenarItensRecepcao: itens => itens, chavePacienteRecepcao: () => '', situacaoVisualItem: s => s, resumirAgendaClinicorpParaOrdem: () => null },
  '@/lib/agendamento-recepcao': load(sourceRoot + '/lib/agendamento-recepcao.ts', {}),
})

async function fixture(situacao = 'com_dentista', confirmado = false) {
  const { id } = await prisma.ordem.create({ data: {
    nomePaciente: 'Paciente fictício', clienteNome: 'Clínica de teste', servicoNome: 'Peça de teste',
    status: 'Em Prova', localizacaoAtual: situacao === 'com_dentista' ? 'dentista' : 'recepcao',
    situacaoLogistica: situacao, finalidadeClinica: 'prova', agendamentoConfirmado: confirmado,
    dataEntrega: new Date('2026-11-30T00:00Z'), valor: 123, valorFinal: 123,
  } })
  await prisma.$executeRaw`UPDATE ordens SET updated_at = TIMESTAMP '2026-11-23 14:00:00.123456' WHERE id = ${id}`
  return id
}
async function command(id) {
  const { itens } = await actions.getPainelRecepcao()
  const { atualizadoEm, revisao } = itens.find(item => item.id === id && item.origem === 'interno').interno
  return { ordemId: id, expectedUpdatedAt: atualizadoEm, expectedRevision: revisao }
}
const read = id => prisma.ordem.findUniqueOrThrow({ where: { id } })

test('saves and cancels an appointment on a row with a microsecond timestamp', async () => {
  const id = await fixture()
  const input = await command(id)
  assert.equal(input.expectedUpdatedAt, '2026-11-23T14:00:00.123Z')
  const saved = await actions.registrarAgendamentoInternoRecepcao({ ...input, agendado: true, dentista: 'Dra Teste', agendamento: '2026-11-25T10:00:00-03:00' })
  assert.equal(saved.success, true, JSON.stringify(saved))
  let row = await read(id)
  assert.equal(row.agendamentoClinico.toISOString(), '2026-11-25T13:00:00.000Z')
  assert.equal(row.agendamentoDentista, 'Dra Teste')
  assert.equal(row.localizacaoAtual, 'dentista')
  assert.equal(row.situacaoLogistica, 'com_dentista')
  assert.equal(row.status, 'Em Prova')
  assert.equal((await actions.registrarAgendamentoInternoRecepcao({ ...await command(id), agendado: false })).success, true)
  row = await read(id)
  assert.equal(row.agendamentoConfirmado, false)
  assert.equal(row.agendamentoClinico.toISOString(), '2026-11-25T13:00:00.000Z')
  assert.deepEqual(row.historicoEtapas.map(e => e.acao), ['agendou_recepcao', 'cancelou_agendamento_recepcao'])
})

test('rejects a newer edit in the same millisecond and accepts only one of two concurrent saves', async () => {
  const id = await fixture()
  const stale = await command(id)
  await prisma.$executeRaw`UPDATE ordens SET updated_at = TIMESTAMP '2026-11-23 14:00:00.123457' WHERE id = ${id}`
  const fresh = await command(id)
  assert.equal(stale.expectedUpdatedAt, fresh.expectedUpdatedAt)
  const rejected = await actions.registrarAgendamentoInternoRecepcao({ ...stale, agendado: true })
  assert.equal(rejected.code, 'CONFLICT')
  assert.equal((await read(id)).agendamentoConfirmado, false)
  const attempts = await Promise.all([1, 2].map(() => actions.registrarAgendamentoInternoRecepcao({ ...fresh, agendado: true })))
  assert.equal(attempts.filter(r => r.success).length, 1, JSON.stringify(attempts))
  assert.equal(attempts.filter(r => r.code === 'CONFLICT').length, 1)
  assert.equal((await read(id)).historicoEtapas.length, 1)
})

test('returns a scheduled piece from reception once, without changing the clinical workflow', async () => {
  const id = await fixture('aguardando_distribuicao', true)
  const input = await command(id)
  const result = await actions.retornarAgendadoDaRecepcao(input)
  assert.equal(result.success, true, JSON.stringify(result))
  assert.equal((await actions.retornarAgendadoDaRecepcao(input)).success, false)
  const row = await read(id)
  assert.equal(row.agendamentoConfirmado, false)
  assert.equal(row.localizacaoAtual, 'em_transito_laboratorio')
  assert.equal(row.situacaoLogistica, 'em_transito_laboratorio')
  assert.equal(row.status, 'Em Prova')
  assert.equal(row.finalidadeClinica, 'prova')
  assert.deepEqual(row.historicoEtapas.map(e => e.acao), ['retornou_agendado_recepcao'])
})
