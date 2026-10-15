import test from 'node:test'
import assert from 'node:assert/strict'
import {
  dataRetornoPara,
  descreverPrazo,
  diasEntre,
  hojeIso,
  isSituacao,
  prazoSugerido,
  resumirLaboratorio,
  somarDias,
  type PedidoParaResumo,
} from './labs-externos-utils'

test('sugere o prazo somando 15 dias ao envio, inclusive na virada de mês e de ano', () => {
  assert.equal(prazoSugerido('2026-10-15'), '2026-10-30')
  assert.equal(prazoSugerido('2026-10-20'), '2026-11-04')
  assert.equal(prazoSugerido('2026-12-25'), '2027-01-09')
  assert.equal(somarDias('2026-03-01', -1), '2026-02-28')
})

test('calcula dias corridos entre datas e ignora datas ausentes', () => {
  assert.equal(diasEntre('2026-10-01', '2026-10-16'), 15)
  assert.equal(diasEntre(new Date('2026-10-10T00:00:00Z'), '2026-10-08'), -2)
  assert.equal(diasEntre(null, '2026-10-08'), null)
})

test('usa o dia local do laboratório, e não o dia em UTC', () => {
  // 01:00 UTC de 16/10 ainda é 22:00 de 15/10 em Alagoas.
  assert.equal(hojeIso(new Date('2026-10-16T01:00:00Z')), '2026-10-15')
})

test('registra o retorno ao ficar Pronto, preserva a data e limpa ao voltar de etapa', () => {
  assert.equal(dataRetornoPara('Pronto', null, '2026-10-15'), '2026-10-15')
  assert.equal(dataRetornoPara('Entregue', '2026-10-10', '2026-10-15'), '2026-10-10')
  assert.equal(dataRetornoPara('Provando', '2026-10-10', '2026-10-15'), null)
  assert.equal(dataRetornoPara('Enviado', '2026-10-10', '2026-10-15'), null)
})

test('valida a situação do pedido', () => {
  assert.equal(isSituacao('Pronto'), true)
  assert.equal(isSituacao('pronto'), false)
  assert.equal(isSituacao(undefined), false)
})

test('resume o desempenho do laboratório na janela de 90 dias', () => {
  const hoje = '2026-10-15'
  const pedidos: PedidoParaResumo[] = [
    // entregue no prazo (retorno em 14 dias, prazo de 15)
    { situacao: 'Entregue', dataEnvio: '2026-09-01', prazo: '2026-09-16', dataRetorno: '2026-09-15', isRetrabalho: false },
    // entregue com atraso (retorno em 20 dias, prazo de 15) e retrabalho
    { situacao: 'Entregue', dataEnvio: '2026-09-10', prazo: '2026-09-25', dataRetorno: '2026-09-30', isRetrabalho: true },
    // em aberto e atrasado
    { situacao: 'Enviado', dataEnvio: '2026-09-20', prazo: '2026-10-05', dataRetorno: null, isRetrabalho: false },
    // em aberto dentro do prazo
    { situacao: 'Provando', dataEnvio: '2026-10-10', prazo: '2026-10-25', dataRetorno: null, isRetrabalho: false },
    // antigo: fora da janela, mas ainda em aberto e atrasado
    { situacao: 'Enviado', dataEnvio: '2026-04-01', prazo: '2026-04-16', dataRetorno: null, isRetrabalho: false },
  ]

  assert.deepEqual(resumirLaboratorio(pedidos, hoje), {
    totalPedidos: 4,
    emAberto: 3,
    atrasados: 2,
    retrabalhos: 1,
    taxaRetrabalho: 25,
    prazoCombinadoMedio: 15,
    retornoMedio: 17,
    taxaNoPrazo: 50,
    comRetorno: 2,
  })
})

test('não inventa indicadores quando ainda não há dados', () => {
  const resumo = resumirLaboratorio([], '2026-10-15')
  assert.equal(resumo.totalPedidos, 0)
  assert.equal(resumo.taxaRetrabalho, null)
  assert.equal(resumo.retornoMedio, null)
  assert.equal(resumo.taxaNoPrazo, null)
})

test('descreve o prazo em linguagem simples', () => {
  const hoje = '2026-10-15'
  assert.deepEqual(descreverPrazo('2026-10-12', hoje), { texto: '3 dias de atraso', tom: 'atrasado' })
  assert.deepEqual(descreverPrazo('2026-10-14', hoje), { texto: '1 dia de atraso', tom: 'atrasado' })
  assert.deepEqual(descreverPrazo('2026-10-15', hoje), { texto: 'Vence hoje', tom: 'hoje' })
  assert.deepEqual(descreverPrazo('2026-10-16', hoje), { texto: 'Vence amanhã', tom: 'proximo' })
  assert.deepEqual(descreverPrazo('2026-10-18', hoje), { texto: 'Vence em 3 dias', tom: 'proximo' })
  assert.deepEqual(descreverPrazo('2026-10-25', hoje), { texto: 'Vence em 10 dias', tom: 'ok' })
  assert.deepEqual(descreverPrazo(null, hoje), { texto: 'Sem prazo definido', tom: 'neutro' })
})
