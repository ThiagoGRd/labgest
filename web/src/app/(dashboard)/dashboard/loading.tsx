import { DashboardLayout } from '@/components/layout/dashboard-layout'

export default function DashboardLoading() {
  return (
    <DashboardLayout>
    <div className="space-y-6 p-4 sm:p-6" aria-label="Carregando painel">
      <div className="h-20 animate-pulse rounded-2xl bg-slate-200/70 dark:bg-white/5" />
      <div className="flex gap-2">
        {[1, 2, 3, 4].map((item) => <div key={item} className="h-10 w-28 animate-pulse rounded-lg bg-slate-200/70 dark:bg-white/5" />)}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[1, 2, 3, 4].map((item) => <div key={item} className="h-36 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-white/5" />)}
      </div>
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-3">
        <div className="h-96 animate-pulse rounded-3xl bg-slate-200/70 xl:col-span-2 dark:bg-white/5" />
        <div className="h-96 animate-pulse rounded-3xl bg-slate-200/70 dark:bg-white/5" />
      </div>
    </div>
    </DashboardLayout>
  )
}
