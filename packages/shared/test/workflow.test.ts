import assert from 'node:assert/strict'
import test from 'node:test'
import {
  KANBAN_ETAPAS,
  getNextEtapa,
  normalizarEtapa,
  statusParaEtapa,
} from '../src/workflow'

test('cada coluna do Kanban usa uma macroetapa canônica única', () => {
  const ids = KANBAN_ETAPAS.map(etapa => etapa.id)
  assert.equal(new Set(ids).size, ids.length)
  assert.deepEqual(ids, [
    'recebimento', 'modelagem', 'confeccao', 'em_prova',
    'ajuste', 'acabamento', 'conferencia', 'pronto',
  ])
})

test('normaliza nomes legados sem criar novas colunas', () => {
  assert.equal(normalizarEtapa('EmProva'), 'em_prova')
  assert.equal(normalizarEtapa('Finalização'), 'acabamento')
  assert.equal(normalizarEtapa('Confecção da Estrutura Metálica'), 'confeccao')
  assert.equal(normalizarEtapa('Ajustes solicitados pelo dentista'), 'ajuste')
})

test('status é derivado da macroetapa', () => {
  assert.equal(statusParaEtapa('recebimento'), 'Aguardando')
  assert.equal(statusParaEtapa('em_prova'), 'Em Prova')
  assert.equal(statusParaEtapa('acabamento'), 'Em Produção')
  assert.equal(statusParaEtapa('pronto'), 'Finalizado')
  assert.equal(statusParaEtapa('entregue'), 'Entregue')
})

test('avanço segue a mesma sequência exibida no Kanban', () => {
  assert.equal(getNextEtapa(null, 'em_prova'), 'ajuste')
  assert.equal(getNextEtapa(null, 'conferencia'), 'pronto')
  assert.equal(getNextEtapa(null, 'pronto'), null)
})
