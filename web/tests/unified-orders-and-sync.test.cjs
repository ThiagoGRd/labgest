/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const vm = require('node:vm')
const ts = require('typescript')

const root = path.resolve(__dirname, '../..')

function createLoader(overrides = {}) {
  const cache = new Map()
  function load(name, from = path.join(root, 'web/src/index.ts')) {
    if (name in overrides) return overrides[name]
    let filename
    if (name === '@labgest/shared') filename = path.join(root, 'packages/shared/src/index.ts')
    else if (name.startsWith('@/')) filename = path.join(root, 'web/src', name.slice(2))
    else if (name.startsWith('.')) filename = path.resolve(path.dirname(from), name)
    else return require(require.resolve(name, { paths: [root + '/web', root] }))

    if (!fs.existsSync(filename)) {
      filename = ['.ts', '.tsx', '.js', '/index.ts'].map((ext) => filename + ext).find(fs.existsSync)
    }
    assert.ok(filename, `Missing module ${name} from ${from}`)
    if (cache.has(filename)) return cache.get(filename)

    const exports = {}
    cache.set(filename, exports)
    const source = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
      compilerOptions: {
        target: ts.ScriptTarget.ES2020,
        module: ts.ModuleKind.CommonJS,
        jsx: ts.JsxEmit.ReactJSX,
        esModuleInterop: true,
      },
    }).outputText

    vm.runInNewContext(
      source,
      {
        exports,
        require: (dep) => load(dep, filename),
        Date,
        Intl,
        console,
        process: { env: {} },
        Array,
        Set,
        Map,
        Object,
        JSON,
      },
      { filename },
    )
    return exports
  }
  return load
}

