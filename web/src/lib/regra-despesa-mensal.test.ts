import test from 'node:test'
import assert from 'node:assert/strict'
import { resumirDespesasMensais } from './regra-despesa-mensal'

test('separa o total pago da competência da saída de caixa', () => {
  const resumo = resumirDespesasMensais([
    { valor: 1000, valorPago: 1000, status: 'Pago' },
    { valor: 400, valorPago: 150, status: 'Parcial' },
  ])

  assert.deepEqual(resumo, {
    quantidade: 2,
    valorPrevisto: 1400,
    valorPago: 1150,
    saldo: 250,
  })
})

test('ignora contas a pagar canceladas', () => {
  const resumo = resumirDespesasMensais([
    { valor: 500, valorPago: 0, status: 'Cancelado' },
    { valor: 300, valorPago: 0, canceladoEm: '2026-09-10' },
    { valor: 200, valorPago: 200, status: 'Pago' },
  ])

  assert.deepEqual(resumo, {
    quantidade: 1,
    valorPrevisto: 200,
    valorPago: 200,
    saldo: 0,
  })
})
