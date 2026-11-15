import { ShieldAlert } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { requireAdmin } from '@/lib/auth-utils'
import { atualizarAlertas } from '@/lib/controle-tratamentos'
import { TratamentosView } from './tratamentos-view'

export const dynamic = 'force-dynamic'

export default async function TratamentosPage() {
  try {
    await requireAdmin()
  } catch {
    return (
      <DashboardLayout>
        <Header title="Controle de tratamentos" subtitle="Acesso restrito" />
        <main className="flex min-h-[60vh] items-center justify-center p-6">
          <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-white/10 dark:bg-slate-900">
            <ShieldAlert className="mx-auto h-10 w-10 text-slate-400" />
            <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">Página exclusiva do gestor</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">O acompanhamento de consultas e prazos por tratamento é visível apenas para administradores.</p>
          </section>
        </main>
      </DashboardLayout>
    )
  }

  // Os alertas de tempo vencem com o passar dos dias: reavalia a cada abertura da página.
  const { painel } = await atualizarAlertas()
  return <TratamentosView painel={painel} />
}
