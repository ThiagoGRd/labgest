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

for (const situacao of ['conferir_recebimento', 'aguardando_distribuicao', 'em_transito_laboratorio'] as const) {
  test(`conferência registra no laboratório a partir de ${situacao} sem exigir motivo`, () => {
    const previous = { situacao, version: 3, dentista: 'Dentista sintético', finalidade: 'prova' as const }
    const next = transicionarExterno(previous, { acao: 'registrar_no_laboratorio', expectedVersion: 3 })
    assert.deepEqual(next, { ...previous, situacao: 'no_laboratorio', version: 4 })
    assert.equal(previous.situacao, situacao)
    const received = transicionarExterno(next, { acao: 'receber', expectedVersion: 4 })
    assert.deepEqual(received, { situacao: 'aguardando_distribuicao', version: 5, dentista: null, finalidade: null })
  })
}
test('primeira conferência no laboratório cria custódia sem inventar distribuição', () => {
  assert.deepEqual(transicionarExterno(null, { acao: 'registrar_no_laboratorio', expectedVersion: 0 }), {
    situacao: 'no_laboratorio', version: 1, dentista: null, finalidade: null,
  })
})
for (const situacao of ['com_dentista', 'aguardando_envio_laboratorio', 'no_laboratorio'] as const) {
  test(`conferência no laboratório não pula movimento a partir de ${situacao}`, () => {
    assert.throws(() => transicionarExterno({ situacao, version: 3, dentista: 'Teste', finalidade: 'prova' },
      { acao: 'registrar_no_laboratorio', expectedVersion: 3 }), /movimento/)
  })
}
test('conferência no laboratório recusa versão antiga', () => {
  assert.throws(() => transicionarExterno({ situacao: 'aguardando_distribuicao', version: 3, dentista: null, finalidade: null },
    { acao: 'registrar_no_laboratorio', expectedVersion: 2 }), /alterado/)
})

test('agendamento explícito preserva custódia, versão e retorno encerra o agendamento', () => {
  const original = { situacao: 'aguardando_distribuicao' as const, version: 1, dentista: 'Responsável físico', finalidade: 'prova' as const, agendamento_confirmado: false, agendamento_em: null, agendamento_dentista: null }
  const scheduled = transicionarExterno(original, { acao: 'agendar', expectedVersion: 1 })
  assert.equal(scheduled.situacao, original.situacao)
  assert.equal(scheduled.dentista, original.dentista)
  assert.equal(scheduled.agendamento_confirmado, true)
  assert.throws(() => transicionarExterno(scheduled, { acao: 'agendar', expectedVersion: 1 }))
  const distributed = transicionarExterno(scheduled, { acao: 'distribuir', expectedVersion: 2, dentista: 'Físico', finalidade: 'prova' })
  const returned = transicionarExterno(distributed, { acao: 'receber_retorno', expectedVersion: 3 })
  assert.equal(returned.agendamento_confirmado, false)
  assert.throws(() => transicionarExterno(returned, { acao: 'cancelar_agendamento', expectedVersion: 4 }))
})
test('não cria custódia fictícia para agendar trabalho não recebido', () => {
  assert.throws(() => transicionarExterno(null, { acao: 'agendar', expectedVersion: 0 }))
})
test('retorno direto da recepção encerra agendamento sem criar custódia de dentista', () => {
  const atual = { situacao: 'aguardando_distribuicao' as const, version: 1, dentista: null, finalidade: null, agendamento_confirmado: true, agendamento_em: null, agendamento_dentista: null }
  const next = transicionarExterno(atual, { acao: 'enviar_retorno', expectedVersion: 1 })
  assert.equal(next.situacao, 'em_transito_laboratorio')
  assert.equal(next.agendamento_confirmado, false)
  assert.equal(next.dentista, null)
})
test('localizar no laboratório encerra agendamento', () => {
  const atual = { situacao: 'aguardando_distribuicao' as const, version: 1, dentista: null, finalidade: null, agendamento_confirmado: true, agendamento_em: null, agendamento_dentista: null }
  assert.equal(transicionarExterno(atual, { acao: 'registrar_no_laboratorio', expectedVersion: 1 }).agendamento_confirmado, false)
})
test('edição e cancelamento externos preservam custódia e dado histórico, recusando repetição', () => {
  const initial = { situacao: 'aguardando_distribuicao' as const, version: 1, dentista: 'Físico', finalidade: 'prova' as const, agendamento_confirmado: true, agendamento_em: new Date('2020-01-01T00:00:00Z'), agendamento_dentista: 'Anterior' }
  const edited = transicionarExterno(initial, { acao: 'agendar', expectedVersion: 1, dentista: 'Novo', agendamento: '2026-11-15T12:00:00Z' })
  assert.equal(edited.agendamento_dentista, 'Novo')
  assert.equal(edited.dentista, 'Físico')
  const canceled = transicionarExterno(edited, { acao: 'cancelar_agendamento', expectedVersion: 2 })
  assert.equal(canceled.agendamento_confirmado, false)
  assert.equal(canceled.agendamento_dentista, 'Novo')
  assert.equal(canceled.agendamento_em?.toISOString(), '2026-11-15T12:00:00.000Z')
  assert.throws(() => transicionarExterno(canceled, { acao: 'cancelar_agendamento', expectedVersion: 3 }))
})
