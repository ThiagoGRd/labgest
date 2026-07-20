import { DashboardLayout } from '@/components/layout/dashboard-layout'

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-200/70 dark:bg-white/5 ${className}`} />
}

export default function PrioridadesLoading() {
  return (
    <DashboardLayout>
      <div className="space-y-5">
        <div className="rounded-2xl border border-slate-200 bg-white/70 p-6 dark:border-slate-800 dark:bg-slate-900/60">
          <Skeleton className="h-8 w-44" />
          <Skeleton className="mt-3 h-4 w-72 max-w-full" />
        </div>
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-28 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-20 rounded-2xl" />
        <div className="grid gap-5 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <Skeleton key={index} className="h-72 rounded-3xl" />
          ))}
        </div>
      </div>
    </DashboardLayout>
  )
}
