import { getOrdens, getDadosNovaOrdem } from '@/actions/ordens'
import { OrdensView } from './ordens-view'

export const dynamic = 'force-dynamic'

export default async function OrdensPage() {
  const ordens = await getOrdens()
  const { clientes, servicos } = await getDadosNovaOrdem()
  
  return <OrdensView initialData={ordens} clientes={clientes} servicos={servicos} />
}
