import assert from 'node:assert/strict'
import test from 'node:test'
import { chaveRecepcao, transicionarExterno, estadoInicialExterno } from './recepcao-externa'

test('IDs iguais em origens diferentes permanecem distintos', () => {
  assert.notEqual(chaveRecepcao('interno', 7), chaveRecepcao('externo', 7))
  assert.throws(() => chaveRecepcao('externo', -1))
})
for (const situacao of ['Enviado', 'Provando', 'Pronto']) {
  test(`${situacao} não comprova recebimento físico`, () => {
    assert.equal(estadoInicialExterno(situacao, false), 'conferir_recebimento')
  })
}
test('Entregue e arquivado não entram na fila', () => {
  assert.equal(estadoInicialExterno('Entregue', false), null)
  assert.equal(estadoInicialExterno('Pronto', true), null)
})
test('recebimento explícito avança somente custódia', () => {
  const result = transicionarExterno(null, { acao: 'receber', expectedVersion: 0 })
  assert.equal(result.situacao, 'aguardando_distribuicao')
  assert.equal(result.version, 1)
  assert.equal(result.finalidade, null)
})
test('fluxo logístico externo não produz resultado clínico', () => {
  let state = transicionarExterno(null, { acao: 'receber', expectedVersion: 0 })
  state = transicionarExterno(state, { acao: 'distribuir', expectedVersion: 1, dentista: 'Dentista sintético', finalidade: 'prova' })
  assert.equal(state.situacao, 'com_dentista')
  state = transicionarExterno(state, { acao: 'receber_retorno', expectedVersion: 2 })
  assert.equal(state.situacao, 'aguardando_envio_laboratorio')
  assert.equal('decisaoDentista' in state, false)
  state = transicionarExterno(state, { acao: 'enviar_retorno', expectedVersion: 3 })
  assert.equal(state.situacao, 'em_transito_laboratorio')
  state = transicionarExterno(state, { acao: 'receber', expectedVersion: 4 })
  assert.equal(state.situacao, 'aguardando_distribuicao')
})
test('versão antiga e movimento repetido são recusados', () => {
  const state = transicionarExterno(null, { acao: 'receber', expectedVersion: 0 })
  assert.throws(() => transicionarExterno(state, { acao: 'receber', expectedVersion: 0 }), /alterado/)
  assert.throws(() => transicionarExterno(state, { acao: 'receber', expectedVersion: 1 }), /movimento/)
})
test('distribuição exige responsável e finalidade válidos', () => {
  const state = transicionarExterno(null, { acao: 'receber', expectedVersion: 0 })
  assert.throws(() => transicionarExterno(state, { acao: 'distribuir', expectedVersion: 1, dentista: '' }), /dentista/)
})
test('correção exige motivo e não altera objeto anterior', () => {
  const received = transicionarExterno(null, { acao: 'receber', expectedVersion: 0 })
  const state = transicionarExterno(received, { acao: 'distribuir', expectedVersion: 1, dentista: 'A', finalidade: 'prova' })
  assert.throws(() => transicionarExterno(state, { acao: 'distribuir', expectedVersion: 2, dentista: 'B', finalidade: 'prova' }), /motivo/)
  const corrected = transicionarExterno(state, { acao: 'distribuir', expectedVersion: 2, dentista: 'B', finalidade: 'prova', motivo: 'Correção explícita' })
  assert.equal(corrected.dentista, 'B')
  assert.equal(state.dentista, 'A')
})
test('comando desconhecido e versão inválida falham fechados', () => {
  assert.throws(() => transicionarExterno(null, { acao: 'excluir' as never, expectedVersion: 0 }))
  assert.throws(() => transicionarExterno(null, { acao: 'receber', expectedVersion: -1 }))
})
