import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap shrink-0 rounded-sm border font-mono font-semibold leading-none select-none transition-colors focus:outline-none focus:ring-1 focus:ring-cyan-500",
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
      size: {
        default: "h-[22px] px-2 text-[10px]",
        sm: "h-5 px-1.5 text-[9px]",
        lg: "h-6 px-2.5 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant, size }), className)} {...props} />
  );
}

export { Badge, badgeVariants };
