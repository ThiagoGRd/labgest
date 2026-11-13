/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
test('production and prosthesis lock order before reading history', () => {
  for (const file of ['producao.ts', 'workflow-protese.ts']) {
    const s = fs.readFileSync(`web/src/actions/${file}`, 'utf8')
    assert.match(s, /FOR UPDATE/)
  }
})
test('cycle return ends scheduling without clearing historical date', () => {
  const s = fs.readFileSync('web/src/actions/ciclos.ts', 'utf8')
  const f = s.slice(s.indexOf('export async function confirmarRetorno'), s.indexOf('export async function concluirAjusteSemNovaProva'))
  assert.match(f, /agendamentoConfirmado: false/)
  assert.match(f, /agendamentoEncerrado/)
  assert.doesNotMatch(f, /agendamentoClinico: null/)
})
test('opening a production cycle closes active scheduling with revision guard', () => {
  const s = fs.readFileSync('web/src/actions/ciclos.ts', 'utf8')
  const f = s.slice(s.indexOf('export async function abrirCiclo'), s.indexOf('export async function enviarParaProva'))
  assert.match(f, /agendamentoConfirmado: false/)
  assert.match(f, /agendamentoEncerrado/)
  assert.match(f, /updatedAt: ordem.updatedAt/)
})
