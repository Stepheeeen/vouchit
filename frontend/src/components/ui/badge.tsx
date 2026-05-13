import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex items-center border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-widest transition-colors focus:outline-none",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-[var(--foreground)] text-[var(--background)]",
        secondary:
          "border-transparent bg-[var(--muted)] text-[var(--muted-foreground)]",
        destructive:
          "border-transparent bg-[var(--foreground)] text-[var(--background)]", // Monochrome danger
        success:
          "border-[var(--foreground)] bg-transparent text-[var(--foreground)]", // Monochrome success (outline style)
        outline: "text-[var(--foreground)] border-[var(--border)]",
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
