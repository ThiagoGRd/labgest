import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { stripTypeScriptTypes } from 'node:module'
import { runInNewContext } from 'node:vm'
import { validarCliente } from '../src/lib/clientes-utils.ts'
function load({authorized = true, fail = false} = {}) {
  const calls = []
  const code = stripTypeScriptTypes(readFileSync(new URL('../src/actions/clientes.ts', import.meta.url), 'utf8'))
    .replace(/^import .*$/gm, '').replace(/export async function /g, 'async function ')
  const scope = {validarCliente, console: {error() {}}, requireUser: async () => {if (!authorized) throw Error('denied')},
    prisma: { cliente: { create: async query => { calls.push(query); return {} }, update: async query => { calls.push(query); if(fail) throw Error('db failed'); return {} } } },
    revalidatePath: path => calls.push(path) }
  runInNewContext(code + '\nthis.create = createCliente; this.update = typeof updateCliente === "function" ? updateCliente : undefined', scope)
  return { update: scope.update, create: scope.create, calls }
}
const data = {nome:' Dentist ', telefone:'123', cro:'CRO 1', email:'', endereco:'', observacoes:''}
test('edit requires authorization before any persistence', async () => {
  const action = load({ authorized:false })
  assert.equal(typeof action.update, 'function')
  await assert.rejects(action.update(1, data))
  assert.equal(action.calls.length,0)
})
test('edit rejects invalid IDs and invalid input without writing', async () => {
  const action = load()
  assert.equal(typeof action.update, 'function')
  for (const id of [0,-1,1.5,'1',NaN,Infinity]) assert.equal((await action.update(id,data)).success,false)
  assert.equal((await action.update(1,{...data,nome:' '})).success,false)
  assert.equal(action.calls.length,0)
})
test('edit writes only allowed normalized fields and revalidates clients', async () => {
  const action = load()
  assert.equal(typeof action.update, 'function')
  assert.equal((await action.update(2,{...data,ativo:false,id:100})).success,true)
  assert.equal(action.calls[0].where.id,2)
  assert.equal(action.calls[0].data.nome,'Dentist')
  assert.equal('ativo' in action.calls[0].data,false)
  assert.equal('id' in action.calls[0].data,false)
  assert.equal(action.calls[1],'/clientes')
})
test('missing record or database failure returns retryable error without revalidation', async () => {
  const action = load({fail:true})
  assert.equal(typeof action.update, 'function')
  const result = await action.update(2,data)
  assert.equal(result.success,false)
  assert.ok(result.error)
  assert.equal(action.calls.length,1)
})

test('create validates fields on the server before writing', async () => {
  const action = load()
  assert.equal((await action.create({...data,nome:' '})).success,false)
  assert.equal(action.calls.length,0)
  assert.equal((await action.create({...data,id:99,ativo:false})).success,true)
  assert.equal('id' in action.calls[0].data,false)
  assert.equal('ativo' in action.calls[0].data,false)
})
