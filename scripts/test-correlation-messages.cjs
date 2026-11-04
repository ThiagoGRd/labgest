const ts=require(require('node:path').join(process.env.LABGEST_TEST_TOOLS || require('node:path').resolve(__dirname,'../node_modules'),'typescript'));
const vm=require('node:vm'), fs=require('node:fs'), assert=require('node:assert/strict');
function load(path,mocks){ const exports={}; vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n in mocks)return mocks[n];throw Error(n)},console,Date,Set});return exports; }
(async()=>{
let rows=new Map([[1,{id:1,clienteId:1,mensagens:[]}],[2,{id:2,clienteId:2,mensagens:[]}]]),tail=Promise.resolve();
const tx={ $queryRaw:async(strings,...args)=> {let row=rows.get(args[0]);return row && (args.length===1||row.clienteId===args[1])?[{id:row.id}]:[]},ordem:{findFirst:async({where})=> {const row=rows.get(where.id);const snapshot=row&&(!where.clienteId||row.clienteId===where.clienteId)?structuredClone(row):null;await new Promise(r=>setImmediate(r));return snapshot},update:async({where,data})=>Object.assign(rows.get(where.id),structuredClone(data))}};
const prisma={...tx,cliente:{findFirst:async()=>({id:1})},$transaction:fn=>{const run=tail.then(()=>fn(tx));tail=run.catch(()=>{});return run}};
const mocks={'./index':{prisma},'@labgest/database':{prisma},'node:crypto':require('node:crypto'),'next/cache':{revalidatePath(){}},'@/lib/auth-utils':{requireUser:async()=>({id:10,nome:'Lab'})},'@/lib/cliente-identity':{requireClienteIdentity:async()=>({id:1,nome:'Cliente'})},'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{email:'fake@example.invalid'}}})}})}};
if(fs.existsSync('packages/database/src/mensagens.ts'))mocks['@labgest/database/src/mensagens']=load('packages/database/src/mensagens.ts',mocks);
const lab=load('web/src/actions/mensagens.ts',mocks),portal=load('portal/src/actions/mensagens.ts',mocks);
await Promise.all([lab.enviarMensagemLab(1,'A'),portal.enviarMensagem(1,'B')]);
assert.equal(rows.get(1).mensagens.length,2,'parallel lab + portal sends must preserve both messages');
assert.notEqual(rows.get(1).mensagens[0].id,rows.get(1).mensagens[1].id);
const seen=rows.get(1).mensagens.find(x=>x.role==='lab').id;
await lab.enviarMensagemLab(1,'new unread');
await portal.marcarMensagensLidas(1,[seen]);
assert.equal(rows.get(1).mensagens.filter(x=>x.role==='lab'&&!x.lidoPeloDentista).length,1,'receipt only covers displayed IDs');
assert.equal((await portal.enviarMensagem(2,'forbidden')).success,false);
assert.equal((await portal.lerMensagens(2)).success,false);
assert.equal((await portal.marcarMensagensLidas(2,[seen])).success,false);
assert.equal(rows.get(2).mensagens.length,0);
await Promise.all([portal.marcarMensagensLidas(1,[seen]),portal.enviarMensagem(1,'C')]);
assert.equal(rows.get(1).mensagens.length,4);
const retryId=require('node:crypto').randomUUID();
await Promise.all([portal.enviarMensagem(1,'retry',undefined,retryId),portal.enviarMensagem(1,'retry',undefined,retryId)]);
assert.equal(rows.get(1).mensagens.length,5,'same stable request ID must append only once');
console.log('PASS concurrent app sends, unique IDs, scoped reads/writes/receipts, observed-ID receipt, concurrent receipt/send (transaction double; not PostgreSQL)');
})().catch(e=>{console.error(e);process.exitCode=1});
