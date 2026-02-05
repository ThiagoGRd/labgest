// Status de Ordens
export const ORDER_STATUS = {
  AGUARDANDO: 'Aguardando',
  EM_PRODUCAO: 'Em Produção',
  FINALIZADO: 'Finalizado',
  CANCELADO: 'Cancelado',
  PAUSADO: 'Pausado',
} as const

export type OrderStatus = typeof ORDER_STATUS[keyof typeof ORDER_STATUS]

// Prioridades
export const PRIORITY = {
  BAIXA: 'Baixa',
  NORMAL: 'Normal',
  ALTA: 'Alta',
  URGENTE: 'Urgente',
} as const

export type Priority = typeof PRIORITY[keyof typeof PRIORITY]

// Tipos de Usuário
export const USER_TYPE = {
  ADMIN: 'admin',
  OPERADOR: 'operador',
  VISUALIZADOR: 'visualizador',
} as const

export type UserType = typeof USER_TYPE[keyof typeof USER_TYPE]

// Categorias de Serviço
export const SERVICE_CATEGORY = {
  PROTESE_TOTAL: 'Prótese Total',
  PARCIAL_REMOVIVEL: 'Parcial Removível',
  PROVISORIO_UNITARIO: 'Provisório Unitário',
  PONTE_ADESIVA: 'Ponte Adesiva',
  PROTOCOLO: 'Protocolo',
  GERAL: 'Geral',
} as const

export type ServiceCategory = typeof SERVICE_CATEGORY[keyof typeof SERVICE_CATEGORY]

// Status Financeiro
export const FINANCIAL_STATUS = {
  PENDENTE: 'Pendente',
  RECEBIDO: 'Recebido',
  PAGO: 'Pago',
  VENCIDO: 'Vencido',
  CANCELADO: 'Cancelado',
} as const

export type FinancialStatus = typeof FINANCIAL_STATUS[keyof typeof FINANCIAL_STATUS]

// Tipos de Arquivo
export const FILE_TYPE = {
  STL: 'stl',
  ZIP: 'zip',
  FOTO: 'foto',
  DOCUMENTO: 'documento',
} as const

export type FileType = typeof FILE_TYPE[keyof typeof FILE_TYPE]

// Severidade de Alertas
export const ALERT_SEVERITY = {
  INFO: 'info',
  WARNING: 'warning',
  ERROR: 'error',
  SUCCESS: 'success',
} as const

export type AlertSeverity = typeof ALERT_SEVERITY[keyof typeof ALERT_SEVERITY]
