import assert from 'node:assert/strict'
import test from 'node:test'
import { validarExclusaoOrdem } from './exclusao-ordem'

function ordemSemMovimentacao() {
  return {
    status: 'Aguardando',
    historicoEtapas: [{ acao: 'criou' }],
    dataFinalizacao: null,
    dataEntregaReal: null,
    estoqueBaixadoEm: null,
    cobrancaGeradaEm: null,
    totalCiclos: 0,
    totalContasReceber: 0,
    totalMovimentacoesEstoque: 0,
  }
}

test('permite excluir uma ordem duplicada ainda não iniciada', () => {
  assert.deepEqual(validarExclusaoOrdem(ordemSemMovimentacao()), { permitida: true })
})

test('bloqueia exclusão depois de uma movimentação do fluxo', () => {
  const ordem = ordemSemMovimentacao()
  ordem.historicoEtapas.push({ acao: 'avancou' })

  assert.equal(validarExclusaoOrdem(ordem).permitida, false)
})

test('bloqueia exclusão quando existe registro financeiro', () => {
  const ordem = { ...ordemSemMovimentacao(), totalContasReceber: 1 }

  assert.equal(validarExclusaoOrdem(ordem).permitida, false)
})
