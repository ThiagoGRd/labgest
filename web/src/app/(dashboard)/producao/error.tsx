'use client'

import { AlertTriangle, RefreshCw } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Header } from '@/components/layout/header'
import { Button } from '@/components/ui/button'

export default function ProducaoError({ reset }: { error: Error; reset: () => void }) {
  return (
    <DashboardLayout>
      <Header title="Produção" subtitle="Não foi possível carregar os dados" />
      <main className="flex min-h-[60vh] items-center justify-center p-6">
        <section className="max-w-md rounded-2xl border border-red-200 bg-white p-6 text-center shadow-sm dark:border-red-900/50 dark:bg-zinc-900">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-600" />
          <h2 className="mt-4 text-lg font-bold text-slate-900 dark:text-white">A produção não carregou</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Nenhuma ordem foi escondida. Tente novamente; se o problema continuar, avise o responsável pelo sistema.
          </p>
          <Button type="button" onClick={reset} className="mt-5 bg-indigo-600 text-white hover:bg-indigo-700">
            <RefreshCw className="h-4 w-4" /> Tentar novamente
          </Button>
        </section>
      </main>
    </DashboardLayout>
  )
}
