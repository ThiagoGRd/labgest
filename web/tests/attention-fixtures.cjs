const order = (id,nomePaciente,extra={})=>({id,nomePaciente,servicoNome:'Prótese sintética',clienteNome:'Clínica fictícia',dataEntrega:'2026-11-03T00:00:00Z',etapaAtual:'confeccao',status:'Em Produção',prioridade:'Normal',cpfCadastrado:false,...extra})
const ana=order(1,'Ana Sintética'),bia=order(2,'Bia Sintética',{status:'Em Prova',etapaAtual:'em_prova'})
const prod=(o,extra={})=>({...o,paciente:o.nomePaciente,dentista:o.clienteNome,servico:o.servicoNome,etapa:o.etapaAtual,entrega:o.dataEntrega,tipoWorkflow:'',passoFluxoAtual:null,cicloStatus:null,...extra})
const fixtures={
 dashboard:{initialData:{usuario:{nome:'Equipe Teste',email:'teste@example.invalid',tipo:'Administrador'},totalOrdensMes:4,totalOrdensMesAnterior:2,emAndamento:3,atrasadas:2,entregasHoje:1,retornosPendentes:3,semEtapa:1,prontasParaEntrega:1,recebidoMes:100,saldoEmAberto:200,contasEmAberto:2,vencendoSeteDias:50,contasVencendoSeteDias:1,proximasEntregas:[]}},
 prioridades:{user:{nome:'Equipe Teste',email:'teste@example.invalid',tipo:'Administrador'},respostasDentista:[],fornecedorAtrasado:[],atrasados:[ana],prazoVencido:[ana,bia],provasPendentesClinicorp:[bia],hoje:[ana],urgentes:[],proximos:[],clinicorpConfigurado:false,dataReferencia:'2026-11-04T00:00:00Z'},
 producao:{initialOrdens:[prod(ana,{cicloAtivoId:11,cicloStatus:'em_prova',cicloDentistaDeci:'aprovado'}),prod(bia,{status:'Pausado',cicloAtivoId:12,cicloStatus:'em_prova',cicloDentistaDeci:'ajuste'})],semEtapaIds:[1],retornosDashboard:[{id:10,numeroCiclo:1,decisao:'aprovado',ordemId:1,paciente:'Ana Sintética',cliente:'Clínica fictícia',status:'Em Produção'},{id:11,numeroCiclo:2,decisao:'aprovado',ordemId:1,paciente:'Ana Sintética',cliente:'Clínica fictícia',status:'Em Produção'},{id:12,numeroCiclo:1,decisao:'ajuste',ordemId:2,paciente:'Bia Sintética',cliente:'Clínica fictícia',status:'Pausado'}]},
 ordens:{resultado:{ordens:[],total:0,totalGeral:0,totalPaginas:1,pagina:1,contadores:{ativas:0,emProva:0,finalizadas:0,pausadas:0}},filtros:{},clientes:[{id:7,nome:'Clínica fictícia'}],servicos:[],user:{nome:'Equipe Teste',email:'teste@example.invalid',tipo:'Administrador'}}
}

if (location.search.includes('empty=1')) {
  for (const key of ['atrasados','prazoVencido','provasPendentesClinicorp','hoje']) fixtures.prioridades[key]=[]
  fixtures.producao.initialOrdens=[];fixtures.producao.semEtapaIds=[];fixtures.producao.retornosDashboard=[]
}
