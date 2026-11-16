/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const fs = require('node:fs')
const esbuild = require(require.resolve('esbuild', { paths: [path.resolve(__dirname, '..'), path.resolve(__dirname, '../..')] }))

const webRoot = path.resolve(__dirname, '..')

async function carregarModuloAgendaTv() {
  const build = await esbuild.build({
    entryPoints: [path.join(webRoot, 'src/lib/agenda-tv.ts')],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    plugins: [
      {
        name: 'alias-web',
        setup(b) {
          b.onResolve({ filter: /^@\// }, (args) => {
            const base = path.join(webRoot, 'src', args.path.slice(2))
            const found = ['.ts', '.tsx', '/index.ts'].map((ext) => base + ext).find((p) => fs.existsSync(p))
            return { path: found || base }
          })
          b.onResolve({ filter: /^@labgest\/shared$/ }, () => ({
            path: path.resolve(webRoot, '../packages/shared/src/index.ts'),
          }))
        },
      },
    ],
  })

  const mod = { exports: {} }
  const fn = new Function('require', 'module', 'exports', build.outputFiles[0].text)
  fn(require, mod, mod.exports)
  return mod.exports
}

test('normalizarProteticoId aceita Tavá, tava, Otávio e Napoleão', async () => {
  const tv = await carregarModuloAgendaTv()
  assert.equal(tv.normalizarProteticoId('Tavá'), 'otavio')
  assert.equal(tv.normalizarProteticoId(' tava '), 'otavio')
  assert.equal(tv.normalizarProteticoId('Otávio'), 'otavio')
  assert.equal(tv.normalizarProteticoId(' otavio '), 'otavio')
  assert.equal(tv.normalizarProteticoId('NAPOLEÃO'), 'napoleao')
  assert.equal(tv.normalizarProteticoId('napoleao'), 'napoleao')
  assert.equal(tv.normalizarProteticoId('outro'), null)
})

test('sugerirBlocosEtapa divide acrilização entre bancada ativa e panela passiva quando habilitado', async () => {
  const tv = await carregarModuloAgendaTv()
  const blocos = tv.sugerirBlocosEtapa({
    etapaNome: 'Acrilização',
    horaInicioBase: '10:00',
    dividirAcrilizacao: true,
  })
  assert.equal(blocos.length, 3)
  assert.equal(blocos[0].horaInicio, '10:00')
  assert.equal(blocos[0].horaFim, '10:35')
  assert.equal(blocos[0].modo, 'bancada')

  assert.equal(blocos[1].horaInicio, '10:35')
  assert.equal(blocos[1].horaFim, '11:50')
  assert.equal(blocos[1].modo, 'maquina')
  assert.equal(blocos[1].equipamento, 'Panela Térmica 1')

  assert.equal(blocos[2].horaInicio, '11:50')
  assert.equal(blocos[2].horaFim, '12:25')
  assert.equal(blocos[2].modo, 'bancada')

  const montagemDupla = tv.sugerirBlocosEtapa({
    etapaNome: 'Montagem de dentes',
    arcadas: 2,
    horaInicioBase: '09:00',
  })
  assert.equal(montagemDupla.length, 1)
  assert.equal(montagemDupla[0].horaInicio, '09:00')
  assert.equal(montagemDupla[0].horaFim, '11:00')
})

test('calcularRiscoClinicorp alerta quando consulta está muito próxima ou anterior ao fim do bloco', async () => {
  const tv = await carregarModuloAgendaTv()
  assert.equal(
    tv.calcularRiscoClinicorp(
      { data: '2026-11-16', horaFim: '14:00', status: 'agendado' },
      { data: '2026-11-16', hora: '14:30' },
    ),
    true,
  )
  assert.equal(
    tv.calcularRiscoClinicorp(
      { data: '2026-11-16', horaFim: '14:00', status: 'agendado' },
      { data: '2026-11-16', hora: '16:00' },
    ),
    false,
  )
  assert.equal(
    tv.calcularRiscoClinicorp(
      { data: '2026-11-16', horaFim: '14:00', status: 'concluido' },
      { data: '2026-11-16', hora: '14:15' },
    ),
    false,
  )
})

