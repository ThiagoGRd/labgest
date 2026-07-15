import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FLUXOS_PROTESE,
  TIPOS_PROTESE,
  adicionarHorasExpediente,
  calcularPrazoPasso,
  getPassoLaboratorialAnterior,
} from '../src/prosthesis-workflows'

test('todos os tipos possuem passos clínicos e laboratoriais', () => {
  assert.equal(TIPOS_PROTESE.length, 10)
  for (const tipo of TIPOS_PROTESE) {
    const passos = FLUXOS_PROTESE[tipo].passos
    assert.ok(passos.some((passo) => passo.responsavel === 'clinica'))
    assert.ok(passos.some((passo) => passo.responsavel === 'laboratorio' || passo.responsavel === 'fornecedor'))
  }
})

test('prazo laboratorial atravessa sexta e sábado respeitando o expediente', () => {
  const sexta17 = new Date('2026-07-17T20:00:00.000Z') // 17h em Maceió
  assert.equal(adicionarHorasExpediente(sexta17, 3).toISOString(), '2026-07-18T13:00:00.000Z')

  const sabado12 = new Date('2026-07-18T15:00:00.000Z') // 12h em Maceió
  assert.equal(adicionarHorasExpediente(sabado12, 3).toISOString(), '2026-07-20T13:00:00.000Z')
})

test('acrilização usa 24 horas corridas e dobra apenas etapas por arcada', () => {
  const inicio = new Date('2026-07-17T20:00:00.000Z')
  const acrilizacao = FLUXOS_PROTESE.protese_total_removivel.passos.find((p) => p.id === 'acrilizacao')!
  const moldeira = FLUXOS_PROTESE.protese_total_removivel.passos.find((p) => p.id === 'moldeira_individual')!
  assert.equal(calcularPrazoPasso(inicio, acrilizacao, 2)?.toISOString(), '2026-07-18T20:00:00.000Z')
  assert.equal(calcularPrazoPasso(inicio, moldeira, 2)?.toISOString(), '2026-07-18T12:00:00.000Z')
})

test('ajuste de prova retorna à etapa laboratorial anterior do fluxo', () => {
  assert.equal(getPassoLaboratorialAnterior('protese_total_removivel', 'prova_dentes')?.id, 'montagem_dentes')
  assert.equal(getPassoLaboratorialAnterior('protese_total_removivel', 'prova_plano_orientacao')?.id, 'plano_orientacao')
})
