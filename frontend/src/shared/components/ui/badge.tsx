import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-mono font-semibold transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500",
  {
    variants: {
      variant: {
        default:
          "border-transparent bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
        secondary:
          "border-transparent bg-zinc-800 text-zinc-300",
        destructive:
          "border-transparent bg-rose-500/20 text-rose-300 border-rose-500/30",
        outline: "text-zinc-200 border-white/10",
        admin: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
        operator: "bg-cyan-500/10 text-cyan-300 border-cyan-500/20",
        viewer: "bg-zinc-800/80 text-zinc-400 border-white/10",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
