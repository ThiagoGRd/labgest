import assert from 'node:assert/strict'
import test from 'node:test'
import { contasNoPeriodo, filtroReceberPeriodo } from './periodo-receber'

const inicio = new Date(2026, 9, 1)
const fim = new Date(2026, 10, 1)
const contas = [
  { id: 1, dataCompetencia: new Date(2026, 9, 20), dataVencimento: new Date(2026, 10, 10) },
  { id: 2, dataCompetencia: new Date(2026, 8, 20), dataVencimento: new Date(2026, 9, 10) },
  { id: 3, dataCompetencia: null, dataVencimento: new Date(2026, 9, 15) },
  { id: 4, dataCompetencia: new Date(2026, 9, 31, 23, 59, 59, 999), dataVencimento: new Date(2026, 10, 10) },
  { id: 5, dataCompetencia: fim, dataVencimento: new Date(2026, 10, 10) },
]

test('outubro mostra competência de outubro com vencimento em novembro', () => {
  assert.deepEqual(contasNoPeriodo(contas, inicio, fim, 'competencia').map(c => c.id), [1, 4])
})

test('preserva contas e totais por vencimento para o resumo e relatórios', () => {
  assert.deepEqual(contasNoPeriodo(contas, inicio, fim, 'vencimento').map(c => c.id), [2, 3])
})

test('consulta carrega ambos os critérios, inclusive o último milissegundo do mês', () => {
  assert.deepEqual(filtroReceberPeriodo(inicio, fim), {
    OR: [
      { dataVencimento: { gte: inicio, lt: fim } },
      { dataCompetencia: { gte: inicio, lt: fim } },
    ],
  })
})


test('não atribui competência a lançamentos sem data registrada', () => {
  assert.equal(contasNoPeriodo([contas[2]], inicio, fim, 'competencia').length, 0)
  assert.equal(contasNoPeriodo([contas[2]], inicio, fim, 'vencimento').length, 1)
})
