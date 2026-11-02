import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap shrink-0 rounded-sm border font-mono font-semibold leading-none select-none transition-colors focus:outline-none focus:ring-1 focus:ring-primary",
  {
    variants: {
      variant: {
        default:
          "border-primary/30 bg-primary/15 text-primary",
        secondary:
          "border-transparent bg-secondary text-secondary-foreground",
        destructive:
          "border-destructive/30 bg-destructive/15 text-destructive",
        outline: "text-foreground border-border bg-card/60",
        admin: "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400 border-emerald-500/20",
        operator: "bg-primary/10 text-primary border-primary/20",
        viewer: "bg-muted text-muted-foreground border-border",
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
