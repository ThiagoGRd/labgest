import { test } from 'node:test'
import { strict as assert } from 'node:assert'
import { dataHoraMaceio, instanteMaceio, correspondeBusca } from './recepcao-agenda-view'
test('Maceio wall time roundtrips independently of browser timezone', () => {
  assert.equal(dataHoraMaceio('2026-11-20T14:00:00.000Z'), '2026-11-20T11:00')
  assert.equal(instanteMaceio('2026-11-20T11:00'), '2026-11-20T14:00:00.000Z')
  assert.equal(instanteMaceio('2026-11-20T11:00:00'), '2026-11-20T14:00:00.000Z')
  assert.equal(instanteMaceio('data-invalida'), '')
  assert.equal(dataHoraMaceio('data-invalida'), '')
  assert.equal(dataHoraMaceio('2026-01-01T01:00:00.000Z'), '2025-12-31T22:00')
})
test('finds appointment dentist distinct from physical dentist, accent-insensitive and Clinicorp dentist', () => {
  assert.equal(correspondeBusca({ paciente:'A', clinica:'B', servico:'C', dentista:'Físico', agendamentoDentista:'Dra Agenda', id:1 }, 'agenda'), true)
  assert.equal(correspondeBusca({ paciente:'João Pedro', clinica:'Clínica Ápice', servico:'Prótese Total', dentista:'', agendamentoDentista:null, id:2 }, 'joao'), true)
  assert.equal(correspondeBusca({ paciente:'João Pedro', clinica:'Clínica Ápice', servico:'Prótese Total', dentista:'', agendamentoDentista:null, id:2 }, 'protese'), true)
  assert.equal(correspondeBusca({ paciente:'Maria', clinica:'Lab', servico:'Coroa', dentista:'', agendamentoDentista:null, id:3, clinicorp: { proximaConsulta: { dentistaNome: 'Dra. Mônica' } } }, 'monica'), true)
})
