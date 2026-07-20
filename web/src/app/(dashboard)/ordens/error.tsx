'use client'

import { AlertTriangle, RotateCcw } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'

export default function OrdensError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <DashboardLayout>
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="max-w-md rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-900/60 dark:bg-slate-900">
          <AlertTriangle className="mx-auto h-10 w-10 text-red-600" />
          <h1 className="mt-4 text-xl font-semibold text-slate-950 dark:text-white">Não foi possível carregar as ordens</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Nenhum dado foi substituído por uma lista vazia. Tente carregar novamente.
          </p>
          <Button className="mt-5" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
