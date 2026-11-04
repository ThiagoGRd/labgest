/* eslint-disable @typescript-eslint/no-require-imports */
// Genuine generated Prisma + actual message/revision helpers in an externally
// provisioned disposable schema. No dotenv or destructive cleanup.
// --legacy-trigger uses a separate public-schema fixture and the exact migration.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto'),ts=require('typescript')
const url=new URL(process.argv[2]||'http://missing')
assert.ok(['postgres:','postgresql:'].includes(url.protocol))
assert.ok(['127.0.0.1','[::1]'].includes(url.hostname))
const legacyMode=process.argv.includes('--legacy-trigger')
assert.equal(url.pathname,legacyMode?'/labgest_order_prisma_test':'/labgest_finance_test')
assert.equal(url.username,'labgest_archive_test')
assert.equal(url.password,'synthetic-only')
assert.equal(url.hash,'')
assert.equal(url.searchParams.get('schema'),legacyMode?'public':'labgest_prisma_test')
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
  assert.equal(endpoint.db,legacyMode?'labgest_order_prisma_test':'labgest_finance_test');assert.equal(endpoint.schema,legacyMode?'public':'labgest_prisma_test');assert.ok(['127.0.0.1','::1'].includes(endpoint.address))
  const future=new Date('2100-01-01T00:00:00.000Z'),name='Synthetic message revision regression'
  let ordem=await prisma.ordem.create({data:{clienteNome:name,servicoNome:name,nomePaciente:name,valor:1,valorFinal:1,dataEntrega:new Date('2026-11-20T00:00:00Z'),status:'Em Produção',updatedAt:future,mensagens:[]}})
  const message={id:crypto.randomUUID(),role:'lab',nome:name,texto:'Synthetic message',createdAt:new Date().toISOString(),lidoPeloDentista:false}
  // Control only: exercise Prisma's ordinary @updatedAt behavior, matching the
  // former write shape. This is not an execution of predecessor product source.
  const control=await prisma.ordem.update({where:{id:ordem.id},data:{mensagens:[message]}})
  assert.ok(control.updatedAt.getTime()<future.getTime(),'ordinary Prisma update control lowers an existing future revision')
  if(legacyMode){
   const {Client}=require('pg'),client=new Client({host:'127.0.0.1',port:Number(url.port||5432),user:'labgest_archive_test',password:'synthetic-only',database:'labgest_order_prisma_test'})
   try{
    await client.connect()
    assert.equal((await client.query('SELECT host(inet_server_addr()) address')).rows[0].address,'127.0.0.1')
    await client.query(`CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$;
     CREATE TRIGGER update_ordens_updated_at BEFORE UPDATE ON public.ordens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
     CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();`)
    const legacy=await prisma.ordem.update({where:{id:ordem.id},data:{updatedAt:future}})
    assert.ok(legacy.updatedAt.getTime()<future.getTime(),'exact legacy trigger overwrites explicit Prisma future revision')
    const migration='packages/database/prisma/migrations/20261104020000_order_revision_trigger/migration.sql'
    const sql=fs.readFileSync(path.join(root,migration),'utf8')
    hashes[migration]=crypto.createHash('sha256').update(sql).digest('hex')
    await client.query(sql)
    const customer=await prisma.cliente.create({data:{nome:name,telefone:'000',cro:'SYNTHETIC',updatedAt:future}})
    const unchangedClient=await prisma.cliente.update({where:{id:customer.id},data:{updatedAt:future}})
    assert.ok(unchangedClient.updatedAt.getTime()<future.getTime(),'shared clientes legacy behavior unchanged')
    for(const zone of ['UTC','Pacific/Auckland']){
     await prisma.$transaction(async tx=>{
      await tx.$queryRaw`SELECT set_config('TimeZone',${zone},true)`
      const fixture=await tx.ordem.create({data:{clienteNome:name,servicoNome:name,nomePaciente:name,valor:1,valorFinal:1,dataEntrega:future,updatedAt:future}})
      await tx.$executeRaw`UPDATE ordens SET updated_at='2100-01-01 00:00:00.123456'::timestamp WHERE id=${fixture.id}`
      let previous=(await tx.ordem.findUniqueOrThrow({where:{id:fixture.id}})).updatedAt
      assert.equal(previous.getTime(),future.getTime()+123)
      for(let i=0;i<3;i++){
       const next=await tx.ordem.update({where:{id:fixture.id},data:{observacoes:'synthetic '+i}})
       assert.equal(next.updatedAt.getTime(),previous.getTime()+1,'genuine Prisma reads distinct millisecond revisions within one transaction')
       previous=next.updatedAt
      }
     })
    }
   }finally{await client.end()}
   // New fixture avoids asking the monotonic trigger to reset an existing revision.
   ordem=await prisma.ordem.create({data:{clienteNome:name,servicoNome:name,nomePaciente:name,valor:1,valorFinal:1,dataEntrega:future,updatedAt:future,mensagens:[]}})
  }
  // Reset only this test-owned fixture before exercising the current helper.
  if(!legacyMode)await prisma.ordem.update({where:{id:ordem.id},data:{mensagens:[],updatedAt:future}})
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
  console.log(JSON.stringify({result:'PASS',legacyTriggerFixture:legacyMode,method:'genuine generated Prisma + actual message/revision helpers',baselineControl:'ordinary Prisma update shape only; predecessor product source not executed',cases:['ordinary Prisma control lowers future revision','future revision append','future revision new receipt','repeated/empty/unknown receipt and retry do not update xmin or timestamp'],sourceHashes:hashes},null,2))
 }finally{await prisma.$disconnect()}
}
main().catch(error=>{console.error(error);process.exitCode=1})
