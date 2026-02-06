'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'

export async function getNotificacoesConfig() {
  // Por enquanto retorna mock, mas preparado para ler do banco se criarmos tabela de configs de usuário
  // O ideal seria salvar isso num campo JSON 'preferencias' no modelo Usuario
  return {
    novaOrdem: true,
    atrasos: true,
    estoqueBaixo: true,
    ordemFinalizada: false,
    resumoDiario: false
  }
}

export async function saveNotificacoesConfig(config: any) {
  // Aqui implementaríamos o update no banco
  // Ex: await prisma.usuario.update({ where: { email: user.email }, data: { preferencias: config } })
  
  console.log('Salvando preferências:', config)
  revalidatePath('/configuracoes')
  return { success: true }
}
