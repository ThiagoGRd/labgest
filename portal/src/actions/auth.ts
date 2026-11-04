'use server'

import { createClient } from '@/lib/supabase/server'
import { resolveClienteIdentity } from '@/lib/cliente-identity'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = formData.get('password') as string

  if (!email || !password) {
    return { error: 'Email e senha são obrigatórios' }
  }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  })

  if (error) {
    return { error: 'Email ou senha inválidos' }
  }

  const identity = await resolveClienteIdentity(data.user)
  if (!identity.ok) {
    await supabase.auth.signOut()
    return { error: identity.error }
  }

  redirect('/dashboard')
}

export async function cadastro(formData: FormData) {
  const nome = formData.get('nome') as string
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = formData.get('password') as string
  const cro = formData.get('cro') as string

  if (!email || !password || !nome || !cro) {
    return { error: 'Todos os campos são obrigatórios' }
  }

  const supabase = await createClient()

  // 1. Criar usuário no Auth
  const { data: authData, error: authError } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: nome,
        cro: cro,
      }
    }
  })

  if (authError) {
    return { error: authError.message }
  }

  if (!authData.user) {
    return { error: 'Erro ao criar usuário' }
  }

  // Public signup creates credentials only. Commercial enrollment and suspension
  // remain laboratory decisions, even when Auth returns an immediate session.
  await supabase.auth.signOut()
  return { message: 'Solicitação de acesso recebida. Confirme seu email, se receber a mensagem de confirmação, e peça ao laboratório para revisar e ativar seu cadastro. Depois, faça login.' }

}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
