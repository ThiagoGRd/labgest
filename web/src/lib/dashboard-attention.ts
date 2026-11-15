// Shared by counts and contextual queues: do not substitute operational queue rules.
export const STATUS_ENCERRADOS = ['Finalizado', 'Cancelado', 'Entregue']
export const STATUS_FORA_DA_FILA = [...STATUS_ENCERRADOS, 'Pausado']
export const ordensAtivas = { status: { notIn: STATUS_FORA_DA_FILA } }
export const retornosRespondidos = {
  status: 'em_prova', decisao: { not: null },
  ordem: { status: { notIn: STATUS_ENCERRADOS } },
}
export const ordensSemEtapa = { ...ordensAtivas, passoFluxoAtual: null }
export function ordensAtrasadas(hoje: Date) {
  return { ...ordensAtivas, dataEntrega: { lt: hoje } }
}
export function entregasDoDia(hoje: Date, amanha: Date) {
  return { ...ordensAtivas, dataEntrega: { gte: hoje, lt: amanha } }
}
export function contextoAtencao(value: string | null, pagina: 'prioridades' | 'producao') {
  if (pagina === 'prioridades' && (value === 'atrasadas' || value === 'hoje')) return value
  if (pagina === 'producao' && (value === 'retornos' || value === 'sem-etapa')) return value
  return null
}
export function limparAtencao(pathname: string, query: string) {
  const params = new URLSearchParams(query)
  params.delete('atencao')
  return pathname + (params.size ? `?${params}` : '')
}
export interface RetornoDashboard {
  id: number
  numeroCiclo: number
  decisao: string | null
  ordemId: number
  paciente: string
  cliente: string
  status: string | null
}
