/* Disposable loopback PostgreSQL only. Real action/helper source; native SQL adapter replaces Prisma runtime. */
const path=require('node:path'),fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),crypto=require('node:crypto');
const {Client,Pool}=require(require.resolve('pg',{paths:[process.env.LABGEST_PG_TEST_TOOLS||path.resolve(__dirname,'../node_modules')]}));
const ts=require(require.resolve('typescript',{paths:[process.env.LABGEST_TEST_TOOLS||path.resolve(__dirname,'../node_modules')]}));
const root=path.resolve(__dirname,'..'),database='labgest_chat_test';
const url=new URL(process.env.LABGEST_CHAT_TEST_DATABASE_URL||'postgresql://labgest_archive_test:synthetic-only@127.0.0.1:55432/labgest_chat_test');
assert.equal(url.protocol,'postgresql:');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/'+database);assert.equal(url.username,'labgest_archive_test');assert.equal(url.password,'synthetic-only');assert.equal(url.search,'');assert.equal(url.hash,'');assert.ok(Number(url.port)>0);
const config={host:'127.0.0.1',port:Number(url.port),user:'labgest_archive_test',password:'synthetic-only',database,application_name:'labgest-chat-test',connectionTimeoutMillis:3000,query_timeout:5000};
const hashes={},sql=new Set();
function load(file,mocks){const source=fs.readFileSync(path.join(root,file),'utf8');hashes[file]=crypto.createHash('sha256').update(source).digest('hex');const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:n=>{if(n in mocks)return mocks[n];throw Error('Unexpected dependency '+n)},console,Date,Set});return exports}
(async()=>{
 const admin=new Client({...config,database:'postgres'});await admin.connect();let created=false,pool;
 try {
  const endpoint=(await admin.query('SELECT current_database() db,host(inet_server_addr()) address')).rows[0];assert.equal(endpoint.db,'postgres');assert.equal(endpoint.address,'127.0.0.1');
  const exists=await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database]);assert.equal(exists.rowCount,0,'Refusing existing database; test never overwrites databases');
  await admin.query('CREATE DATABASE labgest_chat_test');created=true;pool=new Pool({...config,max:8});
  await pool.query('CREATE TABLE ordens (id integer PRIMARY KEY, cliente_id integer NOT NULL, mensagens jsonb NOT NULL DEFAULT \'[]\'::jsonb)');
  await pool.query('INSERT INTO ordens(id,cliente_id) VALUES (1,1),(2,2)');
  const legacy={id:'legacy',role:'dentista',nome:'Historical',texto:'preserve',createdAt:'2020-01-01T00:00:00Z',extra:{audit:'unchanged'}};
  await pool.query('UPDATE ordens SET mensagens=$1::jsonb WHERE id=1',[JSON.stringify([legacy])]);
  let observe=false,first=false,waits=0;
  function adapter(client){return {
   $queryRaw:async(strings,...values)=>{const text=strings.reduce((out,s,i)=>out+(i?'$'+i:'')+s,'');sql.add(text);const hold=observe&&!first;if(hold)first=true;const result=await client.query(text,values);
    if(hold){let blocked=false;for(let i=0;i<100;i++){const q=await pool.query("SELECT 1 FROM pg_stat_activity WHERE application_name='labgest-chat-test' AND wait_event_type='Lock'");if(q.rowCount){blocked=true;waits++;break}await new Promise(r=>setTimeout(r,10))}assert.ok(blocked,'must observe PostgreSQL lock wait from overlapping actions')}return result.rows},
   ordem:{findFirst:async({where})=>{const text='SELECT id, cliente_id AS "clienteId", mensagens FROM ordens WHERE id=$1'+(where.clienteId===undefined?'':' AND cliente_id=$2');sql.add(text);const result=await client.query(text,where.clienteId===undefined?[where.id]:[where.id,where.clienteId]);return result.rows[0]||null},update:async({where,data})=>{const text='UPDATE ordens SET mensagens=$1::jsonb WHERE id=$2';sql.add(text);await client.query(text,[JSON.stringify(data.mensagens),where.id])}}
  }}
  const prisma={...adapter(pool),$transaction:async fn=>{const client=await pool.connect();try{await client.query('BEGIN');const result=await fn(adapter(client));await client.query('COMMIT');return result}catch(e){await client.query('ROLLBACK');throw e}finally{client.release()}}};
  const base={'./index':{prisma},'@labgest/database':{prisma},'node:crypto':crypto,'next/cache':{revalidatePath(){}}};
  base['@labgest/database/src/mensagens']=load('packages/database/src/mensagens.ts',base);
  const lab=load('web/src/actions/mensagens.ts',{...base,'@/lib/auth-utils':{requireUser:async()=>({id:10,nome:'Synthetic lab'})}});
  const labOther=load('web/src/actions/mensagens.ts',{...base,'@/lib/auth-utils':{requireUser:async()=>({id:11,nome:'Other synthetic lab'})}});
  const portal=load('portal/src/actions/mensagens.ts',{...base,'@/lib/cliente-identity':{requireClienteIdentity:async()=>({id:1,nome:'Synthetic cliente'})}});
  const unauthorized=load('portal/src/actions/mensagens.ts',{...base,'@/lib/cliente-identity':{requireClienteIdentity:async()=>{throw Error('Identity rejected')}}});
  const messages=async()=> (await pool.query('SELECT mensagens FROM ordens WHERE id=1')).rows[0].mensagens;
  const sendLab=()=>lab.enviarMensagemLab(1,'lab'),sendDentist=()=>portal.enviarMensagem(1,'dentist');
  for(const [a,b] of [[sendLab,sendDentist],[sendLab,sendLab],[sendDentist,sendDentist]]){const before=(await messages()).length;observe=true;first=false;const result=await Promise.all([a(),b()]);observe=false;assert.ok(result.every(r=>r.success));assert.equal((await messages()).length,before+2)}
  assert.equal(new Set((await messages()).map(m=>m.id)).size,7);
  const displayed=(await messages()).filter(m=>m.role==='lab').map(m=>m.id);observe=true;first=false;
  await Promise.all([portal.marcarMensagensLidas(1,displayed),lab.enviarMensagemLab(1,'unseen')]);observe=false;
  assert.equal((await messages()).filter(m=>m.role==='lab'&&!m.lidoPeloDentista).length,1);
  const id=crypto.randomUUID();observe=true;first=false;const retry=await Promise.all([portal.enviarMensagem(1,'retry',undefined,id),portal.enviarMensagem(1,'retry',undefined,id)]);observe=false;
  assert.ok(retry.every(r=>r.success));assert.equal((await messages()).filter(m=>m.id===id).length,1);
  assert.equal((await lab.enviarMensagemLab(1,'spoof',undefined,id)).success,false,'another role cannot claim successful replay');
  const labId=crypto.randomUUID();await lab.enviarMensagemLab(1,'original',undefined,labId);assert.equal((await labOther.enviarMensagemLab(1,'spoof',undefined,labId)).success,false,'another actor cannot claim successful replay');
  assert.equal((await portal.enviarMensagem(2,'forbidden')).success,false);assert.equal((await portal.lerMensagens(2)).success,false);assert.equal((await portal.marcarMensagensLidas(2,[id])).success,false);
  await assert.rejects(()=>unauthorized.enviarMensagem(1,'denied'),/Identity rejected/);
  const snapshot=await messages();assert.equal((await portal.enviarMensagem(1,'invalid',undefined,'not-a-uuid')).success,false);assert.deepEqual(await messages(),snapshot);
  assert.deepEqual((await messages()).find(m=>m.id==='legacy'),legacy,'historical JSON metadata must be preserved');
  console.log(JSON.stringify({result:'PASS',method:'actual source + PostgreSQL native SQL adapter; auth identity boundaries simulated, Prisma runtime not used',observedPostgresLockWaits:waits,cases:['lab/dentist','lab/lab','dentist/dentist','receipt/append unseen remains unread','stable-ID concurrent retry','cross-role and cross-actor replay rejected','foreign-order read/write/receipt denied','resolver denial before mutation','invalid request UUID rejected','historical JSON metadata preserved'],sourceHashes:hashes,executedSql:[...sql]},null,2));
 }finally{if(pool)await pool.end();if(created)await admin.query('DROP DATABASE labgest_chat_test');await admin.end()}
})().catch(e=>{console.error(e);process.exitCode=1});
