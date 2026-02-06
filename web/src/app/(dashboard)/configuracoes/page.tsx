import { getLabConfig } from '@/actions/configuracoes'
import { getUsuarios } from '@/actions/usuarios'
import { ConfiguracoesView } from './configuracoes-view'

export const dynamic = 'force-dynamic'

export default async function ConfiguracoesPage() {
  const [config, usuarios] = await Promise.all([
    getLabConfig(),
    getUsuarios()
  ])

  return <ConfiguracoesView initialConfig={config} usuarios={usuarios} />
}
