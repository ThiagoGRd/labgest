import assert from 'node:assert/strict'
import test from 'node:test'
import { concluirEntregaInterna } from './entrega-interna-recepcao'

const agora = new Date('2026-11-13T10:00:00Z')
const actor = { id: 3, email: 'teste@example.invalid', nome: 'Teste' }
const input = { ordemId: 7, expectedUpdatedAt: '2026-11-12T10:00:00.000Z' }
const baseOrder = { id: 7, status: 'Finalizado', updatedAt: new Date(input.expectedUpdatedAt), historicoEtapas: [{ acao: 'anterior' }], valorFinal: '123.45', clienteId: 2, clienteNome: 'Clínica teste', servicoNome: 'Serviço teste', nomePaciente: 'Paciente teste', dataFinalizacao: new Date('2026-11-10T00:00:00Z'), etapaAtual: 'pronto' }
const baseAccount = { id: 9, ordemId: 7, valor: '123.45', valorRecebido: '0', status: 'Pendente', canceladoEm: null, clienteId: 2, dataVencimento: new Date('2020-01-01T00:00:00Z') }
function fixture(accounts: unknown[] = [baseAccount], order: object | null = baseOrder) {
  const calls: string[] = [], writes: Array<{ target: string; data: Record<string, unknown> }> = []
  const tx = {
    $queryRaw: async (sql: TemplateStringsArray) => { calls.push(sql.join('?').replace(/\s+/g, ' ').trim()); return [{ id: 7 }] },
    ordem: { findUnique: async () => { calls.push('read order'); return order }, update: async ({ data }: { data: Record<string, unknown> }) => { writes.push({ target: 'order', data }); return data } },
    contaReceber: { findMany: async () => { calls.push('read accounts'); return accounts }, create: async () => { throw Error('must never create account') }, update: async () => { throw Error('must never update account') } },
  }
  const db = { $transaction: async (fn: (arg: typeof tx) => Promise<unknown>) => { const result = await fn(tx); calls.push('commit'); return result } }
  return { db: db as never, calls, writes }
}
test('preserva integralmente conta existente e adiciona entrega/histórico após locks', async () => {
  const f = fixture()
  const result = await concluirEntregaInterna(f.db, input, actor, agora)
  assert.equal(result.contaId, 9)
  assert.equal(f.writes.length, 1)
  assert.deepEqual(Object.keys(f.writes[0].data).sort(), ['dataEntregaReal', 'etapaAtual', 'historicoEtapas', 'progresso', 'status'])
  assert.equal(f.writes[0].data.status, 'Entregue')
  const history = f.writes[0].data.historicoEtapas as Record<string, unknown>[]
  assert.deepEqual(history[0], baseOrder.historicoEtapas[0]); assert.equal(history[1].acao, 'entrega_paciente_recepcao')
  assert.equal(history[1].contaId, 9); assert.equal(history[1].por, actor.email)
  assert.match(f.calls[0], /FROM.*ordens.*FOR UPDATE/); assert.equal(f.calls[1], 'read order')
  assert.match(f.calls[2], /FROM.*contas_receber.*ORDER BY id FOR UPDATE/); assert.equal(f.calls[3], 'read accounts')
})
test('ausência de cobrança bloqueia entrega e nunca gera dívida', async () => {
  const f = fixture([])
  await assert.rejects(() => concluirEntregaInterna(f.db, input, actor, agora), /Esta OS está sem cobrança/)
  assert.equal(f.writes.length, 0)
})
for (const [status, received] of [['Parcial', '23.45'], ['Recebido', '123.45']]) {
  test(`preserva conta ${status} sem reabrir pagamento`, async () => {
    const f = fixture([{ ...baseAccount, status, valorRecebido: received }])
    await concluirEntregaInterna(f.db, input, actor, agora)
    assert.deepEqual(f.writes.map(w => w.target), ['order'])
  })
}
for (const patch of [{ status: 'Cancelado' }, { canceladoEm: agora }, { status: 'Pendente', valorRecebido: '0.01' }, { status: 'Parcial', valorRecebido: '0' }, { status: 'Recebido', valorRecebido: '123.44' }, { valorRecebido: '-1' }, { valorRecebido: '124' }, { valor: '123.44' }, { clienteId: 3 }, { status: null }, { dataVencimento: new Date('invalid') }]) {
  test(`recusa conta inconsistente ${JSON.stringify(patch)}`, async () => {
    const f = fixture([{ ...baseAccount, ...patch }])
    await assert.rejects(() => concluirEntregaInterna(f.db, input, actor, agora), /administrador/)
    assert.equal(f.writes.length, 0)
  })
}
test('recusa múltiplas contas sem escolher uma arbitrariamente', async () => {
  const f = fixture([baseAccount, { ...baseAccount, id: 10 }])
  await assert.rejects(() => concluirEntregaInterna(f.db, input, actor, agora), /administrador/)
  assert.equal(f.writes.length, 0)
})
for (const patch of [{ status: 'Em Prova' }, { valorFinal: '0' }, { valorFinal: '-1' }, { valorFinal: 'NaN' }, { valorFinal: '0.001' }, { historicoEtapas: { acao: 'malformado' } }]) {
  test(`recusa ordem inconsistente ${JSON.stringify(patch)}`, async () => {
    const f = fixture([], { ...baseOrder, ...patch })
    await assert.rejects(() => concluirEntregaInterna(f.db, input, actor, agora))
    assert.equal(f.writes.length, 0)
  })
}
test('recusa revisão antiga', async () => {
  const f = fixture([])
  await assert.rejects(() => concluirEntregaInterna(f.db, { ...input, expectedUpdatedAt: null }, actor, agora), /alterad/)
  assert.equal(f.writes.length, 0)
})

test('uma ativa válida e canceladas antigas são preservadas', async () => {
  const f = fixture([baseAccount, { ...baseAccount, id: 10, status: 'Cancelado', canceladoEm: agora }])
  const result = await concluirEntregaInterna(f.db, input, actor, agora)
  assert.equal(result.contaId, 9); assert.deepEqual(f.writes.map(w => w.target), ['order'])
})
test('somente canceladas não gera dívida novamente', async () => {
  const f = fixture([{ ...baseAccount, status: 'Cancelado', canceladoEm: agora }])
  await assert.rejects(() => concluirEntregaInterna(f.db, input, actor, agora), /administrador/)
  assert.equal(f.writes.length, 0)
})
