import assert from 'node:assert/strict'
import test from 'node:test'
import { calcularPrecoServico, contarElementosInformados } from '../src/pricing'

test('interpreta número de 1 a 10 como quantidade', () => {
  assert.equal(contarElementosInformados('6'), 6)
})

test('interpreta numeração dentária isolada como um elemento', () => {
  assert.equal(contarElementosInformados('21'), 1)
})

test('conta uma lista de dentes', () => {
  assert.equal(contarElementosInformados('11, 12, 21'), 3)
})

test('multiplica apenas serviços cobrados por elemento', () => {
  assert.deepEqual(calcularPrecoServico('Unitário', 50, '6'), { quantidade: 6, valorTotal: 300 })
  assert.deepEqual(calcularPrecoServico('Placa de Bruxismo', 120, '2'), { quantidade: 1, valorTotal: 120 })
})
