import { createClient } from '@/lib/supabase/server'
import { prisma } from '@labgest/database'

export const CLIENTE_IDENTITY_ERROR = 'Acesso indisponível: confirme seu email e solicite ao laboratório a revisão do seu cadastro. Seus pedidos e valores não podem ser exibidos até a regularização.'

type IdentityUser = { id?: string; email?: string; email_confirmed_at?: string } | null

// Ownership is granted only through a separately reviewed UUID-to-client binding.
// Email confirmation proves possession, never authorization to historical records.
export async function resolveClienteIdentity(user?: IdentityUser) {
  if (user === undefined) {
    const supabase = await createClient()
    const result = await supabase.auth.getUser()
    user = result.data.user
  }
  if (!user?.id || !user.email_confirmed_at) {
    return { ok: false as const, error: CLIENTE_IDENTITY_ERROR }
  }
  try {
    const bindings = await prisma.$queryRaw<Array<{ cliente_id: number }>>`
      SELECT cliente_id FROM labgest_private.portal_client_binding
      WHERE auth_user_id = ${user.id}::uuid
    `
    if (bindings.length !== 1) return { ok: false as const, error: CLIENTE_IDENTITY_ERROR }
    const cliente = await prisma.cliente.findUnique({ where: { id: bindings[0].cliente_id } })
    if (!cliente?.ativo) return { ok: false as const, error: CLIENTE_IDENTITY_ERROR }
    return { ok: true as const, cliente }
  } catch {
    // A missing migration, revoked permission or unavailable DB must never fall
    // back to matching a presented email or display a fabricated empty account.
    return { ok: false as const, error: CLIENTE_IDENTITY_ERROR }
  }
}

export async function requireClienteIdentity() {
  const result = await resolveClienteIdentity()
  if (!result.ok) throw new Error(result.error)
  return result.cliente
}
