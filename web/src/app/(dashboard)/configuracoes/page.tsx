import { getLabConfig } from '@/actions/configuracoes'
import { getUsuarios } from '@/actions/usuarios'
import { getNotificacoesConfig } from '@/actions/notificacoes'
import { ConfiguracoesView } from './configuracoes-view'

export const dynamic = 'force-dynamic'

export default async function ConfiguracoesPage() {
  const [config, usuarios, initialNotificacoes] = await Promise.all([
    getLabConfig(),
    getUsuarios(),
    getNotificacoesConfig(),
  ])

  return <ConfiguracoesView initialConfig={config} usuarios={usuarios} initialNotificacoes={initialNotificacoes} />
}

