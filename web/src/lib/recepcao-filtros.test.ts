import assert from 'node:assert/strict'
import test from 'node:test'
import { filtrarOrigem } from './recepcao-filtros'

const interno = { id: 7, origem: 'interno' as const }
const externo = { id: 7, origem: 'externo' as const }
const itens = [externo, interno]
test('todos preserva ordem e objetos', () => {
  const resultado = filtrarOrigem(itens, 'todos')
  assert.deepEqual(resultado, [externo, interno])
  assert.equal(resultado[0], externo)
  assert.equal(resultado[1], interno)
})
test('origem separa IDs iguais sem alterar entrada', () => {
  assert.deepEqual(filtrarOrigem(itens, 'interno'), [interno])
  assert.deepEqual(filtrarOrigem(itens, 'externo'), [externo])
  assert.deepEqual(itens, [externo, interno])
})
test('origem vazia não traz casos de outra origem', () => {
  assert.deepEqual(filtrarOrigem([interno], 'externo'), [])
  assert.deepEqual(filtrarOrigem([], 'todos'), [])
})
