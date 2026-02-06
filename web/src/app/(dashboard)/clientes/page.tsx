import { getClientes } from '@/actions/clientes'
import { ClientesView } from './clientes-view'

export const dynamic = 'force-dynamic'

export default async function ClientesPage() {
  const clientes = await getClientes()
  
  return <ClientesView initialData={clientes} />
}
