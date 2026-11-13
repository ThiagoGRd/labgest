import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { prepararAgendamento } from './agendamento-recepcao'

test('historical data does not imply active scheduling and optional fields stay optional', () => {
  assert.deepEqual(prepararAgendamento(true, '', ''), { confirmado: true, dentista: null, data: null })
  assert.deepEqual(prepararAgendamento(false, 'Dentista', '2026-01-01T12:00:00Z'), { confirmado: false, dentista: null, data: null })
})
test('rejects malformed date and invalid dentist', () => {
  assert.throws(() => prepararAgendamento(true, '', 'invalid'))
  assert.throws(() => prepararAgendamento(true, 'x'.repeat(256), ''))
})

test('rejects impossible dates and ambiguous timestamp formats', () => {
  for (const value of ['1', '2026-02-30T12:00:00Z', '2026-04-31T12:00:00Z', '2026-13-01T12:00:00Z', '2026-01-01']) assert.throws(() => prepararAgendamento(true, '', value))
  assert.equal(prepararAgendamento(true, '', '2024-02-29T12:00:00.000Z').data?.toISOString(), '2024-02-29T12:00:00.000Z')
})
