import assert from 'node:assert/strict'
import test from 'node:test'
import type { Prisma } from '@labgest/database'
import { garantirEfeitosFinalizacao } from './finalizacao-ordem'

function criarTransacao(contasReceber: Array<{ id: number }> = []) {
  const contasCriadas: unknown[] = []
  const atualizacoesOrdem: unknown[] = []
  let consultaOrdem: unknown

  const tx = {
    ordem: {
      findUnique: async (consulta: unknown) => {
        consultaOrdem = consulta
        return {
          id: 42,
          servicoNome: 'Prótese total',
          nomePaciente: 'Paciente teste',
          clienteId: 7,
          clienteNome: 'Clínica teste',
          valorFinal: 350,
          servico: { materiais: [] },
          contasReceber,
        }
      },
      updateMany: async () => ({ count: 1 }),
      update: async (dados: unknown) => {
        atualizacoesOrdem.push(dados)
        return {}
      },
    },
    estoque: { findUnique: async () => null, update: async () => ({}) },
    movimentacaoEstoque: { create: async () => ({}) },
    contaReceber: {
      create: async (dados: unknown) => {
        contasCriadas.push(dados)
        return {}
      },
    },
  } as unknown as Prisma.TransactionClient

  return { tx, contasCriadas, atualizacoesOrdem, getConsultaOrdem: () => consultaOrdem }
}

test('cria a conta a receber e registra a cobrança na finalização', async () => {
  const contexto = criarTransacao()
  const finalizadaEm = new Date(2026, 9, 1, 10, 30)

  await garantirEfeitosFinalizacao(contexto.tx, 42, finalizadaEm)

  assert.equal(contexto.contasCriadas.length, 1)
  assert.deepEqual(contexto.atualizacoesOrdem.at(-1), {
    where: { id: 42 },
    data: { cobrancaGeradaEm: finalizadaEm },
  })
})

test('não duplica uma conta a receber ativa', async () => {
  const contexto = criarTransacao([{ id: 10 }])

  await garantirEfeitosFinalizacao(contexto.tx, 42)

  assert.equal(contexto.contasCriadas.length, 0)
})

test('ignora contas canceladas ao verificar se já existe cobrança', async () => {
  const contexto = criarTransacao()

  await garantirEfeitosFinalizacao(contexto.tx, 42)

  assert.deepEqual(contexto.getConsultaOrdem(), {
    where: { id: 42 },
    include: {
      servico: { select: { materiais: true } },
      contasReceber: {
        where: { status: { not: 'Cancelado' } },
        select: { id: true },
        take: 1,
      },
    },
  })
})
