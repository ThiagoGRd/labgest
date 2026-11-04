import test from 'node:test'
import assert from 'node:assert/strict'
import { erroTransicaoOrdem } from '../src/order-transition'

for (const status of ['Cancelado', 'Entregue', 'Pausado']) {
  test(`${status} blocks production and delivery transitions`, () => {
    assert.ok(erroTransicaoOrdem(status))
    assert.ok(erroTransicaoOrdem(status, true))
  })
}
test('completed production permits delivery/logistics only', () => {
  assert.ok(erroTransicaoOrdem('Finalizado'))
  assert.equal(erroTransicaoOrdem('Finalizado', true), null)
})
test('active states permit transitions', () => {
  for (const status of ['Aguardando', 'Em Produção', 'Em Prova']) {
    assert.equal(erroTransicaoOrdem(status), null)
  }
})

test('revision advances even if wall clock repeats or goes backwards', async () => {
  const helper = await import('../src/order-transition')
  const previous = new Date('2026-11-04T12:00:00.000Z')
  assert.equal(typeof helper.proximaRevisaoOrdem, 'function')
  assert.equal(helper.proximaRevisaoOrdem(previous, previous).getTime(), previous.getTime() + 1)
  assert.equal(helper.proximaRevisaoOrdem(previous, new Date(0)).getTime(), previous.getTime() + 1)
})
