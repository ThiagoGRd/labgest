import { createClient } from '@/lib/supabase/server'
import { getProfile } from '@/actions/profile'
import { PerfilView } from './perfil-view'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  const profile = await getProfile()

  const userData = {
    nome: user?.user_metadata?.full_name || 'Dentista',
    email: user?.email || '',
    cro: user?.user_metadata?.cro || '',
  }

  return <PerfilView user={userData} profile={profile} />
}
