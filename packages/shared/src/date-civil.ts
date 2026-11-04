/** Convert an actual event instant to the laboratory calendar day carried at UTC midnight (@db.Date). */
export function dataCivilDoLaboratorio(evento = new Date()): Date {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Maceio', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(evento)
  const parte = (tipo: Intl.DateTimeFormatPartTypes) => Number(partes.find(p => p.type === tipo)?.value)
  return new Date(Date.UTC(parte('year'), parte('month') - 1, parte('day')))
}
