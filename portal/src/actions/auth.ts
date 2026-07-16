'use server'

import { createClient } from '@/lib/supabase/server'
import { prisma } from '@labgest/database'
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

  const cliente = data.user.email
    ? await prisma.cliente.findFirst({
        where: { email: { equals: data.user.email, mode: 'insensitive' }, ativo: true },
        select: { id: true },
      })
    : null
  if (!cliente) {
    await supabase.auth.signOut()
    return { error: 'Seu cadastro não está ativo no portal' }
  }

  redirect('/dashboard')
}

export async function cadastro(formData: FormData) {
  const nome = formData.get('nome') as string
  const email = String(formData.get('email') || '').trim().toLowerCase()
  const password = formData.get('password') as string
  const telefone = formData.get('telefone') as string
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

  // 2. Criar registro na tabela de Clientes (público)
  try {
    // Verifica se já existe cliente com esse email (pode ter sido cadastrado pelo lab antes)
    const existingCliente = await prisma.cliente.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } }
    })

    if (existingCliente) {
      // Se já existe, atualiza os dados
      await prisma.cliente.update({
        where: { id: existingCliente.id },
        data: {
          nome, // Atualiza nome se necessário
          telefone,
          cro, // Garante CRO atualizado
          ativo: true
        }
      })
    } else {
      // Se não existe, cria novo
      await prisma.cliente.create({
        data: {
          nome,
          email,
          telefone,
          cro,
          ativo: true,
          endereco: '', // Endereço pode ser preenchido depois no perfil
        }
      })
    }
  } catch (dbError) {
    console.error('Erro ao criar cliente no banco:', dbError)
    await supabase.auth.signOut()
    return { error: 'A conta de acesso foi criada, mas o cadastro da clínica falhou. Entre em contato com o laboratório.' }
  }

  redirect('/dashboard')
}

export async function logout() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/login')
}
