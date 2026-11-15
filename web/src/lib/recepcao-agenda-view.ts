// Clinic wall time uses America/Maceio (UTC-03:00, with no current DST).
export function dataHoraMaceio(valor: string | null) {
  if (!valor) return ''
  return new Date(new Date(valor).getTime() - 3 * 3_600_000).toISOString().slice(0, 16)
}
export function instanteMaceio(valor: string) {
  return new Date(`${valor}:00-03:00`).toISOString()
}
export function correspondeBusca(item: { paciente: string; clinica: string; servico: string; dentista: string; agendamentoDentista: string | null; id: number }, termo: string) {
  return [item.paciente, item.clinica, item.servico, item.dentista, item.agendamentoDentista || '', String(item.id)].some(valor => valor.toLocaleLowerCase('pt-BR').includes(termo))
}
