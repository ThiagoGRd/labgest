/* eslint-disable @typescript-eslint/no-require-imports */
const { test } = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), ts = require('typescript')
test('supplier dispatch locks before reading history, retaining concurrent schedule event', async () => {
  const code=ts.transpileModule(fs.readFileSync('web/src/actions/workflow-protese.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
  let history=[{acao:'antigo'}], locked=false, written; let release; const gate=new Promise(r=>release=r)
  const tx={ $queryRaw: async()=>{locked=true;await gate}, ordem:{findUnique:async()=>({tipoWorkflow:'teste',passoFluxoAtual:'x',arcadas:1,historicoEtapas:[...history]}), update:async q=>{written=q.data.historicoEtapas}} }
  const prisma={...tx,$transaction:async f=>f(tx)}
  const exports={}; vm.runInNewContext(code,{exports,Date,console,require:n=> n==='@labgest/database'?{prisma}:n==='@/lib/auth-utils'?{requireUser:async()=>({email:'x'})}:n==='next/cache'?{revalidatePath:()=>{}}:n==='@/lib/workflow-config'?{isTipoProtese:()=>true,getPassoProtese:()=>({responsavel:'fornecedor'}),calcularPrazoPasso:()=>null}:n==='@/lib/finalizacao-ordem'?{}:require(n)})
  const pending=exports.registrarEnvioFornecedor(1,'Fornecedor'); await new Promise(r=>setImmediate(r)); assert.equal(locked,true)
  history.push({acao:'agendou_recepcao'}); release(); assert.equal((await pending).success,true); assert.deepEqual(Array.from(written,x=>x.acao),['antigo','agendou_recepcao','enviado_fornecedor'])
})
