import { format, formatDistanceToNow, isToday, isTomorrow, isPast, differenceInDays } from 'date-fns'
import { ptBR } from 'date-fns/locale'

// Formatar data para exibição
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, 'dd/MM/yyyy', { locale: ptBR })
}

// Formatar data e hora
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return format(d, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
}

// Formatar data relativa (há 2 dias, etc)
export function formatRelativeDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date
  return formatDistanceToNow(d, { addSuffix: true, locale: ptBR })
}

// Formatar moeda BRL
export function formatCurrency(value: number | string): string {
  const num = typeof value === 'string' ? parseFloat(value) : value
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(num)
}

// Formatar telefone brasileiro
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '')
  if (cleaned.length === 11) {
    return cleaned.replace(/(\d{2})(\d{5})(\d{4})/, '($1) $2-$3')
  } else if (cleaned.length === 10) {
    return cleaned.replace(/(\d{2})(\d{4})(\d{4})/, '($1) $2-$3')
  }
  return phone
}

// Status da data de entrega
export function getDeliveryStatus(deliveryDate: Date | string): {
  label: string
  color: 'red' | 'yellow' | 'green' | 'gray'
  isLate: boolean
} {
  const d = typeof deliveryDate === 'string' ? new Date(deliveryDate) : deliveryDate
  const days = differenceInDays(d, new Date())
  
  if (isPast(d) && !isToday(d)) {
    return { label: 'Atrasado', color: 'red', isLate: true }
  }
  if (isToday(d)) {
    return { label: 'Hoje', color: 'yellow', isLate: false }
  }
  if (isTomorrow(d)) {
    return { label: 'Amanhã', color: 'yellow', isLate: false }
  }
  if (days <= 3) {
    return { label: `${days} dias`, color: 'yellow', isLate: false }
  }
  return { label: formatDate(d), color: 'green', isLate: false }
}

// Gerar iniciais do nome
export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()
}

// Truncar texto
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text
  return text.slice(0, maxLength - 3) + '...'
}

// Formatar tamanho de arquivo
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes'
  const k = 1024
  const sizes = ['Bytes', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// Gerar cor a partir de string (para avatares)
export function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const colors = [
    '#6366f1', '#8b5cf6', '#a855f7', '#d946ef', 
    '#ec4899', '#f43f5e', '#ef4444', '#f97316',
    '#eab308', '#84cc16', '#22c55e', '#14b8a6',
    '#06b6d4', '#0ea5e9', '#3b82f6', '#6366f1'
  ]
  return colors[Math.abs(hash) % colors.length]
}
