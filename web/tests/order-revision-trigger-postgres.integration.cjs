/* eslint-disable @typescript-eslint/no-require-imports */
// Actual legacy trigger, migration and application helpers; pg adapter, not Prisma runtime.
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),crypto=require('node:crypto')
process.env.TZ='UTC'
const {Client}=require('pg'),ts=require('typescript')
const root=path.resolve(__dirname,'../..'),database='labgest_order_trigger_test'
const url=new URL(process.argv[2]||'http://missing')
assert.equal(url.protocol,'postgresql:');assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/'+database);assert.equal(url.username,'labgest_archive_test');assert.equal(url.password,'synthetic-only');assert.equal(url.search,'');assert.equal(url.hash,'');assert.ok(Number(url.port)>0)
const config={host:'127.0.0.1',port:Number(url.port),user:url.username,password:url.password,database,connectionTimeoutMillis:3000,query_timeout:5000}
const migration=path.join(root,'packages/database/prisma/migrations/20261104020000_order_revision_trigger/migration.sql')
const hashes={},results=[],locks=[]
function load(file,mocks={}){const source=fs.readFileSync(path.join(root,file),'utf8');hashes[file]=crypto.createHash('sha256').update(source).digest('hex');const exports={};vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Date,require:n=>{assert.ok(n in mocks,n);return mocks[n]}});return exports}
async function main(){const admin=new Client({...config,database:'postgres'});let created=false,c,w,h;try{
 await admin.connect();assert.equal((await admin.query('SELECT host(inet_server_addr()) a')).rows[0].a,'127.0.0.1');assert.equal((await admin.query('SELECT 1 FROM pg_database WHERE datname=$1',[database])).rowCount,0,'Refusing existing database');await admin.query('CREATE DATABASE labgest_order_trigger_test');created=true
 c=new Client(config);await c.connect();await c.query(`CREATE TABLE public.ordens(id integer PRIMARY KEY,cliente_id integer,mensagens jsonb NOT NULL DEFAULT '[]',updated_at timestamp(6));CREATE TABLE public.clientes(id integer PRIMARY KEY,updated_at timestamp(6));CREATE FUNCTION public.update_updated_at_column() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN NEW.updated_at = CURRENT_TIMESTAMP; RETURN NEW; END; $$;CREATE TRIGGER update_ordens_updated_at BEFORE UPDATE ON public.ordens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON public.clientes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();INSERT INTO ordens(id,cliente_id,updated_at) VALUES(1,1,'2099-01-01');INSERT INTO clientes VALUES(1,'2099-01-01')`)
 await c.query(`ALTER TABLE clientes ADD COLUMN synthetic_total integer NOT NULL DEFAULT 0;CREATE FUNCTION public.synthetic_totals() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN UPDATE public.clientes SET synthetic_total=synthetic_total+1 WHERE id=COALESCE(NEW.cliente_id,OLD.cliente_id);RETURN NULL;END; $$;CREATE TRIGGER trigger_atualizar_totais_cliente AFTER INSERT OR DELETE OR UPDATE ON public.ordens FOR EACH ROW EXECUTE FUNCTION public.synthetic_totals()` )
 const aggregateTrigger=(await c.query("SELECT pg_get_triggerdef(oid) definition,tgfoid::text function FROM pg_trigger WHERE tgrelid='public.ordens'::regclass AND tgname='trigger_atualizar_totais_cliente'")).rows
 const shared=(await c.query("SELECT oid,pg_get_functiondef(oid) definition FROM pg_proc WHERE oid='public.update_updated_at_column()'::regprocedure")).rows[0]
 const clientTrigger=(await c.query("SELECT pg_get_triggerdef(oid) definition,tgfoid::text function FROM pg_trigger WHERE tgrelid='public.clientes'::regclass AND NOT tgisinternal")).rows
 const legacy=(await c.query("UPDATE ordens SET updated_at='2099-01-01 00:00:00.001' WHERE id=1 RETURNING updated_at")).rows[0].updated_at
 assert.ok(legacy.getTime()<Date.parse('2099-01-01'));results.push('Exact legacy trigger reproduces explicit future revision rollback')
 if(process.argv.includes('--legacy')){assert.ok(legacy.getTime()>Date.parse('2099-01-01'),'legacy trigger must preserve monotonic revision');return}
 const sql=fs.readFileSync(migration,'utf8');hashes[path.relative(root,migration)]=crypto.createHash('sha256').update(sql).digest('hex')
 await c.query('ALTER FUNCTION public.update_updated_at_column() RENAME TO unexpected_timestamp_function')
 assert.equal((await c.query("SELECT to_regprocedure('public.update_updated_at_column()') f")).rows[0].f,null)
 await assert.rejects(c.query(sql),/legacy order trigger/i);await c.query('ROLLBACK')
 assert.equal((await c.query("SELECT to_regprocedure('public.labgest_ordens_monotonic_updated_at()') f")).rows[0].f,null)
 await c.query('ALTER FUNCTION public.unexpected_timestamp_function() RENAME TO update_updated_at_column')
 results.push('Missing expected shared-function name rejects an unexpected same-body trigger function without migration effects')
 await c.query('ALTER TABLE ordens DISABLE TRIGGER update_ordens_updated_at')
 await assert.rejects(c.query(sql),/legacy order trigger/i);await c.query('ROLLBACK')
 assert.equal((await c.query("SELECT to_regprocedure('public.labgest_ordens_monotonic_updated_at()') f")).rows[0].f,null)
 await c.query('ALTER TABLE ordens ENABLE TRIGGER update_ordens_updated_at')
 await c.query('CREATE TRIGGER synthetic_other_update BEFORE UPDATE ON public.ordens FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column()');await assert.rejects(c.query(sql),/Additional BEFORE UPDATE/);await c.query('ROLLBACK');await c.query('DROP TRIGGER synthetic_other_update ON public.ordens')
 const before=(await c.query('SELECT * FROM ordens')).rows;await c.query(sql.replace(/COMMIT;\s*$/, 'ROLLBACK;'));assert.equal((await c.query("SELECT to_regprocedure('public.labgest_ordens_monotonic_updated_at()') f")).rows[0].f,null);await c.query(sql);assert.deepEqual((await c.query('SELECT * FROM ordens')).rows,before,'migration must not rewrite existing rows')
 assert.deepEqual((await c.query("SELECT oid,pg_get_functiondef(oid) definition FROM pg_proc WHERE oid='public.update_updated_at_column()'::regprocedure")).rows[0],shared)
 assert.deepEqual((await c.query("SELECT pg_get_triggerdef(oid) definition,tgfoid::text function FROM pg_trigger WHERE tgrelid='public.clientes'::regclass AND NOT tgisinternal")).rows,clientTrigger)
 assert.deepEqual((await c.query("SELECT pg_get_triggerdef(oid) definition,tgfoid::text function FROM pg_trigger WHERE tgrelid='public.ordens'::regclass AND tgname='trigger_atualizar_totais_cliente'")).rows,aggregateTrigger)
 results.push('Transactional migration rejects disabled/additional BEFORE triggers, rolls back atomically, preserves rows/shared function/client and AFTER aggregate trigger')
 const revision=load('packages/shared/src/order-transition.ts')
 function adapter(client){return {$queryRaw:async(s,...v)=>(await client.query(s.reduce((a,b,i)=>a+(i?'$'+i:'')+b,''),v)).rows,ordem:{findFirst:async({where})=>(await client.query('SELECT id,cliente_id AS "clienteId",mensagens,updated_at AS "updatedAt" FROM ordens WHERE id=$1'+(where.clienteId===undefined?'':' AND cliente_id=$2'),where.clienteId===undefined?[where.id]:[where.id,where.clienteId])).rows[0],update:async({where,data})=>(await client.query('UPDATE ordens SET mensagens=$1::jsonb,updated_at=$2 WHERE id=$3 RETURNING *',[JSON.stringify(data.mensagens),data.updatedAt,where.id])).rows[0]}}}
 const prisma={$transaction:async fn=>{await c.query('BEGIN');try{const r=await fn(adapter(c));await c.query('COMMIT');return r}catch(e){await c.query('ROLLBACK');throw e}}}
 const messages=load('packages/database/src/mensagens.ts',{'./index':{prisma},'@labgest/shared':revision})
 await c.query("INSERT INTO ordens(id,cliente_id,updated_at) VALUES(2,1,'2099-01-01')")
 const totalBefore=(await c.query('SELECT synthetic_total FROM clientes WHERE id=1')).rows[0].synthetic_total
 await messages.alterarMensagens(2,1,rows=>[...rows,{id:'synthetic',role:'dentista',texto:'test'}])
 assert.equal((await c.query('SELECT updated_at FROM ordens WHERE id=2')).rows[0].updated_at.toISOString(),'2099-01-01T00:00:00.001Z')
 assert.equal((await c.query('SELECT synthetic_total FROM clientes WHERE id=1')).rows[0].synthetic_total,totalBefore+1)
 const noOp=(await c.query('SELECT updated_at,xmin::text FROM ordens WHERE id=2')).rows[0];await messages.alterarMensagens(2,1,rows=>rows);assert.deepEqual((await c.query('SELECT updated_at,xmin::text FROM ordens WHERE id=2')).rows[0],noOp)
 assert.equal((await c.query('SELECT synthetic_total FROM clientes WHERE id=1')).rows[0].synthetic_total,totalBefore+1)
 results.push('Actual application message/revision helper + real trigger preserves future revisions, no-op xmin and AFTER-trigger effect count')
 for(const zone of ['UTC','Pacific/Auckland']){await c.query('BEGIN');await c.query("SELECT set_config('TimeZone',$1,true)",[zone]);await c.query("INSERT INTO ordens VALUES(3,1,'[]','2099-01-01 00:00:00.123456')")
 let prev=Date.parse('2099-01-01T00:00:00.123Z');for(let i=0;i<4;i++){const row=(await c.query('UPDATE ordens SET updated_at=NULL WHERE id=3 RETURNING updated_at')).rows[0];assert.equal(row.updated_at.getTime(),prev+1);prev=row.updated_at.getTime()}
 await c.query("INSERT INTO ordens VALUES(6,1,'[]',NULL)");const clockBefore=(await c.query('SELECT clock_timestamp() t')).rows[0].t;const initialized=(await c.query('UPDATE ordens SET updated_at=NULL WHERE id=6 RETURNING updated_at')).rows[0].updated_at;const clockAfter=(await c.query('SELECT clock_timestamp() t')).rows[0].t;assert.ok(initialized.getTime()>=clockBefore.getTime()&&initialized.getTime()<=clockAfter.getTime(),'NULL original must initialize to UTC execution clock regardless of SQL session timezone')
 assert.equal((await c.query("UPDATE ordens SET updated_at='2100-01-01' WHERE id=3 RETURNING updated_at")).rows[0].updated_at.toISOString(),'2100-01-01T00:00:00.000Z')
 await c.query("INSERT INTO ordens VALUES(7,1,'[]','2099-12-31 23:59:59.999999')");assert.equal((await c.query('UPDATE ordens SET updated_at=NULL WHERE id=7 RETURNING updated_at')).rows[0].updated_at.toISOString(),'2100-01-01T00:00:00.000Z')
 const client=(await c.query('UPDATE clientes SET updated_at=\'2099-01-01\' WHERE id=1 RETURNING updated_at=CURRENT_TIMESTAMP::timestamp AS original_behavior')).rows[0];assert.equal(client.original_behavior,true)
 await c.query('ROLLBACK');assert.equal((await c.query('SELECT 1 FROM ordens WHERE id=3')).rowCount,0);results.push('Multiple writes/fractional millisecond/NULL incoming/rollback and unchanged clientes in '+zone)}
 await c.query("INSERT INTO ordens VALUES(4,1,'[]',NULL)");assert.ok((await c.query('UPDATE ordens SET updated_at=NULL WHERE id=4 RETURNING updated_at')).rows[0].updated_at instanceof Date)
 await c.query('BEGIN');await assert.rejects(c.query("UPDATE ordens SET updated_at='infinity' WHERE id=4"),/finite/i);await c.query('ROLLBACK');results.push('NULL original initializes; nonfinite requested revision rejects without update')
 await c.query("INSERT INTO ordens VALUES(5,1,'[]','infinity')");await c.query('BEGIN');await assert.rejects(c.query('UPDATE ordens SET updated_at=NULL WHERE id=5'),/finite/i);await c.query('ROLLBACK');assert.equal((await c.query('SELECT updated_at::text t FROM ordens WHERE id=5')).rows[0].t,'infinity')
 w=new Client(config);h=new Client(config);await w.connect();await h.connect();await w.query('BEGIN');await w.query('SELECT CURRENT_TIMESTAMP');await h.query('BEGIN');await h.query('SELECT id FROM ordens WHERE id=1 FOR UPDATE');const first=(await h.query('UPDATE ordens SET updated_at=NULL WHERE id=1 RETURNING updated_at')).rows[0].updated_at
 const wp=w.processID,hp=h.processID,pending=w.query('UPDATE ordens SET updated_at=NULL WHERE id=1 RETURNING updated_at');let blocked=false;for(let i=0;i<100;i++){const q=await c.query("SELECT pid,pg_blocking_pids(pid) blockers FROM pg_stat_activity WHERE pid=$1 AND wait_event_type='Lock' AND $2=ANY(pg_blocking_pids(pid))",[wp,hp]);if(q.rowCount){locks.push(q.rows[0]);blocked=true;break}await new Promise(r=>setTimeout(r,10))}assert.ok(blocked,'must observe old-start transaction blocked by exact holder');await h.query('COMMIT');const second=(await pending).rows[0].updated_at;assert.ok(second.getTime()>first.getTime());await w.query('ROLLBACK');assert.equal((await c.query('SELECT updated_at FROM ordens WHERE id=1')).rows[0].updated_at.getTime(),first.getTime());results.push('Transaction started before lock acquisition advances past committed holder; rollback preserves holder revision')
 console.log(JSON.stringify({result:'PASS',method:'native PostgreSQL with exact legacy triggers, real migration and actual app helpers via pg adapter; not generated Prisma',results,locks,hashes},null,2))
 }finally{for(const client of [w,h,c])if(client)await client.end();if(created)await admin.query('DROP DATABASE labgest_order_trigger_test');await admin.end()}}
main().catch(e=>{console.error(e);process.exitCode=1})
