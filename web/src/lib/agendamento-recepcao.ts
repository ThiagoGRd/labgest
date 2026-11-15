export function prepararAgendamento(confirmado: boolean, dentista?: string, data?: string) {
  if (typeof confirmado !== 'boolean' || (dentista !== undefined && (typeof dentista !== 'string' || dentista.length > 255)) || (data !== undefined && typeof data !== 'string')) throw new Error('Dados de agendamento inválidos.')
  if (!confirmado) return { confirmado: false, dentista: null, data: null }
  let instante: Date | null = null
  if (data) {
    const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?(Z|[+-]\d{2}:\d{2})$/.exec(data)
    if (!m) throw new Error('Informe um agendamento válido.')
    const [year, month, day, hour, minute, second] = m.slice(1, 7).map(Number)
    const check = new Date(Date.UTC(year, month - 1, day, hour, minute, second))
    const offset = m[8] === 'Z' ? [0, 0] : m[8].slice(1).split(':').map(Number)
    if (year < 100 || check.getUTCFullYear() !== year || check.getUTCMonth() !== month - 1 || check.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59 || offset[0] > 23 || offset[1] > 59) throw new Error('Informe um agendamento válido.')
    instante = new Date(data)
    if (Number.isNaN(instante.getTime())) throw new Error('Informe um agendamento válido.')
  }
  return { confirmado: true, dentista: dentista?.trim() || null, data: instante }
}
