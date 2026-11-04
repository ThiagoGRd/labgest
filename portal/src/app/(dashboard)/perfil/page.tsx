import { requireClienteIdentity } from '@/lib/cliente-identity'
import { getProfile } from '@/actions/profile'
import { PerfilView } from './perfil-view'

export const dynamic = 'force-dynamic'

export default async function PerfilPage() {
  const cliente = await requireClienteIdentity()
  
  const profile = await getProfile()

  const userData = {
    nome: cliente.nome,
    email: cliente.email || '',
    cro: cliente.cro || '',
  }

  return <PerfilView user={userData} profile={profile} />
}
