import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@prisma/client'

// Configurar o cliente Supabase com a chave de serviço (Service Role)
// Essa chave tem permissão total para criar usuários
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(supabaseUrl, supabaseServiceKey)
const prisma = new PrismaClient()

async function criarUsuario(nome: string, email: string, senha: string) {
  console.log(`🚀 Criando usuário para: ${email}...`)

  // 1. Criar usuário no Supabase Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password: senha,
    email_confirm: true, // Já confirma o email automaticamente
    user_metadata: { full_name: nome }
  })

  if (authError) {
    console.error('❌ Erro ao criar usuário no Auth:', authError.message)
    return
  }

  const userId = authData.user.id
  console.log('✅ Usuário criado no Auth com ID:', userId)

  // 2. Criar registro na tabela pública 'usuarios' (para o sistema LabGest)
  // O schema usa Int para ID, mas o Auth usa UUID. 
  // Vamos criar um usuário na tabela e tentar vincular pelo email.
  try {
    const usuario = await prisma.usuario.create({
      data: {
        nome,
        email,
        senha: 'auth-managed', // Senha gerenciada pelo Supabase Auth
        tipo: 'admin',
        ativo: true,
        // O campo 'id' será gerado automaticamente (autoincrement)
      }
    })
    console.log(`✅ Usuário criado no Banco de Dados com ID: ${usuario.id}`)
    console.log('🎉 Tudo pronto! Pode logar no sistema.')
  } catch (dbError) {
    console.error('❌ Erro ao criar usuário no Banco:', dbError)
  }
}

// Ler argumentos da linha de comando
const args = process.argv.slice(2)
if (args.length < 3) {
  console.log('Uso: npx tsx scripts/criar-usuario.ts "Nome" "email" "senha"')
  process.exit(1)
}

criarUsuario(args[0], args[1], args[2])
