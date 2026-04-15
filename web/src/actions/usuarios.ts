'use server'

import { prisma } from '@labgest/database'
import { createClient } from '@supabase/supabase-js'
import { revalidatePath } from 'next/cache'

// Cria o cliente Admin apenas quando chamado em runtime (não no build)
function getSupabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas.')
  }
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

export async function getUsuarios() {
  try {
    const usuarios = await prisma.usuario.findMany({
      orderBy: { nome: 'asc' }
    })
    return usuarios
  } catch (error) {
    return []
  }
}

export async function criarUsuario(data: {
  nome: string
  email: string
  tipo: string
  senhaProvisoria: string
}) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    // 1. Criar no Supabase Auth
    const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: data.email,
      password: data.senhaProvisoria,
      email_confirm: true,
      user_metadata: {
        full_name: data.nome,
        role: data.tipo
      }
    })

    if (authError) throw new Error(authError.message)

    // 2. Criar no Banco de Dados do Sistema
    await prisma.usuario.create({
      data: {
        id: undefined,
        nome: data.nome,
        email: data.email,
        tipo: data.tipo,
        senha: '',
        ativo: true,
        permissoes: data.tipo === 'admin' ? ['all'] : ['read', 'write'],
      }
    })

    revalidatePath('/configuracoes')
    return { success: true }
  } catch (error: any) {
    console.error('Erro ao criar usuário:', error)
    return { success: false, error: error.message || 'Erro ao criar usuário' }
  }
}

export async function toggleStatusUsuario(id: number, statusAtual: boolean) {
  try {
    await prisma.usuario.update({
      where: { id },
      data: { ativo: !statusAtual }
    })
    revalidatePath('/configuracoes')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Erro ao atualizar status' }
  }
}

export async function excluirUsuario(id: number, email: string) {
  try {
    const supabaseAdmin = getSupabaseAdmin()

    // 1. Buscar ID do Supabase pelo email
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers()
    const userAuth = users.find(u => u.email === email)

    // 2. Deletar do Supabase Auth
    if (userAuth) {
      await supabaseAdmin.auth.admin.deleteUser(userAuth.id)
    }

    // 3. Deletar do Banco
    await prisma.usuario.delete({
      where: { id }
    })

    revalidatePath('/configuracoes')
    return { success: true }
  } catch (error) {
    return { success: false, error: 'Erro ao excluir usuário' }
  }
}
