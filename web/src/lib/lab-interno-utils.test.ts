import test from 'node:test'
import assert from 'node:assert/strict'
import { contarPorEtapa, resumirDesempenho, type OrdemFinalizada } from './lab-interno-utils'

test('resume o desempenho das ordens finalizadas na janela de 90 dias', () => {
  const hoje = '2026-10-16'
  const ordens: OrdemFinalizada[] = [
    // no prazo, 10 dias de produção
    { dataPedido: '2026-09-01', dataEntrega: '2026-09-15', dataFinalizacao: '2026-09-11', ciclos: 1 },
    // atrasada, 20 dias, com duas provas
    { dataPedido: '2026-09-01', dataEntrega: '2026-09-15', dataFinalizacao: '2026-09-21', ciclos: 2 },
    // fora da janela
    { dataPedido: '2026-03-01', dataEntrega: '2026-03-15', dataFinalizacao: '2026-03-20', ciclos: 3 },
    // sem data de finalização: ignorada
    { dataPedido: '2026-10-01', dataEntrega: '2026-10-20', dataFinalizacao: null, ciclos: 0 },
  ]
  assert.deepEqual(resumirDesempenho(ordens, hoje), {
    finalizadas: 2,
    taxaNoPrazo: 50,
    tempoMedio: 15,
    comMaisDeUmaProva: 1,
    taxaMaisDeUmaProva: 50,
  })
})

test('não inventa indicadores quando não há ordens finalizadas', () => {
  const resumo = resumirDesempenho([], '2026-10-16')
  assert.equal(resumo.finalizadas, 0)
  assert.equal(resumo.taxaNoPrazo, null)
  assert.equal(resumo.tempoMedio, null)
  assert.equal(resumo.taxaMaisDeUmaProva, null)
})

test('conta ordens por etapa mantendo a sequência e as etapas vazias', () => {
  const contagem = contarPorEtapa(['a', 'b', 'c'] as const, ['b', 'b', 'a'])
  assert.deepEqual(contagem, { a: 1, b: 2, c: 0 })
})
