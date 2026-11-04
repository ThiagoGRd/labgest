/* eslint-disable @typescript-eslint/no-require-imports */
// Genuine generated Prisma + actual message/revision helpers in an externally
// provisioned disposable schema. No dotenv, schema DDL, or destructive cleanup.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),ts=require('typescript')
const url=new URL(process.argv[2]||'http://missing')
assert.ok(['postgres:','postgresql:'].includes(url.protocol))
assert.ok(['127.0.0.1','[::1]'].includes(url.hostname))
assert.equal(url.pathname,'/labgest_finance_test')
assert.equal(url.username,'labgest_archive_test')
assert.equal(url.password,'synthetic-only')
assert.equal(url.hash,'')
assert.equal(url.searchParams.get('schema'),'labgest_prisma_test')
assert.equal(url.searchParams.getAll('schema').length,1)
assert.ok([...url.searchParams.keys()].every(key=>key==='schema'))
const {PrismaClient}=require('@prisma/client')
const prisma=new PrismaClient({datasources:{db:{url:url.toString()}}})
const root=path.resolve(__dirname,'../..'),hashes={}
function load(file,dependencies){
 const source=fs.readFileSync(path.join(root,file),'utf8'),exports={}
 hashes[file]=crypto.createHash('sha256').update(source).digest('hex')
 vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,Set,require(name){assert.ok(name in dependencies,'Unexpected import '+name);return dependencies[name]}})
 return exports
}
const revision=load('packages/shared/src/order-transition.ts',{})
const helpers=load('packages/database/src/mensagens.ts',{'./index':{prisma},'@labgest/shared':revision})
async function main(){
 try{
  const [endpoint]=await prisma.$queryRaw`SELECT current_database() db,current_schema() schema,host(inet_server_addr()) address`
  assert.equal(endpoint.db,'labgest_finance_test');assert.equal(endpoint.schema,'labgest_prisma_test');assert.ok(['127.0.0.1','::1'].includes(endpoint.address))
  const future=new Date('2100-01-01T00:00:00.000Z'),name='Synthetic message revision regression'
  const ordem=await prisma.ordem.create({data:{clienteNome:name,servicoNome:name,nomePaciente:name,valor:1,valorFinal:1,dataEntrega:new Date('2026-11-20T00:00:00Z'),status:'Em Produção',updatedAt:future,mensagens:[]}})
  const message={id:crypto.randomUUID(),role:'lab',nome:name,texto:'Synthetic message',createdAt:new Date().toISOString(),lidoPeloDentista:false}
  // Control only: exercise Prisma's ordinary @updatedAt behavior, matching the
  // former write shape. This is not an execution of predecessor product source.
  const control=await prisma.ordem.update({where:{id:ordem.id},data:{mensagens:[message]}})
  assert.ok(control.updatedAt.getTime()<future.getTime(),'ordinary Prisma update control lowers an existing future revision')
  // Reset only this test-owned fixture before exercising the current helper.
  await prisma.ordem.update({where:{id:ordem.id},data:{mensagens:[],updatedAt:future}})
  assert.equal(await helpers.alterarMensagens(ordem.id,undefined,items=>[...items,message]),true)
  const appended=await prisma.ordem.findUniqueOrThrow({where:{id:ordem.id}})
  assert.equal(appended.updatedAt.getTime(),future.getTime()+1,'Prisma append advances the future revision by one millisecond')
  assert.equal(await helpers.alterarMensagens(ordem.id,undefined,items=>helpers.recibos(items,[message.id],'dentista')),true)
  const received=await prisma.ordem.findUniqueOrThrow({where:{id:ordem.id}})
  assert.equal(received.updatedAt.getTime(),appended.updatedAt.getTime()+1,'Prisma receipt advances revision monotonically')
  assert.equal(received.mensagens[0].lidoPeloDentista,true)
  const [before]=await prisma.$queryRaw`SELECT xmin::text AS revision,updated_at::text AS updated_at FROM ordens WHERE id=${ordem.id}`
  for(const ids of [[message.id],[],['unknown']])assert.equal(await helpers.alterarMensagens(ordem.id,undefined,items=>helpers.recibos(items,ids,'dentista')),true)
  assert.equal(await helpers.alterarMensagens(ordem.id,undefined,items=>items),true)
  const [after]=await prisma.$queryRaw`SELECT xmin::text AS revision,updated_at::text AS updated_at FROM ordens WHERE id=${ordem.id}`
  assert.deepEqual(after,before,'no-op receipts/retry must preserve physical row version and updatedAt')
  assert.deepEqual((await prisma.ordem.findUniqueOrThrow({where:{id:ordem.id}})).mensagens,received.mensagens)
  console.log(JSON.stringify({result:'PASS',method:'genuine generated Prisma + actual message/revision helpers',baselineControl:'ordinary Prisma update shape only; predecessor product source not executed',cases:['ordinary Prisma control lowers future revision','future revision append','future revision new receipt','repeated/empty/unknown receipt and retry do not update xmin or timestamp'],sourceHashes:hashes},null,2))
 }finally{await prisma.$disconnect()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