function futureDateIso(daysAhead = 15) {
  const d = new Date()
  d.setDate(d.getDate() + daysAhead)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

test('createBatchOrdens unifica Superior + Inferior em 1 única OS preservando itensCaso e fluxo principal', async () => {
  const createdOrders = []
  const createdItems = []
  const revalidated = []

  const prismaMock = {
    cliente: {
      findUnique: async ({ where }) => ({ id: where.id, nome: 'Clínica Sorriso' }),
    },
    servico: {
      findMany: async () => [
        { id: 10, nome: 'Prótese Total', preco: 850, tipoWorkflow: 'protese_total_removivel', ativo: true },
        { id: 20, nome: 'Prótese Protocolo', preco: 2400, tipoWorkflow: 'protocolo_definitivo', ativo: true },
      ],
    },
    ordem: {
      create: async ({ data }) => {
        const created = { id: 501, ...data }
        createdOrders.push(created)
        return created
      },
    },
    itemOrdem: {
      createMany: async ({ data }) => {
        createdItems.push(...data)
        return { count: data.length }
      },
    },
  }

  const load = createLoader({
    '@labgest/database': { prisma: prismaMock },
    'next/cache': { revalidatePath: (p) => revalidated.push(p) },
    '@/lib/auth-utils': { requireUser: async () => ({ email: 'admin@labgest.local', tipo: 'Administrador' }) },
    '@/lib/finalizacao-ordem': { garantirEfeitosFinalizacao: async () => {} },
    '@/lib/exclusao-ordem': { validarExclusaoOrdem: () => ({ permitida: true }) },
  })

  const { createBatchOrdens } = load('@/actions/ordens')
  const res = await createBatchOrdens({
    clienteId: '1',
    paciente: 'Maria das Dores',
    cpfPaciente: '52998224725',
    dataEntrega: futureDateIso(15),
    prioridade: 'Alta',
    observacoes: 'PT superior + Protocolo inferior juntos',
    unificarEmUnicaOs: true,
    itens: [
      { servicoId: '10', arcada: 'Superior', elementos: '16-26', corDentes: 'A2', material: 'Acrílico' },
      { servicoId: '20', arcada: 'Inferior', elementos: '36-46', corDentes: 'A2', material: 'Resina' },
    ],
  })

  assert.equal(res.success, true)
  assert.equal(res.ordemId, 501)
  assert.equal(createdOrders.length, 1, 'Deve gerar exatamente 1 OS unificada')
  assert.equal(createdOrders[0].valor, 3250)
  assert.equal(createdOrders[0].valorFinal, 3250)
  assert.equal(createdOrders[0].arcadas, 2)
  assert.equal(createdOrders[0].tipoWorkflow, 'protocolo_definitivo')
  assert.match(createdOrders[0].servicoNome, /Prótese Total \(Superior\)/)
  assert.match(createdOrders[0].servicoNome, /Prótese Protocolo \(Inferior\)/)
  assert.equal(createdOrders[0].checklistEstetico.itensCaso.length, 2)
  assert.equal(createdItems.length, 2)
  assert.ok(revalidated.includes('/lab-interno'))
  assert.ok(revalidated.includes('/ordens'))
})

test('createBatchOrdens com anexarOrdemId anexa novo serviço/arcada à OS existente preservando ficha clínica', async () => {
  let updatedData = null
  const createdItems = []

  const existente = {
    id: 300,
    clienteId: 1,
    clienteNome: 'Clínica Sorriso',
    servicoId: 10,
    servicoNome: 'Prótese Total (Superior)',
    nomePaciente: 'João Silva',
    cpfPaciente: '52998224725',
    status: 'Em Produção',
    etapaAtual: 'confeccao',
    valor: 900,
    valorFinal: 900,
    arcadas: 1,
    elementos: '16-26',
    corDentes: 'A2',
    material: 'Acrílico',
    observacoes: 'Obs inicial',
    arquivoStl: ['sup.stl'],
    tipoWorkflow: 'protese_total_removivel',
    checklistEstetico: {
      corGengiva: 'Rosa médio',
      itensCaso: [
        { servicoId: 10, servicoNome: 'Prótese Total', arcada: 'Superior', elementos: '16-26', corDentes: 'A2', material: 'Acrílico', tipoProtese: 'protese_total_removivel', valor: 900 },
      ],
    },
    historicoEtapas: [{ etapa: 'recebimento', acao: 'criou', data: '2026-11-01T10:00:00Z' }],
  }

  const txMock = {
    $queryRaw: async () => [],
    ordem: {
      findUnique: async () => existente,
      update: async ({ data }) => {
        updatedData = data
        return { ...existente, ...data }
      },
    },
  }

  const prismaMock = {
    cliente: { findUnique: async () => ({ id: 1, nome: 'Clínica Sorriso' }) },
    servico: { findMany: async () => [{ id: 11, nome: 'Prótese Total', preco: 900, tipoWorkflow: 'protese_total_removivel', ativo: true }] },
    itemOrdem: {
      createMany: async ({ data }) => {
        createdItems.push(...data)
        return { count: data.length }
      },
    },
    $transaction: async (fn) => fn(txMock),
  }

  const load = createLoader({
    '@labgest/database': { prisma: prismaMock },
    'next/cache': { revalidatePath: () => {} },
    '@/lib/auth-utils': { requireUser: async () => ({ email: 'recepcao@labgest.local', tipo: 'Administrador' }) },
    '@/lib/finalizacao-ordem': { garantirEfeitosFinalizacao: async () => {} },
    '@/lib/exclusao-ordem': { validarExclusaoOrdem: () => ({ permitida: true }) },
  })

  const { createBatchOrdens } = load('@/actions/ordens')
  const res = await createBatchOrdens({
    clienteId: '1',
    paciente: 'João Silva',
    cpfPaciente: '52998224725',
    dataEntrega: futureDateIso(12),
    prioridade: 'Normal',
    observacoes: 'Anexar inferior',
    anexarOrdemId: 300,
    arquivos: ['inf.stl'],
    itens: [
      { servicoId: '11', arcada: 'Inferior', elementos: '36-46', corDentes: 'A2', material: 'Acrílico' },
    ],
  })

  assert.equal(res.success, true)
  assert.equal(res.ordemId, 300)
  assert.ok(updatedData)
  assert.equal(updatedData.valor, 1800)
  assert.equal(updatedData.valorFinal, 1800)
  assert.equal(updatedData.arcadas, 2)
  assert.equal(updatedData.checklistEstetico.corGengiva, 'Rosa médio')
  assert.equal(updatedData.checklistEstetico.itensCaso.length, 2)
  assert.deepEqual([...updatedData.arquivoStl], ['sup.stl', 'inf.stl'])
  assert.equal(updatedData.historicoEtapas.at(-1).acao, 'anexou_servicos_na_os')
  assert.equal(createdItems.length, 1)
})

test('detectarOrdensDuplicadas agrupa ordens ativas do mesmo paciente e unificarOrdensDuplicadas consolida tudo na principal', async () => {
  const ordemUpdates = []
  const contaMoves = []
  const cicloMoves = []
  const deletedVinculos = []
  const resolvedAlertas = []
  const revalidated = []

  const ordem10 = {
    id: 10,
    nomePaciente: 'Carlos Pereira',
    cpfPaciente: '52998224725',
    clienteId: 3,
    clienteNome: 'Clínica Alpha',
    servicoId: 1,
    servicoNome: 'Prótese Total Superior',
    status: 'Em Produção',
    valor: 800,
    valorFinal: 800,
    arcadas: 1,
    elementos: 'Superior',
    corDentes: 'A1',
    material: 'Acrílico',
    observacoes: 'Sup',
    arquivoStl: ['a.stl'],
    fotosCaso: [],
    dataEntrega: new Date('2026-11-28T00:00:00Z'),
    tipoWorkflow: 'protese_total_removivel',
    passoFluxoAtual: 'montagem_dentes',
    etapaAtual: 'confeccao',
    checklistEstetico: { corDentes: 'A1' },
    historicoEtapas: [],
  }
  const ordem11 = {
    id: 11,
    nomePaciente: 'Carlos Pereira',
    cpfPaciente: '52998224725',
    clienteId: 3,
    clienteNome: 'Clínica Alpha',
    servicoId: 2,
    servicoNome: 'Prótese Protocolo Inferior',
    status: 'Aguardando',
    valor: 2200,
    valorFinal: 2200,
    arcadas: 1,
    elementos: 'Inferior',
    corDentes: 'A1',
    material: 'Zircônia',
    observacoes: 'Inf',
    arquivoStl: ['b.stl'],
    fotosCaso: ['foto1.jpg'],
    dataEntrega: new Date('2026-11-28T00:00:00Z'),
    tipoWorkflow: 'protocolo_definitivo',
    passoFluxoAtual: null,
    etapaAtual: 'recebimento',
    checklistEstetico: null,
    historicoEtapas: [],
  }

  const txMock = {
    $queryRaw: async () => [],
    ordem: {
      findMany: async () => [ordem10, ordem11],
      update: async (args) => {
        ordemUpdates.push(args)
        return args.data
      },
    },
    contaReceber: {
      updateMany: async (args) => {
        contaMoves.push(args)
        return { count: 1 }
      },
    },
    cicloProducao: {
      count: async () => 1,
      findMany: async () => [{ id: 88, ordemId: 11, numeroCiclo: 1 }],
      update: async (args) => {
        cicloMoves.push(args)
        return args.data
      },
    },
    tratamentoVinculo: {
      findUnique: async () => null,
      findFirst: async () => ({ id: 9, ordemId: 11, pacienteChave: 'carlos pereira', pacienteNome: 'Carlos Pereira' }),
      create: async () => ({ id: 10 }),
      deleteMany: async (args) => {
        deletedVinculos.push(args)
        return { count: 1 }
      },
    },
    alertaTratamento: {
      updateMany: async (args) => {
        resolvedAlertas.push(args)
        return { count: 1 }
      },
    },
  }

  const prismaMock = {
    ordem: {
      findMany: async () => [ordem10, ordem11],
    },
    $transaction: async (fn) => fn(txMock),
  }

  const load = createLoader({
    '@labgest/database': { prisma: prismaMock },
    'next/cache': { revalidatePath: (p) => revalidated.push(p) },
    '@/lib/auth-utils': { requireUser: async () => ({ email: 'admin@labgest.local', tipo: 'Administrador' }) },
    '@/lib/finalizacao-ordem': { garantirEfeitosFinalizacao: async () => {} },
    '@/lib/exclusao-ordem': { validarExclusaoOrdem: () => ({ permitida: true }) },
  })

  const { detectarOrdensDuplicadas, unificarOrdensDuplicadas } = load('@/actions/ordens')
  const grupos = await detectarOrdensDuplicadas()
  assert.equal(grupos.length, 1)
  assert.equal(grupos[0].ordemPrincipalId, 10)
  assert.deepEqual([...grupos[0].ordensSecundariasIds], [11])
  assert.equal(grupos[0].valorTotal, 3000)

  const res = await unificarOrdensDuplicadas(10, [11])
  assert.equal(res.success, true)
  assert.equal(res.principalId, 10)
  assert.equal(res.unificadas, 1)

  const updPrincipal = ordemUpdates.find((u) => u.where.id === 10)
  assert.ok(updPrincipal)
  assert.equal(updPrincipal.data.valorFinal, 3000)
  assert.equal(updPrincipal.data.arcadas, 2)
  assert.equal(updPrincipal.data.checklistEstetico.itensCaso.length, 2)
  assert.deepEqual([...updPrincipal.data.arquivoStl], ['a.stl', 'b.stl'])
  assert.deepEqual([...updPrincipal.data.fotosCaso], ['foto1.jpg'])

  const updSecundaria = ordemUpdates.find((u) => u.where.id === 11)
  assert.equal(updSecundaria.data.status, 'Cancelado')
  assert.equal(updSecundaria.data.motivoCancelamento, 'Unificada na OS #10')

  assert.equal(contaMoves[0].data.ordemId, 10)
  assert.equal(cicloMoves[0].data.ordemId, 10)
  assert.equal(cicloMoves[0].data.numeroCiclo, 2)
  assert.equal(deletedVinculos.length, 1)
  assert.equal(resolvedAlertas.length, 1)
  assert.ok(revalidated.includes('/lab-interno'))
  assert.ok(revalidated.includes('/ordens'))
})

test('aplicarEtapaClinicorpNaOrdem e sincronizarEtapasClinicorpLab atualizam etapa com lock transacional e validam regras', async () => {
  const ordemUpdates = []
  const revalidated = []
  let passoAtualOrdem = 'montagem_dentes'
  let statusOrdem = 'Em Produção'

  const ordemBase = {
    id: 77,
    nomePaciente: 'Fernanda Costa',
    servicoNome: 'Prótese Total Superior',
    tipoWorkflow: 'protese_total_removivel',
    get passoFluxoAtual() {
      return passoAtualOrdem
    },
    get status() {
      return statusOrdem
    },
    etapaAtual: 'confeccao',
    subetapaAtual: 'Montagem dos dentes',
    dataPedido: new Date('2026-11-01T10:00:00Z'),
    localizacaoAtual: 'laboratorio',
    situacaoLogistica: 'no_laboratorio',
    arcadas: 1,
    historicoEtapas: [],
  }

  const txMock = {
    $queryRaw: async () => [],
    ordem: {
      findUnique: async () => ({ ...ordemBase }),
      update: async ({ data }) => {
        ordemUpdates.push(data)
        passoAtualOrdem = data.passoFluxoAtual
        return { ...ordemBase, ...data }
      },
    },
  }

  const prismaMock = {
    ordem: {
      findUnique: async () => ({ ...ordemBase }),
    },
    tratamentoVinculo: {
      findMany: async () => [],
    },
    clinicorpConsulta: {
      findMany: async () => [
        {
          clinicorpId: 'c-900',
          pacienteChave: 'fernanda costa',
          data: new Date('2026-11-12T00:00:00Z'),
          horaInicio: '14:00',
          status: 'compareceu',
          dentistaNome: 'Dra. Juliana',
          dentistaId: null,
          categoria: 'Prova dos dentes',
          observacoes: 'Prova estética aprovada pela paciente',
          contaManual: false,
        },
      ],
    },
    $transaction: async (fn) => fn(txMock),
  }

  const load = createLoader({
    '@labgest/database': { prisma: prismaMock },
    'next/cache': { revalidatePath: (p) => revalidated.push(p) },
    '@/lib/auth-utils': { requireUser: async () => ({ email: 'lab@labgest.local', tipo: 'Administrador' }) },
    '@/lib/finalizacao-ordem': { garantirEfeitosFinalizacao: async () => {} },
    '@/lib/clinicorp': { clinicorpConfigurado: () => true },
    '@/actions/producao': { getProducao: async () => [] },
    '@/actions/triagem-whatsapp': { listarTriagemWhatsappOs: async () => [] },
    '@/lib/controle-tratamentos': {
      sincronizarClinicorp: async () => ({ sucesso: true, consultas: 14, etapasAtualizadas: 3 }),
    },
  })

  const { aplicarEtapaClinicorpNaOrdem, sincronizarEtapasClinicorpLab } = load('@/actions/lab-interno')
  const res = await aplicarEtapaClinicorpNaOrdem(77)
  assert.equal(res.success, true)
  assert.equal(res.etapa, 'Acrilização')
  assert.equal(ordemUpdates.length, 1)
  assert.equal(ordemUpdates[0].passoFluxoAtual, 'acrilizacao')
  assert.equal(ordemUpdates[0].historicoEtapas.at(-1).acao, 'sincronizou_etapa_clinicorp')

  // Tentar aplicar novamente quando já está na mesma etapa deve informar sem erro destrutivo
  const resRepetida = await aplicarEtapaClinicorpNaOrdem(77)
  assert.equal(resRepetida.success, false)
  assert.match(resRepetida.error, /já se encontra nesta etapa/i)

  // Ordem pausada deve bloquear
  statusOrdem = 'Pausado'
  const resPausada = await aplicarEtapaClinicorpNaOrdem(77)
  assert.equal(resPausada.success, false)
  assert.match(resPausada.error, /encerrada ou pausada/i)

  // Sincronização manual revalida as rotas principais
  const syncRes = await sincronizarEtapasClinicorpLab()
  assert.equal(syncRes.sucesso, true)
  assert.equal(syncRes.etapasAtualizadas, 3)
  assert.ok(revalidated.includes('/lab-interno'))
  assert.ok(revalidated.includes('/ordens'))
  assert.ok(revalidated.includes('/dashboard'))
})
