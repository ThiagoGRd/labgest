// Clinic wall time uses America/Maceio (UTC-03:00, with no current DST).
function normalizarTextoBusca(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('pt-BR')
}

export function dataHoraMaceio(valor: string | null) {
  if (!valor) return ''
  const ms = Date.parse(valor)
  if (!Number.isFinite(ms)) return ''
  return new Date(ms - 3 * 3_600_000).toISOString().slice(0, 16)
}

export function instanteMaceio(valor: string) {
  const limpo = valor.trim()
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::(\d{2}))?$/.exec(limpo)
  if (!match) return ''
  const segundos = match[2] ?? '00'
  const dt = new Date(`${match[1]}:${segundos}-03:00`)
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString()
}

export function correspondeBusca(
  item: {
    paciente: string
    clinica: string
    servico: string
    dentista: string
    agendamentoDentista: string | null
    id: number
    clinicorp?: { proximaConsulta?: { dentistaNome?: string | null } | null } | null
  },
  termo: string,
) {
  const alvo = normalizarTextoBusca(termo)
  if (!alvo) return true
  return [
    item.paciente,
    item.clinica,
    item.servico,
    item.dentista,
    item.agendamentoDentista || '',
    item.clinicorp?.proximaConsulta?.dentistaNome || '',
    String(item.id),
  ].some((valor) => normalizarTextoBusca(valor).includes(alvo))
}
