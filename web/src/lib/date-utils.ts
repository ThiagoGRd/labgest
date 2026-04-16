/**
 * Utilitários de data — sem bug de fuso horário.
 *
 * O problema: new Date('2026-04-16') interpreta como UTC 00:00.
 * Em BRT (UTC-3) isso corresponde a 2026-04-15 21:00, fazendo
 * toLocaleDateString() exibir "15/04" ao invés de "16/04".
 *
 * Solução: parsear a string '2026-04-16' como data local, ou usar
 * os componentes numéricos do ISO string diretamente.
 */

/**
 * Formata uma string ISO date (ou Date) para dd/mm/yyyy no fuso local,
 * sem subtrair horas de UTC.
 */
export function formatDate(dateInput: string | Date): string {
  if (!dateInput) return '—'
  // Se for uma string ISO, extrai yyyy-mm-dd diretamente para evitar shift UTC
  const str = typeof dateInput === 'string' ? dateInput : dateInput.toISOString()
  const parts = str.split('T')[0].split('-') // ["2026", "04", "16"]
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`
  }
  // Fallback: tenta converter com ajuste de fuso
  const d = typeof dateInput === 'string' ? new Date(dateInput) : dateInput
  const offset = d.getTimezoneOffset() * 60000
  return new Date(d.getTime() + Math.abs(offset)).toLocaleDateString('pt-BR')
}

/**
 * Converte string ISO para valor de input type="date" (yyyy-mm-dd)
 * sem bug de fuso horário.
 */
export function toDateInputValue(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return ''
  const str = typeof dateInput === 'string' ? dateInput : dateInput.toISOString()
  return str.split('T')[0]
}

/**
 * Converte string de input type="date" ('yyyy-mm-dd') para Date
 * como data local (meio-dia) — evita bug de UTC meia-noite.
 */
export function parseDateLocal(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number)
  return new Date(year, month - 1, day, 12, 0, 0)
}

/**
 * Formata valor como BRL.
 */
export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value)
}
