import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
const path = new URL('../src/lib/clientes-utils.ts', import.meta.url)
const utils = existsSync(path) ? await import(path) : {}
const valid = { nome: ' Dentista ', cro: ' CRO 123 ', telefone: ' 11999999999 ', email: 'a@example.com', endereco: '', observacoes: '' }
test('client validation trims and only allows editable fields', () => {
  assert.equal(typeof utils.validarCliente, 'function')
  const result = utils.validarCliente({ ...valid, id: 7, ativo: false })
  assert.equal(result.nome, 'Dentista')
  assert.equal(result.cro, 'CRO 123')
  assert.equal('id' in result, false)
  assert.equal('ativo' in result, false)
})
test('client validation rejects malformed and oversized inputs', () => {
  assert.equal(typeof utils.validarCliente, 'function')
  for (const data of [null, {}, {...valid, nome:' '}, {...valid, telefone: '1'.repeat(21)}, {...valid, email:'bad'}, {...valid, cro: 42}]) {
    assert.throws(() => utils.validarCliente(data))
  }
})
test('CSV quotes delimiters/newlines and neutralizes spreadsheet formulas', () => {
  assert.equal(typeof utils.clientesCsv, 'function')
  const csv = utils.clientesCsv([{ ...valid, nome:' \t=HYPERLINK("bad")', telefone:'+11999', cro:'CRO;12', endereco:'a\nb', ativo:true, totalPedidos:0, valorTotal:0, ultimoPedido:null }])
  assert.ok(csv.startsWith('\ufeff'))
  assert.ok(csv.includes('"\' \t=HYPERLINK(""bad"")"'))
  assert.ok(csv.includes('"\'+11999"'))
  assert.ok(csv.includes('"CRO;12"'))
  assert.ok(csv.includes('"a\nb"'))
})
test('export uses only supplied visible rows, with headers for an empty list', () => {
  assert.equal(typeof utils.clientesCsv, 'function')
  assert.equal(utils.clientesCsv([]).split('\r\n').length, 1)
  assert.equal(utils.clientesCsv([{...valid, ativo:true, totalPedidos:0, valorTotal:0, ultimoPedido:null}]).split('\r\n').length, 2)
})
