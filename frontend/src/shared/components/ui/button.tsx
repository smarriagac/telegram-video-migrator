import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/shared/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-xs font-medium ring-offset-background transition-all focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-cyan-500 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default:
          "bg-zinc-100 text-zinc-950 hover:bg-white active:scale-[0.98] font-medium shadow-sm",
        primary:
          "bg-cyan-500 text-zinc-950 hover:bg-cyan-400 active:scale-[0.98] font-semibold shadow-sm",
        destructive:
          "bg-rose-500/10 text-rose-300 border border-rose-500/20 hover:bg-rose-500/20 active:scale-[0.98]",
        outline:
          "border border-zinc-800 bg-zinc-900/40 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-200 active:scale-[0.98]",
        secondary:
          "bg-zinc-800 text-zinc-200 hover:bg-zinc-700 active:scale-[0.98]",
        ghost:
          "hover:bg-zinc-800/60 text-zinc-400 hover:text-zinc-200 active:scale-[0.98]",
        link:
          "text-cyan-400 underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-4 py-2",
        sm: "h-8 rounded-md px-3",
        lg: "h-10 rounded-md px-6 text-sm",
        icon: "h-9 w-9",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";

export { Button, buttonVariants };