test('resumirBancadaProtetico destaca bloco em bancada, máquina pronta e backlog fallback', async () => {
  const tv = await carregarModuloAgendaTv()
  const hoje = '2026-11-16'
  const blocos = [
    {
      id: 1,
      ordemId: 101,
      protetico: 'otavio',
      data: hoje,
      horaInicio: '09:00',
      horaFim: '10:00',
      etapaNome: 'Montagem de dentes',
      modo: 'bancada',
      status: 'em_andamento',
      paciente: 'Rita de Cássia',
      servico: 'Prótese total',
      atualizadoEm: '2026-11-16T09:00:00Z',
      clinicorpConsultaLabel: 'Hoje 15:00',
      riscoClinicorp: false,
      prioridadeOrdem: 'Normal',
      diasVencidosTotal: 0,
      cicloObs: null,
      cicloDentistaDeci: null,
    },
    {
      id: 2,
      ordemId: 102,
      protetico: 'otavio',
      data: hoje,
      horaInicio: '08:30',
      horaFim: '09:45',
      etapaNome: 'Acrilização · Polimerização',
      modo: 'maquina',
      status: 'em_andamento',
      paciente: 'João Silva',
      servico: 'Protocolo',
      equipamento: 'Panela Térmica 1',
      atualizadoEm: '2026-11-16T08:30:00Z',
      clinicorpConsultaLabel: null,
      riscoClinicorp: false,
      prioridadeOrdem: 'Normal',
      diasVencidosTotal: 0,
      cicloObs: null,
      cicloDentistaDeci: null,
    },
  ]

  const ordensNoLab = [
    {
      id: 101,
      paciente: 'Rita de Cássia',
      dentista: 'Dr. Marcos',
      servico: 'Prótese total',
      status: 'Em Produção',
      updatedAt: '2026-11-16T09:00:00Z',
      etapa: 'confeccao',
      prioridade: 'Normal',
      entrega: '2026-11-18T18:00:00Z',
    },
    {
      id: 205,
      paciente: 'Ana Beatriz',
      dentista: 'Dra. Carla',
      servico: 'Placa Bruxismo',
      status: 'Em Produção',
      updatedAt: '2026-11-16T08:00:00Z',
      etapa: 'confeccao',
      prioridade: 'Urgente',
      entrega: '2026-11-16T18:00:00Z',
    },
  ]

  // Hora atual 09:50 -> Montagem está 50m de 60m (83%); Panela termina às 09:45 -> PRONTA!
  const resumoOtavio = tv.resumirBancadaProtetico({
    protetico: 'otavio',
    blocos,
    ordensNoLab,
    dataReferencia: hoje,
    dataHoje: hoje,
    horaMinAtual: 9 * 60 + 50,
  })

  assert.equal(resumoOtavio.blocoAtual.paciente, 'Rita de Cássia')
  assert.equal(resumoOtavio.blocoAtual.progressoPct, 83)
  assert.equal(resumoOtavio.emMaquina.length, 1)
  assert.equal(resumoOtavio.emMaquina[0].prontoParaRetirar, true)
  assert.equal(resumoOtavio.emMaquina[0].restanteMin, 0)
  // Ordem 101 já está agendada hoje, então backlog traz 205
  assert.deepEqual(
    resumoOtavio.backlog.map((o) => o.id),
    [205],
  )

  // Napoleão sem agenda hoje recebe sugestão automática da fila
  const resumoNapoleao = tv.resumirBancadaProtetico({
    protetico: 'napoleao',
    blocos,
    ordensNoLab,
    dataReferencia: hoje,
    dataHoje: hoje,
    horaMinAtual: 9 * 60 + 50,
  })
  assert.equal(resumoNapoleao.blocoAtual, null)
  assert.equal(resumoNapoleao.sugeridoDaFila.id, 205)
})

test('parseBlocoNotificacao trata JSON válido e ignora registros corrompidos', async () => {
  const tv = await carregarModuloAgendaTv()
  const ok = tv.parseBlocoNotificacao({
    id: 42,
    mensagem: JSON.stringify({
      protetico: 'Napoleão',
      ordemId: 99,
      data: '2026-11-16',
      horaInicio: '10:00',
      horaFim: '12:00',
      etapaNome: 'Acrilização',
      modo: 'maquina',
      status: 'agendado',
      paciente: 'Rita de Cássia',
      servico: 'PT',
    }),
  })
  assert.equal(ok.id, 42)
  assert.equal(ok.protetico, 'napoleao')
  assert.equal(ok.modo, 'maquina')
  assert.equal(tv.parseBlocoNotificacao({ id: 43, mensagem: '{invalido' }), null)
})

