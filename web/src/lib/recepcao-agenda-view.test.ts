import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { dataHoraMaceio, instanteMaceio, correspondeBusca } from './recepcao-agenda-view'
test('Maceio wall time roundtrips independently of browser timezone', () => {
  assert.equal(dataHoraMaceio('2026-11-20T14:00:00.000Z'), '2026-11-20T11:00')
  assert.equal(instanteMaceio('2026-11-20T11:00'), '2026-11-20T14:00:00.000Z')
  assert.equal(dataHoraMaceio('2026-01-01T01:00:00.000Z'), '2025-12-31T22:00')
})
test('finds appointment dentist distinct from physical dentist', () => {
  assert.equal(correspondeBusca({ paciente:'A', clinica:'B', servico:'C', dentista:'Físico', agendamentoDentista:'Dra Agenda', id:1 }, 'agenda'), true)
})
