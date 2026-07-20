import { getOrdens, getDadosNovaOrdem } from '@/actions/ordens'
import { requireUser } from '@/lib/auth-utils'
import { OrdensView } from './ordens-view'

export const dynamic = 'force-dynamic'

interface OrdensPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function parametro(valor: string | string[] | undefined) {
  return Array.isArray(valor) ? valor[0] : valor
}

export default async function OrdensPage({ searchParams }: OrdensPageProps) {
  const params = await searchParams
  const filtros = {
    busca: parametro(params.busca),
    status: parametro(params.status) || 'ativas',
    clienteId: Number(parametro(params.cliente)) || undefined,
    tipoWorkflow: parametro(params.tipo),
    ordenar: (parametro(params.ordenar) || 'prazo') as 'prazo' | 'recentes' | 'atualizadas' | 'paciente',
    pagina: Number(parametro(params.pagina)) || 1,
  }

  const [resultado, dadosNovaOrdem, usuario] = await Promise.all([
    getOrdens(filtros),
    getDadosNovaOrdem(),
    requireUser(),
  ])
  const { clientes, servicos } = dadosNovaOrdem
  
  return (
    <OrdensView
      resultado={resultado}
      clientes={clientes}
      servicos={servicos}
      filtros={filtros}
      user={{
        nome: usuario.nome,
        email: usuario.email,
        tipo: usuario.tipo === 'admin' ? 'Administrador' : 'Operador',
      }}
    />
  )
}
