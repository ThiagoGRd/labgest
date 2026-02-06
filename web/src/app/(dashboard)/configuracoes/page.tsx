import { getLabConfig } from '@/actions/configuracoes'
import { ConfiguracoesView } from './configuracoes-view'

export const dynamic = 'force-dynamic'

export default async function ConfiguracoesPage() {
  const config = await getLabConfig()

  return <ConfiguracoesView initialConfig={config} />
}
