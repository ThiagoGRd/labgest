import test from 'node:test'
import assert from 'node:assert/strict'
import { validarNovoUsuario, podeVerConfiguracoes, executarAcaoPendente } from '../src/lib/admin-interactions.ts'

test('new users require trimmed name, valid email and a nonempty password', () => {
  for (const dados of [{nome:'  ',email:'a@b.com',senhaProvisoria:'secret'}, {nome:'Ana',email:'bad',senhaProvisoria:'secret'}, {nome:'Ana',email:'a@b.com',senhaProvisoria:''}]) assert.ok(validarNovoUsuario(dados))
  assert.equal(validarNovoUsuario({nome:'Ana',email:' a@b.com ',senhaProvisoria:'secret'}), null)
})
test('settings navigation follows admin authorization and reception restriction', () => {
  assert.equal(podeVerConfiguracoes({tipo:'operador'}), false)
  assert.equal(podeVerConfiguracoes({tipo:'admin'}), true)
  assert.equal(podeVerConfiguracoes({tipo:'operador',permissoes:['all']}), true)
  assert.equal(podeVerConfiguracoes({tipo:'recepcao',permissoes:['all']}), false)
})
test('pending actions recover on failure without swallowing errors', async () => {
  const states=[]
  await assert.rejects(executarAcaoPendente(async () => {throw new Error('offline')}, value => states.push(value)), /offline/)
  assert.deepEqual(states,[true,false])
})

test('pending actions also recover after resolved success and redirect exceptions', async () => {
  const states=[]
  assert.equal(await executarAcaoPendente(async () => 'saved', value => states.push(value)), 'saved')
  const redirect = Object.assign(new Error('redirect'), {digest:'NEXT_REDIRECT;replace;/dashboard;307;'})
  await assert.rejects(executarAcaoPendente(async () => {throw redirect}, value => states.push(value)), error => error === redirect)
  assert.deepEqual(states,[true,false,true,false])
})
