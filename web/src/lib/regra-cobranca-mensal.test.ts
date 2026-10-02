import assert from 'node:assert/strict'
import test from 'node:test'
import { resumirCobrancasMensais } from './regra-cobranca-mensal'

test('mantém o valor integral previsto e separa recebido e saldo', () => {
  const resumo = resumirCobrancasMensais([
    { valor: 120, valorRecebido: 120, status: 'Recebido' },
    { valor: 350, valorRecebido: 0, status: 'Pendente' },
    { valor: 260, valorRecebido: 60, status: 'Parcial' },
  ])

  assert.deepEqual(resumo, {
    quantidade: 3,
    valorPrevisto: 730,
    valorRecebido: 180,
    saldo: 550,
  })
})

test('exclui cobranças canceladas da competência mensal', () => {
  const resumo = resumirCobrancasMensais([
    { valor: 200, valorRecebido: 0, status: 'Cancelado' },
    { valor: 300, valorRecebido: 0, status: 'Pendente', canceladoEm: new Date() },
    { valor: 150, valorRecebido: 0, status: 'Pendente' },
  ])

  assert.equal(resumo.quantidade, 1)
  assert.equal(resumo.valorPrevisto, 150)
  assert.equal(resumo.saldo, 150)
})
