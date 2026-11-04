/* eslint-disable @typescript-eslint/no-require-imports -- Node CommonJS test harness; no production imports are changed. */
const test = require('node:test')
const assert = require('node:assert/strict')
const { build } = require('esbuild')
const path = require('node:path')
const vm = require('node:vm')

test('navigation retrieves only the authenticated user display and permissions', async () => {
  const output = await build({entryPoints:[path.resolve(__dirname,'../src/actions/usuario-navegacao.ts')],bundle:true,write:false,platform:'node',format:'cjs',plugins:[{name:'auth-fixture',setup(builder){
    builder.onResolve({filter:/auth-utils$/},()=>({path:'auth',namespace:'fixture'}))
    builder.onLoad({filter:/.*/,namespace:'fixture'},()=>({contents:`export async function requireUser(options) { globalThis.options = options; if(globalThis.failure) throw globalThis.failure; return {nome:'Ana',email:'ana@example.test',tipo:'operador',permissoes:['all'],senha:'must-not-leak',id:19} }`}))
  }}]})
  const context={module:{exports:{}},failure:null}
  vm.runInNewContext(output.outputFiles[0].text,context)
  const result=await context.module.exports.getUsuarioNavegacao()
  assert.deepEqual(JSON.parse(JSON.stringify(result)),{nome:'Ana',email:'ana@example.test',tipo:'operador',permissoes:['all']})
  assert.equal(context.options.permitirRecepcao,true)
  context.failure=new Error('Unauthorized')
  await assert.rejects(context.module.exports.getUsuarioNavegacao(),/Unauthorized/)
})
