'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@labgest/database'
import { redirect } from 'next/navigation'

export async function login(formData: FormData) {
  const email = formData.get('email') as string
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
    console.error('Login error:', error)
    return { error: 'Email ou senha inválidos' }
  }

  const usuario = data.user.email
    ? await prisma.usuario.findFirst({
        where: { email: { equals: data.user.email, mode: 'insensitive' }, ativo: true },
        select: { id: true },
      })
    : null

  if (!usuario) {
    await supabase.auth.signOut()
    return { error: 'Seu usuário não tem acesso ao LabGest Web' }
  }

  await prisma.usuario.update({ where: { id: usuario.id }, data: { ultimoAcesso: new Date() } })

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
