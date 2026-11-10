'use server'

import { prisma } from '@labgest/database'
import { revalidatePath } from 'next/cache'
import { requireRecepcao } from '@/lib/auth-utils'
import { movimentarCustodiaExterna, type ComandoCustodiaExterna } from '@/lib/recepcao-externa-db'

export async function movimentarRecepcaoExterna(input: ComandoCustodiaExterna) {
  const usuario = await requireRecepcao()
  try {
    const resultado = await movimentarCustodiaExterna(prisma, input, usuario)
    revalidatePath('/recepcao')
    revalidatePath('/labs-externos')
    return resultado
  } catch (error) {
    const message = error instanceof Error ? error.message : ''
    const known = /^(Comando externo inválido\.|Recepção externa indisponível\.|Pedido não encontrado\.|O pedido foi alterado\.|O registro foi alterado\.|Pedido encerrado|Informe o|Informe a|Motivo inválido\.|Este movimento|Situação externa desconhecida\.)/
    return { success: false, code: /^O (pedido|registro) foi alterado\./.test(message) ? 'CONFLICT' as const : 'FAILED' as const, error: known.test(message) ? message : 'Não foi possível confirmar a movimentação externa. Atualize e confira antes de tentar novamente.' }
  }
}
