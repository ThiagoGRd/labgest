const fs=require('node:fs'),assert=require('node:assert/strict'),vm=require('node:vm'),ts=require(require('node:path').join(process.env.LABGEST_TEST_TOOLS || require('node:path').resolve(__dirname,'../node_modules'),'typescript'));
for(const app of ['web','portal']) {
 const path=`${app}/src/lib/message-sync.ts`;
 assert.ok(fs.existsSync(path),'message merge must exist');
 const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,Map});
 const result=exports.mergeMessages([{id:'a',texto:'old'},{id:'b',texto:'send completed'}],[{id:'a',texto:'server',lido:true}]);
 assert.equal(result.length,2);assert.equal(result[0].texto,'server');assert.equal(result[1].id,'b');
 const chat=fs.readFileSync(`${app}/src/components/${app==='web'?'ordens/chat-ordem':'pedidos/chat-pedido'}.tsx`,'utf8');
 assert.match(chat,/key=\{props.ordemId\}/,'changing order must reset local message and draft state');
 assert.match(chat,/useMessageSync\(ordemId, mensagens, setMensagens\)/);
}
const realtime=fs.readFileSync('web/src/components/providers/realtime-orders.tsx','utf8');
assert.doesNotMatch(realtime,/postgres_changes|payload.new|\.subscribe\(/,'refresh must not broadcast patient records');
console.log('PASS merge preserves in-flight send and server receipts; both chats wired; no patient-data subscription (static wiring checks)');
