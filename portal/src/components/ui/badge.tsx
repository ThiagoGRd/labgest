import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
  {
    variants: {
      variant: {
        default: "bg-indigo-100 text-indigo-800",
        secondary: "bg-slate-100 text-slate-800",
        success: "bg-emerald-100 text-emerald-800",
        warning: "bg-amber-100 text-amber-800",
        destructive: "bg-red-100 text-red-800",
        outline: "border border-slate-300 text-slate-700",
        // Status específicos
        aguardando: "bg-slate-100 text-slate-700",
        emProducao: "bg-blue-100 text-blue-800",
        finalizado: "bg-emerald-100 text-emerald-800",
        cancelado: "bg-red-100 text-red-800",
        pausado: "bg-amber-100 text-amber-800",
        // Prioridades
        baixa: "bg-slate-100 text-slate-600",
        normal: "bg-blue-100 text-blue-700",
        alta: "bg-orange-100 text-orange-700",
        urgente: "bg-red-100 text-red-700 animate-pulse",
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
