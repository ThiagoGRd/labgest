'use client'

import { useEffect } from 'react'
import { AlertTriangle, RotateCcw } from 'lucide-react'
import { DashboardLayout } from '@/components/layout/dashboard-layout'
import { Button } from '@/components/ui/button'

export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error('Falha ao carregar o Dashboard:', error)
  }, [error])

  return (
    <DashboardLayout>
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="max-w-md rounded-3xl border border-red-200 bg-white p-8 text-center shadow-sm dark:border-red-500/20 dark:bg-slate-900">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-300">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h2 className="mt-4 text-xl font-bold text-slate-950 dark:text-white">Não foi possível carregar o painel</h2>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Os dados não foram substituídos por zeros. Tente novamente para consultar as informações reais.</p>
        <Button type="button" onClick={reset} className="mt-6"><RotateCcw className="h-4 w-4" /> Tentar novamente</Button>
      </div>
    </div>
    </DashboardLayout>
  )
}
