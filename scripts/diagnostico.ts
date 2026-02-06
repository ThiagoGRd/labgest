import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function diagnostico() {
  console.log('🔍 Iniciando diagnóstico do banco de dados...')
  
  try {
    // 1. Contar Clientes
    const totalClientes = await prisma.cliente.count()
    console.log(`✅ Clientes encontrados: ${totalClientes}`)
    
    if (totalClientes > 0) {
      const primeiro = await prisma.cliente.findFirst()
      console.log('   Exemplo:', primeiro?.nome)
    }

    // 2. Contar Ordens
    const totalOrdens = await prisma.ordem.count()
    console.log(`✅ Ordens encontradas: ${totalOrdens}`)

    // 3. Contar Serviços
    const totalServicos = await prisma.servico.count()
    console.log(`✅ Serviços encontrados: ${totalServicos}`)

  } catch (error) {
    console.error('❌ Erro ao conectar/ler banco:', error)
  } finally {
    await prisma.$disconnect()
  }
}

diagnostico()
