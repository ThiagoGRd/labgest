import { getMateriaisDisponiveis, getServicos } from '@/actions/servicos'
import { ServicosView } from './servicos-view'
import { requireUser } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic'

export default async function ServicosPage() {
  const [servicos, materiais, usuario] = await Promise.all([
    getServicos(),
    getMateriaisDisponiveis(),
    requireUser(),
  ])
  const podeGerenciar = usuario.tipo === 'admin' || usuario.permissoes.includes('all')
  
  return <ServicosView initialData={servicos} materiaisDisponiveis={materiais} podeGerenciar={podeGerenciar} />
}
