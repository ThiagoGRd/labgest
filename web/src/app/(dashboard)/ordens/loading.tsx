import { DashboardLayout } from '@/components/layout/dashboard-layout'

function Skeleton({ className }: { className: string }) {
  return <div className={`animate-pulse bg-slate-200/70 dark:bg-white/5 ${className}`} />
}

export default function OrdensLoading() {
  return (
    <DashboardLayout>
      <div className="space-y-5">
        <Skeleton className="h-24 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
          {Array.from({ length: 4 }).map((_, index) => <Skeleton key={index} className="h-24 rounded-2xl" />)}
        </div>
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-[620px] rounded-2xl" />
      </div>
    </DashboardLayout>
  )
}
