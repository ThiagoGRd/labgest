import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Adiciona um determinado número de dias corridos, pulando apenas os Domingos (0).
 */
export function addDaysSkippingSundays(days: number, startDate: Date = new Date()): Date {
  let count = 0
  const dateObj = new Date(startDate)

  while (count < days) {
    dateObj.setDate(dateObj.getDate() + 1)
    if (dateObj.getDay() !== 0) {
      count++
    }
  }

  return dateObj
}

/**
 * Converte string ISO ou Date para valor de input type="date" (yyyy-mm-dd)
 */
export function toDateInputValue(dateInput: string | Date | null | undefined): string {
  if (!dateInput) return ''
  const str = typeof dateInput === 'string' ? dateInput : dateInput.toISOString()
  return str.split('T')[0]
}
