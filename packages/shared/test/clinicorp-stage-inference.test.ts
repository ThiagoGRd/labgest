import test from 'node:test'
import assert from 'node:assert/strict'
import {
  agruparOrdensDuplicadas,
  escolherFluxoPrincipal,
  inferirEtapaClinicorp,
} from '../src/clinicorp-stage-inference'

test('inferirEtapaClinicorp detecta etapa pela categoria/notas da última consulta realizada', () => {
  const resultado = inferirEtapaClinicorp({
    tipoWorkflow: 'protese_total_removivel',
    passoFluxoAtual: 'moldagem_estudo',
    dataPedido: '2026-11-01',
    hoje: '2026-11-15',
    consultas: [
      {
        id: '1',
        data: '2026-11-05',
        hora: '09:00',
        status: 'compareceu',
        categoria: 'Moldagem de trabalho',
        observacoes: 'Moldeira individual ajustada',
        dentista: 'Dr. João',
      },
      {
        id: '2',
        data: '2026-11-12',
        hora: '14:00',
        status: 'compareceu',
        categoria: 'Prótese',
        observacoes: 'Prova do plano de orientação concluída, DVO definida',
        dentista: 'Dr. João',
      },
      {
        id: '3',
        data: '2026-11-20',
        hora: '10:00',
        status: 'agendado',
        categoria: 'Prova dos dentes',
        observacoes: null,
        dentista: 'Dr. João',
      },
    ],
  })

  assert.equal(resultado.confianca, 'alta')
  assert.equal(resultado.passoSugeridoId, 'montagem_dentes')
  assert.equal(resultado.divergente, true)
  assert.equal(resultado.consultasRealizadas, 2)
  assert.equal(resultado.proximaConsulta?.data, '2026-11-20')
})

test('inferirEtapaClinicorp usa contagem de consultas quando não há palavra-chave explícita', () => {
  const resultado = inferirEtapaClinicorp({
    tipoWorkflow: 'protocolo_definitivo',
    passoFluxoAtual: 'escaneamento_digital',
    dataPedido: '2026-11-01',
    hoje: '2026-11-15',
    consultas: [
      {
        id: '10',
        data: '2026-11-02',
        hora: '08:00',
        status: 'compareceu',
        categoria: 'Atendimento clínico',
        observacoes: 'Paciente compareceu',
        dentista: 'Dra. Ana',
      },
    ],
  })

  assert.equal(resultado.confianca, 'media')
  assert.equal(resultado.passoSugeridoId, 'planejamento_digital')
  assert.equal(resultado.divergente, true)
})

test('agruparOrdensDuplicadas detecta Superior + Inferior e Total + Protocolo do mesmo paciente', () => {
  const grupos = agruparOrdensDuplicadas([
    {
      id: 101,
      nomePaciente: 'Maria José da Silva',
      cpfPaciente: '12345678901',
      clienteId: 5,
      clienteNome: 'Clínica Sorriso',
      servicoNome: 'Prótese Total Removível',
      status: 'Em Produção',
      valor: 850,
      elementos: 'Superior',
      dataEntrega: '2026-11-20',
      passoFluxoAtual: 'montagem_dentes',
    },
    {
      id: 102,
      nomePaciente: 'Maria Jose da Silva',
      cpfPaciente: '123.456.789-01',
      clienteId: 5,
      clienteNome: 'Clínica Sorriso',
      servicoNome: 'Prótese Protocolo',
      status: 'Aguardando',
      valor: 1600,
      elementos: 'Inferior',
      dataEntrega: '2026-11-25',
      passoFluxoAtual: null,
    },
    {
      id: 103,
      nomePaciente: 'Maria José da Silva',
      cpfPaciente: '12345678901',
      clienteId: 5,
      clienteNome: 'Clínica Sorriso',
      servicoNome: 'Placa Bruxismo',
      status: 'Entregue',
      valor: 300,
      dataEntrega: '2026-10-10',
      passoFluxoAtual: 'entrega_clinica',
    },
  ])

  assert.equal(grupos.length, 1)
  assert.equal(grupos[0].ordemPrincipalId, 101)
  assert.deepEqual(grupos[0].ordensSecundariasIds, [102])
  assert.equal(grupos[0].valorTotal, 2450)
  assert.match(grupos[0].servicoCombinado, /Prótese Total Removível \(Superior\)/)
  assert.match(grupos[0].servicoCombinado, /Prótese Protocolo \(Inferior\)/)
})

test('escolherFluxoPrincipal prioriza protocolo definitivo sobre total removível', () => {
  assert.equal(
    escolherFluxoPrincipal(['protese_total_removivel', 'protocolo_definitivo']),
    'protocolo_definitivo',
  )
})
