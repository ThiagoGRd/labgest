'use server'

import { requireUser } from '@/lib/auth-utils'

/** Only the authenticated viewer's display name and navigation permissions. */
export async function getUsuarioNavegacao() {
  const user = await requireUser({ permitirRecepcao: true })
  return { nome: user.nome, email: user.email, tipo: user.tipo || '', permissoes: user.permissoes }
}