test('executarAgendaAutomaticaIa grava em lote (createManyAndReturn), enxuga resposta e captura erros do banco', async () => {
  let batchChamadas = 0
  let erroForcado = null

  const prismaMock = {
    notificacao: {
      findMany: async () => [],
      findFirst: async () => null,
      deleteMany: async () => ({ count: 0 }),
      createManyAndReturn: async ({ data }) => {
        if (erroForcado) throw erroForcado
        batchChamadas += 1
        return data.map((_, idx) => ({ id: 500 + idx }))
      },
      create: async () => ({ id: 999 }),
    },
    clinicorpSincronizacao: {
      findFirst: async () => null,
    },
  }

  const build = await esbuild.build({
    entryPoints: [path.join(webRoot, 'src/actions/agenda-tv.ts')],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    plugins: [
      {
        name: 'agenda-action-mocks',
        setup(b) {
          b.onResolve({ filter: /^@labgest\/database$/ }, () => ({ path: 'db', namespace: 'db' }))
          b.onLoad({ filter: /.*/, namespace: 'db' }, () => ({
            contents: 'module.exports = { prisma: globalThis.__AGENDA_TV_PRISMA_MOCK__ }',
            loader: 'js',
          }))
          b.onResolve({ filter: /^next\/cache$/ }, () => ({ path: 'nc', namespace: 'nc' }))
          b.onLoad({ filter: /.*/, namespace: 'nc' }, () => ({
            contents: 'module.exports = { revalidatePath: () => {} }',
            loader: 'js',
          }))
          b.onResolve({ filter: /^@\/lib\/auth-utils$/ }, () => ({ path: 'au', namespace: 'au' }))
          b.onLoad({ filter: /.*/, namespace: 'au' }, () => ({
            contents: 'module.exports = { requireUser: async () => ({ id: 1 }) }',
            loader: 'js',
          }))
          b.onResolve({ filter: /^@\/actions\/producao$/ }, () => ({ path: 'pr', namespace: 'pr' }))
          b.onLoad({ filter: /.*/, namespace: 'pr' }, () => ({
            contents: `
              module.exports = {
                getProducao: async () => [
                  {
                    id: 701,
                    paciente: 'Rita de Cássia',
                    dentista: 'Dr. Marcos',
                    servico: 'Prótese total',
                    status: 'Em Produção',
                    updatedAt: '2026-11-15T10:00:00Z',
                    etapa: 'confeccao',
                    subetapa: 'Montagem de dentes',
                    prioridade: 'Urgente',
                    entrega: '2026-11-16T18:00:00Z',
                    arcadas: 1,
                    cicloObs: 'Observação pesada',
                    cicloFotos: ['data:image/png;base64,AAAA'],
                    itensCaso: [{ servicoNome: 'PT' }],
                  },
                  {
                    id: 702,
                    paciente: 'Carlos Silva',
                    dentista: 'Dra. Ana',
                    servico: 'PPR Inferior',
                    status: 'Em Produção',
                    updatedAt: '2026-11-15T10:00:00Z',
                    etapa: 'confeccao',
                    subetapa: 'Acrilização',
                    prioridade: 'Alta',
                    entrega: '2026-11-16T18:00:00Z',
                    arcadas: 1,
                  },
                ],
              }
            `,
            loader: 'js',
          }))
          b.onResolve({ filter: /^@\/actions\/workflow-protese$/ }, () => ({ path: 'wf', namespace: 'wf' }))
          b.onLoad({ filter: /.*/, namespace: 'wf' }, () => ({
            contents: 'module.exports = { concluirEtapaLaboratorial: async () => ({ success: true }) }',
            loader: 'js',
          }))
          b.onResolve({ filter: /^@\/lib\/clinicorp-etapas$/ }, () => ({ path: 'ce', namespace: 'ce' }))
          b.onLoad({ filter: /.*/, namespace: 'ce' }, () => ({
            contents: 'module.exports = { carregarInferenciasClinicorpParaOrdens: async () => new Map() }',
            loader: 'js',
          }))
          b.onResolve({ filter: /^@\// }, (args) => {
            const base = path.join(webRoot, 'src', args.path.slice(2))
            const found = ['.ts', '.tsx', '/index.ts'].map((ext) => base + ext).find((p) => fs.existsSync(p))
            return { path: found || base }
          })
          b.onResolve({ filter: /^@labgest\/shared$/ }, () => ({
            path: path.resolve(webRoot, '../packages/shared/src/index.ts'),
          }))
        },
      },
    ],
  })

  globalThis.__AGENDA_TV_PRISMA_MOCK__ = prismaMock
  const mod = { exports: {} }
  const fn = new Function('require', 'module', 'exports', build.outputFiles[0].text)
  fn(require, mod, mod.exports)

  const okRes = await mod.exports.executarAgendaAutomaticaIa({
    data: '2026-12-20',
    aplicar: true,
    usarGemini: false,
  })
  assert.equal(okRes.success, true)
  assert.equal(okRes.aplicado, true)
  assert.equal(batchChamadas, 1, 'Deve inserir todos os blocos em 1 único lote')
  assert.ok(okRes.blocosCriadosIds.length >= 2)
  assert.deepEqual(okRes.plano.ordensAvaliadas[0].ordem.cicloFotos, [])
  assert.equal(okRes.plano.ordensAvaliadas[0].ordem.cicloObs, null)

  erroForcado = new Error('Falha simulada de conexão Postgres')
  const errRes = await mod.exports.executarAgendaAutomaticaIa({
    data: '2026-12-20',
    aplicar: true,
    usarGemini: false,
  })
  assert.equal(errRes.success, false)
  assert.match(errRes.error, /Falha simulada/)
  delete globalThis.__AGENDA_TV_PRISMA_MOCK__
})

