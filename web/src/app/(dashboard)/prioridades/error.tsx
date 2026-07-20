'use client'

import { AlertTriangle, RotateCcw } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'

export default function PrioridadesError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <DashboardLayout>
      <div className="flex min-h-[65vh] items-center justify-center">
        <div className="max-w-md rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-900/60 dark:bg-slate-900">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-950/50 dark:text-red-300">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-slate-950 dark:text-white">Não foi possível carregar as prioridades</h1>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Os números não foram substituídos por valores falsos. Tente carregar novamente.
          </p>
          <Button className="mt-5" onClick={reset}>
            <RotateCcw className="h-4 w-4" /> Tentar novamente
          </Button>
        </div>
      </div>
    </DashboardLayout>
  )
}
