/* eslint-disable @typescript-eslint/no-require-imports */
// Genuine generated Prisma client + real supplier helpers, only provisioned disposable schema.
// No dotenv, application database import, schema DDL, or destructive cleanup.
const assert = require('node:assert/strict'), fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript')
const url = new URL(process.argv[2] || 'http://missing')
assert.ok(['postgres:', 'postgresql:'].includes(url.protocol))
assert.ok(['127.0.0.1', '[::1]'].includes(url.hostname))
assert.equal(url.pathname, '/labgest_finance_test')
assert.equal(url.username, 'labgest_archive_test')
assert.equal(url.password, 'synthetic-only')
assert.equal(url.hash, '')
assert.equal(url.searchParams.get('schema'), 'labgest_prisma_test')
assert.equal(url.searchParams.getAll('schema').length, 1)
assert.ok([...url.searchParams.keys()].every(key => key === 'schema'))
const { PrismaClient } = require('@prisma/client')
const prisma = new PrismaClient({ datasources: { db: { url: url.toString() } } })
function load(name, dependencies = {}) {
  const exports = {}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname, '../src/lib', name + '.ts'), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, { exports, Date, Number, Error, require(n) { assert.ok(n in dependencies, n); return dependencies[n] } })
  return exports
}
const helpers = load('labs-externos-vinculo', { '@/lib/labs-externos-arquivo': load('labs-externos-arquivo') })
async function main() {
  try {
    const [endpoint] = await prisma.$queryRaw`SELECT current_database() db, current_schema() schema, host(inet_server_addr()) address`
    assert.equal(endpoint.db, 'labgest_finance_test')
    assert.equal(endpoint.schema, 'labgest_prisma_test')
    assert.ok(['127.0.0.1', '::1'].includes(endpoint.address))
    for (const timezone of ['UTC', 'Pacific/Auckland']) {
      for (const existing of [false, true]) {
        await prisma.$transaction(async tx => {
          await tx.$queryRaw`SELECT set_config('TimeZone', ${timezone}, true)`
          const name = 'Synthetic supplier civil-date regression'
          const lab = await tx.labs_externos.create({ data: { nome: name, ativo: true } })
          const ordem = await tx.ordem.create({ data: { clienteNome: name, servicoNome: name, nomePaciente: name, valor: 1, valorFinal: 1, dataEntrega: new Date('2026-11-20T00:00:00Z'), status: 'Em Produção' } })
          await tx.$queryRaw`SELECT id FROM ordens WHERE id = ${ordem.id} FOR UPDATE`
          const event = new Date('2026-11-02T01:30:00.000Z')
          await helpers.registrarPedidoFornecedor(tx, ordem, lab.id, event, new Date('2026-11-17T01:30:00.000Z'))
          const pedido = await tx.labs_externos_pedidos.findFirstOrThrow({ where: { ordem_id: ordem.id } })
          if (existing) await tx.labs_externos_pedidos.update({ where: { id: pedido.id }, data: { data_retorno: new Date('2026-10-31T00:00:00Z'), situacao: 'Pronto' } })
          const result = await helpers.confirmarPedidoFornecedor(tx, ordem.id, event)
          const returnDay = existing ? '2026-10-31' : '2026-11-01'
          assert.equal(result.dataRetorno.toISOString(), returnDay + 'T00:00:00.000Z')
          const [row] = await tx.$queryRaw`SELECT data_envio::text, prazo::text, data_retorno::text, fornecedor_confirmado_em::text FROM labs_externos_pedidos WHERE id = ${pedido.id}`
          assert.deepEqual(row, { data_envio: '2026-11-01', prazo: '2026-11-16', data_retorno: returnDay, fornecedor_confirmado_em: '2026-11-02 01:30:00' })
          const stored = await tx.labs_externos_pedidos.findUniqueOrThrow({ where: { id: pedido.id } })
          assert.equal(stored.data_retorno.toISOString(), returnDay + 'T00:00:00.000Z')
          assert.equal(stored.fornecedor_confirmado_em.toISOString(), event.toISOString())
          assert.equal(await helpers.confirmarPedidoFornecedor(tx, ordem.id, new Date('2026-11-03T01:30:00Z')), null)
          const repeated = await tx.labs_externos_pedidos.findUniqueOrThrow({ where: { id: pedido.id } })
          assert.equal(repeated.fornecedor_confirmado_em.toISOString(), event.toISOString())
          assert.equal(repeated.data_retorno.toISOString(), returnDay + 'T00:00:00.000Z')
        })
        console.log(`PASS genuine Prisma supplier dates: timezone=${timezone}, historicalReturn=${existing}, civil dates + event timestamp + repeated confirmation`)
      }
    }
  } finally { await prisma.$disconnect() }
}
main().catch(error => { console.error(error); process.exitCode = 1 })
