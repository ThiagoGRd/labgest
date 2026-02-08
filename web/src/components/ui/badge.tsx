import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-lg px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider transition-all duration-300 border shadow-sm",
  {
    variants: {
      variant: {
        default: "bg-indigo-50 text-indigo-700 border-indigo-200",
        secondary: "bg-slate-50 text-slate-700 border-slate-200",
        success: "bg-emerald-50 text-emerald-700 border-emerald-200",
        warning: "bg-amber-50 text-amber-700 border-amber-200",
        destructive: "bg-red-50 text-red-700 border-red-200",
        outline: "border-slate-300 text-slate-700",
        // Status específicos
        aguardando: "bg-slate-50 text-slate-500 border-slate-200",
        emProducao: "bg-blue-50 text-blue-600 border-blue-200",
        finalizado: "bg-emerald-50 text-emerald-600 border-emerald-200",
        cancelado: "bg-red-50 text-red-600 border-red-200",
        pausado: "bg-amber-50 text-amber-600 border-amber-200",
        // Prioridades
        baixa: "bg-slate-50 text-slate-400 border-slate-200",
        normal: "bg-indigo-50 text-indigo-600 border-indigo-200",
        alta: "bg-orange-50 text-orange-600 border-orange-200",
        urgente: "bg-red-600 text-white border-red-700 animate-pulse",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  )
}

export { Badge, badgeVariants }