test('respeita notificacoes_tipo_check via pg_constraint em agenda IA, criação manual e ações do bloco', async () => {
  const tiposPermitidos = new Set(['info', 'alerta', 'sistema'])
  const banco = new Map()
  let nextId = 100
  let queryConstraintChamadas = 0

  const validarTipo = (tipo) => {
    if (!tiposPermitidos.has(tipo)) {
      throw new Error(`new row for relation "notificacoes" violates check constraint "notificacoes_tipo_check" (tipo=${tipo})`)
    }
  }

  const prismaMock = {
    $queryRawUnsafe: async (sql) => {
      queryConstraintChamadas += 1
      assert.match(sql, /notificacoes_tipo_check/)
      return [
        {
          def: "CHECK (((tipo)::text = ANY (ARRAY[('alerta'::character varying)::text, ('info'::character varying)::text, ('sistema'::character varying)::text])))",
        },
      ]
    },
    notificacao: {
      findMany: async () => [...banco.values()],
      findFirst: async () => [...banco.values()].reverse()[0] ?? null,
      findUnique: async ({ where }) => banco.get(where.id) ?? null,
      deleteMany: async () => ({ count: 0 }),
      createManyAndReturn: async ({ data }) => {
        const criados = []
        for (const item of data) {
          validarTipo(item.tipo)
          const id = ++nextId
          banco.set(id, { id, ...item })
          criados.push({ id })
        }
        return criados
      },
      create: async ({ data }) => {
        validarTipo(data.tipo)
        const id = ++nextId
        const row = { id, ...data }
        banco.set(id, row)
        return row
      },
      update: async ({ where, data }) => {
        const atual = banco.get(where.id)
        const atualizado = { ...atual, ...data }
        banco.set(where.id, atualizado)
        return atualizado
      },
      delete: async ({ where }) => {
        const atual = banco.get(where.id)
        banco.delete(where.id)
        return atual
      },
    },
    clinicorpSincronizacao: {
      findFirst: async () => null,
    },
  }

  const build = await esbuild.build({
    entryPoints: [path.join(webRoot, 'src/actions/agenda-tv.ts')],
    bundle: true,
    write: false,
    platform: 'node',
    format: 'cjs',
    plugins: [
      {
        name: 'agenda-action-constraint-mocks',
        setup(b) {
          b.onResolve({ filter: /^@labgest\/database$/ }, () => ({ path: 'db', namespace: 'db' }))
          b.onLoad({ filter: /.*/, namespace: 'db' }, () => ({
            contents: 'module.exports = { prisma: globalThis.__AGENDA_TV_PRISMA_CONSTRAINT_MOCK__ }',
            loader: 'js',
          }))
          b.onResolve({ filter: /^next\/cache$/ }, () => ({ path: 'nc', namespace: 'nc' }))
          b.onLoad({ filter: /.*/, namespace: 'nc' }, () => ({
            contents: 'module.exports = { revalidatePath: () => {} }',
            loader: 'js',
          }))
          b.onResolve({ filter: /^@\/lib\/auth-utils$/ }, () => ({ path: 'au', namespace: 'au' }))
          b.onLoad({ filter: /.*/, namespace: 'au' }, () => ({
            contents: 'module.exports = { requireUser: async () => ({ id: 1 }) }',
            loader: 'js',
          }))
          b.onResolve({ filter: /^@\/actions\/producao$/ }, () => ({ path: 'pr', namespace: 'pr' }))
          b.onLoad({ filter: /.*/, namespace: 'pr' }, () => ({
            contents: `
              module.exports = {
                getProducao: async () => [
                  {
                    id: 801,
                    paciente: 'Maria Souza',
                    dentista: 'Dr. João',
                    servico: 'Prótese total',
                    status: 'Em Produção',
                    updatedAt: '2026-11-15T10:00:00Z',
                    etapa: 'confeccao',
                    subetapa: 'Montagem de dentes',
                    prioridade: 'Urgente',
                    entrega: '2026-11-16T18:00:00Z',
                    arcadas: 1,
                  },
                ],
              }
            `,
            loader: 'js',
          }))
          b.onResolve({ filter: /^@\/actions\/workflow-protese$/ }, () => ({ path: 'wf', namespace: 'wf' }))
          b.onLoad({ filter: /.*/, namespace: 'wf' }, () => ({
            contents: 'module.exports = { concluirEtapaLaboratorial: async () => ({ success: true }) }',
            loader: 'js',
          }))
          b.onResolve({ filter: /^@\/lib\/clinicorp-etapas$/ }, () => ({ path: 'ce', namespace: 'ce' }))
          b.onLoad({ filter: /.*/, namespace: 'ce' }, () => ({
            contents: 'module.exports = { carregarInferenciasClinicorpParaOrdens: async () => new Map() }',
            loader: 'js',
          }))
          b.onResolve({ filter: /^@\// }, (args) => {
            const base = path.join(webRoot, 'src', args.path.slice(2))
            const found = ['.ts', '.tsx', '/index.ts'].map((ext) => base + ext).find((p) => fs.existsSync(p))
            return { path: found || base }
          })
          b.onResolve({ filter: /^@labgest\/shared$/ }, () => ({
            path: path.resolve(webRoot, '../packages/shared/src/index.ts'),
          }))
        },
      },
    ],
  })

  globalThis.__AGENDA_TV_PRISMA_CONSTRAINT_MOCK__ = prismaMock
  try {
    const mod = { exports: {} }
    const fn = new Function('require', 'module', 'exports', build.outputFiles[0].text)
    fn(require, mod, mod.exports)

    const iaRes = await mod.exports.executarAgendaAutomaticaIa({
      data: '2026-12-20',
      aplicar: true,
      usarGemini: false,
    })
    assert.equal(iaRes.success, true)
    assert.equal(queryConstraintChamadas, 1)
    assert.ok(iaRes.blocosCriadosIds.length >= 1)

    const linhas = [...banco.values()]
    const blocoIa = linhas.find((l) => l.titulo.startsWith('[TV] '))
    const briefingIa = linhas.find((l) => l.titulo.startsWith('[IA] 2026-12-20'))
    assert.ok(blocoIa, 'Deve criar bloco com prefixo [TV]')
    assert.equal(blocoIa.tipo, 'sistema')
    assert.ok(briefingIa, 'Deve criar briefing com prefixo [IA]')
    assert.equal(briefingIa.tipo, 'info')

    const manualRes = await mod.exports.criarBlocosBancadaTv({
      ordemId: null,
      protetico: 'Tavá',
      data: '2026-12-20',
      pacienteAvulso: 'Teste Avulso',
      blocos: [
        {
          horaInicio: '14:00',
          horaFim: '15:00',
          etapaNome: 'Montagem',
          modo: 'bancada',
        },
      ],
    })
    assert.equal(manualRes.success, true)
    assert.equal(queryConstraintChamadas, 1, 'Deve reutilizar cache de tipos permitidos')
    const idManual = manualRes.ids[0]
    assert.equal(banco.get(idManual).tipo, 'sistema')
    assert.ok(banco.get(idManual).titulo.startsWith('[TV] '))

    const statusRes = await mod.exports.atualizarStatusBlocoTv(idManual, 'em_andamento')
    assert.equal(statusRes.success, true)

    const moverRes = await mod.exports.moverOuReagendarBlocoTv(idManual, { adiarMinutos: 15 })
    assert.equal(moverRes.success, true)

    const delRes = await mod.exports.excluirBlocoTv(idManual)
    assert.equal(delRes.success, true)
    assert.equal(banco.has(idManual), false)
  } finally {
    delete globalThis.__AGENDA_TV_PRISMA_CONSTRAINT_MOCK__
  }
})

