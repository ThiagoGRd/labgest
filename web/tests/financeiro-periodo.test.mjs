import assert from 'node:assert/strict'
import test from 'node:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { runInNewContext } from 'node:vm'
import ts from 'typescript'

const require = createRequire(import.meta.url)
const sourceRoot = new URL('../src/', import.meta.url)

// Execute the real server action with a read-only in-memory Prisma substitute.
// Never import the database module or load environment files.
function loadSource(path, mocks) {
  const code = ts.transpileModule(readFileSync(new URL(path, sourceRoot), 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX },
  }).outputText
  const exports = {}
  runInNewContext(code, {
    exports, Date, console,
    require(name) {
      if (name in mocks) return mocks[name]
      if (name.startsWith('@/components/') && mocks.components) return mocks.components
      if (name.startsWith('@/lib/')) return loadSource(`${name.slice(2)}.ts`, mocks)
      if (name === 'node:crypto' || name === 'zod' || name === 'react/jsx-runtime') return require(name)
      throw new Error(`Unexpected import: ${name}`)
    },
  })
  return exports
}

const date = (month, day) => new Date(2026, month - 1, day, 12)
const account = (id, competence, due, status = 'Pendente', received = 0) => ({
  id, dataCompetencia: competence, dataVencimento: due, status, valor: 100,
  valorRecebido: received, clienteNome: 'Cliente fictício', descricao: `Conta ${id}`,
})
const records = [
  account(1, date(10, 20), date(11, 5)),
  account(2, date(10, 20), date(9, 30), 'Recebido', 100),
  account(3, date(10, 20), date(10, 20), 'Cancelado'),
  account(4, null, date(10, 15)),
  account(5, date(12, 1), date(1, 10)),
]

function matches(record, where = {}) {
  return Object.entries(where).every(([key, condition]) => {
    if (key === 'OR') return condition.some(clause => matches(record, clause))
    if (condition === null) return record[key] == null
    return Object.entries(condition).every(([operator, value]) => {
      if (operator === 'notIn') return !value.includes(record[key])
      if (record[key] == null) return false
      if (operator === 'gte') return record[key] >= value
      if (operator === 'lte') return record[key] <= value
      if (operator === 'lt') return record[key] < value
      throw new Error(`Unexpected operator: ${operator}`)
    })
  })
}

test('competence list reveals October charges while due totals, paid/cancelled states and cash stay intact', async () => {
  const calls = []
  const movements = [{ id: 1, tipo: 'Entrada', valor: 50, dataMovimentacao: date(10, 25), estornadaEm: null }]
  let authorized = 0
  const table = (name, rows) => ({ findMany: async (query = {}) => {
    calls.push({ name, query })
    return rows.filter(row => matches(row, query.where))
  } })
  const action = loadSource('actions/financeiro.ts', {
    '@labgest/database': { prisma: {
      contaReceber: table('receber', records), contaPagar: table('pagar', []),
      movimentacaoFinanceira: table('caixa', movements),
      contaFinanceira: table('contas', []), cliente: table('clientes', []),
    } },
    'next/cache': { revalidatePath: () => { throw new Error('Unexpected mutation') } },
    '@/lib/auth-utils': { requireUser: async () => { authorized++; return { id: 1 } } },
  })
  const october = await action.getFinanceiroPageData('2026-10')
  assert.equal(authorized, 1)
  assert.deepEqual(Array.from(october.receber, c => c.id), [3, 4])
  assert.deepEqual(Array.from(october.receberCompetencia, c => c.id), [1, 2, 3])
  assert.equal(october.receberCompetencia.find(c => c.id === 2).status, 'Recebido')
  assert.equal(october.receberCompetencia.find(c => c.id === 2).restante, 0)
  assert.equal(october.receberCompetencia.find(c => c.id === 3).status, 'Cancelado')
  assert.equal(october.resumo.totalPrevistoReceber, 100)
  assert.equal(october.resumo.previstoReceber, 100)
  assert.equal(october.resumo.entradas, 50)
  assert.equal(october.movimentacoes.length, 1)
  assert.ok(october.mesesDisponiveis.includes('2026-12')) // competence-only month
  const cashQuery = calls.find(c => c.name === 'caixa').query.where
  assert.ok('dataMovimentacao' in cashQuery)
  assert.ok(!('dataCompetencia' in cashQuery))
  const november = await action.getFinanceiroPageData('2026-11')
  assert.deepEqual(Array.from(november.receber, c => c.id), [1])
  assert.equal(november.receberCompetencia.length, 0)
  assert.equal(november.resumo.entradas, 0)
  const empty = await action.getFinanceiroPageData('2026-08')
  assert.ok(empty.mesesDisponiveis.includes('2026-08'))
  assert.equal(empty.receberCompetencia.length, 0)
})

test('page defaults to due date and reads the competence URL parameter', async () => {
  const months = []
  const page = loadSource('app/(dashboard)/financeiro/page.tsx', {
    '@/actions/financeiro': { getFinanceiroPageData: async month => { months.push(month); return {} } },
    './financeiro-view': { FinanceiroView: 'FinanceiroView' },
  }).default
  for (const [criterio, expected] of [[undefined, 'vencimento'], ['competencia', 'competencia'], ['invalid', 'vencimento']]) {
    const result = await page({ searchParams: Promise.resolve({ mes: '2026-10', criterio }) })
    assert.equal(result.props.criterioReceber, expected)
  }
  assert.deepEqual(months, ['2026-10', '2026-10', '2026-10'])
})

test('month navigation preserves competence and changing basis preserves month', () => {
  const routes = []
  const components = new Proxy({}, { get: (_target, name) => String(name) })
  const view = loadSource('app/(dashboard)/financeiro/financeiro-view.tsx', {
    react: { useState: value => [value, () => {}] },
    'next/navigation': { useRouter: () => ({ push: url => routes.push(url) }) },
    'lucide-react': components, components,
    '@/actions/financeiro': {}, sonner: { toast: {} },
  }).FinanceiroView
  const tree = view({ criterioReceber: 'competencia', dados: {
    periodo: '2026-10', receber: [], receberCompetencia: [], pagar: [], clientes: [],
    contasFinanceiras: [], movimentacoes: [], mesesDisponiveis: ['2026-10', '2026-11'],
    resumo: { previstoReceber: 0, vencidoReceber: 0 },
  } })
  const selects = []
  function walk(node) {
    if (!node || typeof node !== 'object') return
    if (Array.isArray(node)) return node.forEach(walk)
    if (node.type === 'Select') selects.push(node)
    walk(node.props?.children)
  }
  walk(tree)
  selects.find(node => node.props.value === '2026-10').props.onValueChange('2026-11')
  selects.find(node => node.props.value === 'competencia').props.onValueChange('vencimento')
  assert.deepEqual(routes, [
    '/financeiro?mes=2026-11&criterio=competencia',
    '/financeiro?mes=2026-10&criterio=vencimento',
  ])
})
