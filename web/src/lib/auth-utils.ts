import { createClient } from '@/lib/supabase/server'
import { prisma } from '@labgest/database'

export async function requireUser(opcoes: { permitirRecepcao?: boolean } = {}) {
  const supabase = await createClient()
  const { data: { user }, error } = await supabase.auth.getUser()

  if (error || !user?.email) throw new Error('Não autorizado')

  const usuario = await prisma.usuario.findFirst({
    where: { email: { equals: user.email, mode: 'insensitive' }, ativo: true },
    select: { id: true, email: true, nome: true, tipo: true, permissoes: true },
  })
  if (!usuario) throw new Error('Usuário sem acesso ao LabGest Web')
  if (usuario.tipo === 'recepcao' && !opcoes.permitirRecepcao) {
    throw new Error('Este perfil possui acesso somente ao painel da recepção')
  }

  return usuario
}

export async function requireAdmin() {
  const usuario = await requireUser()
  if (usuario.tipo !== 'admin' && !usuario.permissoes.includes('all')) {
    throw new Error('Acesso restrito a administradores')
  }
  return usuario
}

export async function requireRecepcao() {
  const usuario = await requireUser({ permitirRecepcao: true })
  const autorizado = usuario.tipo === 'admin'
    || usuario.tipo === 'operador'
    || usuario.tipo === 'recepcao'
    || usuario.permissoes.includes('all')
    || usuario.permissoes.includes('recepcao:movimentar')
  if (!autorizado) throw new Error('Acesso restrito à recepção e à equipe do laboratório')
  return usuario
}
