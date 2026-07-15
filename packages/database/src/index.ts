import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export function getPrisma() {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({
      log: process.env.NODE_ENV === 'development'
        ? ['query', 'error', 'warn']
        : ['error'],
    })
  }
  return globalForPrisma.prisma
}

// Mantém a API existente (`prisma.ordem...`) sem abrir conexão durante a
// simples avaliação dos módulos feita pelo `next build`.
export const prisma = new Proxy({} as PrismaClient, {
  get(_target, propriedade) {
    const cliente = getPrisma()
    const valor = Reflect.get(cliente, propriedade, cliente)
    return typeof valor === 'function' ? valor.bind(cliente) : valor
  },
})

export * from '@prisma/client'
export default prisma
