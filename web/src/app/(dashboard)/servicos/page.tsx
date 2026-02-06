import { getServicos } from '@/actions/servicos'
import { ServicosView } from './servicos-view'

export const dynamic = 'force-dynamic'

export default async function ServicosPage() {
  const servicos = await getServicos()
  
  return <ServicosView initialData={servicos} />
}
