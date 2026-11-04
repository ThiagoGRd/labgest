import assert from 'node:assert/strict'
import test from 'node:test'
import { contasNoPeriodo, filtroReceberPeriodo, limitesMesReceber, mesDataFinanceira } from './periodo-receber'

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


test('datas civis do Prisma preservam outubro em qualquer fuso', () => {
  const limites = limitesMesReceber(2026, 10)
  const primeiroDia = new Date('2026-10-01T00:00:00.000Z')
  const proximoMes = new Date('2026-11-01T00:00:00.000Z')
  assert.equal(mesDataFinanceira(primeiroDia), '2026-10')
  assert.equal(mesDataFinanceira(proximoMes), '2026-11')
  assert.equal(limites.inicio.toISOString(), primeiroDia.toISOString())
  assert.equal(limites.fimExclusivo.toISOString(), proximoMes.toISOString())
  const registros = [
    { id: 1, dataCompetencia: primeiroDia, dataVencimento: primeiroDia },
    { id: 2, dataCompetencia: proximoMes, dataVencimento: proximoMes },
  ]
  for (const criterio of ['competencia', 'vencimento'] as const) {
    assert.deepEqual(contasNoPeriodo(registros, limites.inicio, limites.fimExclusivo, criterio).map(c => c.id), [1])
  }
})
