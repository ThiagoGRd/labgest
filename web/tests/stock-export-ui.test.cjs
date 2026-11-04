/* eslint-disable @typescript-eslint/no-require-imports */
const test = require('node:test'), assert = require('node:assert/strict'), fs = require('node:fs'), vm = require('node:vm'), path = require('node:path'), ts = require('typescript')
// Executes the real component callbacks with isolated React/UI/browser boundaries.
// It verifies export wiring and error suppression; not browser layout or actual print output.
function fixture(fail = false) {
  const states = [], calls = [], downloads = [], errors = [], prints = []
  let index = 0
  const rows = Array.from({length:1001}, (_, i) => ({id:i+1,itemNome:'Material',tipo:'Entrada',quantidade:1,unidade:'un',saldoAnterior:0,saldoPosterior:1,motivo:'Teste',documento:'',ordemId:null,usuarioNome:'Teste',createdAt:'2020-03-10T12:00:00Z'}))
  const react = {useRef:()=>({current:null}),useEffect:()=>{},useState(initial){const slot=index++;states[slot]=typeof initial==='function'?initial():initial;return [states[slot],value=>{states[slot]=typeof value==='function'?value(states[slot]):value}]}}
  const ui = new Proxy({}, {get:(_,name)=>name})
  const exports = {}
  const source=fs.readFileSync(path.join(__dirname,'../src/app/(dashboard)/estoque/estoque-view.tsx'),'utf8')
  vm.runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>{
    if(n==='react')return react
    if(n==='react/jsx-runtime')return {jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}
    if(n==='react-dom')return{flushSync:fn=>fn()}
    if(n==='next/navigation')return{useRouter:()=>({refresh(){}})}
    if(n==='react-to-print')return{useReactToPrint:()=>()=>prints.push(states.find(v=>Array.isArray(v)&&v.length===1001))}
    if(n==='sonner')return{toast:{error:m=>errors.push(m)}}
    if(n==='@/actions/estoque')return{getMovimentacoesEstoque:async()=>({}),exportarMovimentacoesEstoque:async mes=>{calls.push(mes);if(fail)throw Error('read failed');return rows}}
    return ui
  },Intl,Date,Number,Set,URL:{createObjectURL:()=> 'blob:test',revokeObjectURL(){}},Blob:class{constructor(parts){downloads.push(parts.join(''))}},document:{createElement:()=>({click(){}})}})
  const tree=exports.EstoqueView({initialData:{itens:[],movimentacoes:[],emitidoEm:'2020-03-15T12:00:00Z'}})
  const nodes=[];function walk(node){if(!node||typeof node!=='object')return;if(Array.isArray(node)){node.forEach(walk);return}nodes.push(node);walk(node.props?.children)}walk(tree)
  const historyCsv=nodes.find(n=>n.props?.children?.includes?.('Exportar mês completo'))
  const report=nodes.find(n=>n.props?.titulo==='Movimentações')
  return{historyCsv,report,calls,downloads,errors,prints,rows}
}
test('history CSV, report CSV and PDF all fetch complete selected month, including 1001 rows',async()=>{
  const f=fixture();await f.historyCsv.props.onClick();await f.report.props.onCsv();await f.report.props.onPrint();
  assert.deepEqual(f.calls,['2020-03','2020-03','2020-03']);assert.equal(f.downloads.length,2);for(const csv of f.downloads)assert.equal(csv.split('\n').length,1002);assert.equal(f.prints[0].length,1001);assert.equal(f.errors.length,0)
})
test('all three export entries surface read failure without stale CSV or PDF output',async()=>{
  const f=fixture(true);await f.historyCsv.props.onClick();await f.report.props.onCsv();await f.report.props.onPrint();assert.equal(f.calls.length,3);assert.equal(f.errors.length,3);assert.equal(f.downloads.length,0);assert.equal(f.prints.length,0)
})
