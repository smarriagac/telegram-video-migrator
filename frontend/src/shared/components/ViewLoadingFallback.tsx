import React from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/shared/lib/utils";

interface ViewLoadingFallbackProps {
  className?: string;
  message?: string;
}

export const ViewLoadingFallback: React.FC<ViewLoadingFallbackProps> = ({
  className,
  message = "Cargando módulo...",
}) => {
  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex flex-col flex-1 w-full h-full p-4 sm:p-6 space-y-6 animate-pulse select-none",
        className
      )}
    >
      {/* Top Toolbar Skeleton */}
      <div className="flex items-center justify-between pb-4 border-b border-border/40">
        <div className="flex items-center gap-3">
          <div className="h-8 w-44 bg-muted/70 rounded-md" />
          <div className="h-6 w-20 bg-muted/50 rounded-full hidden sm:block" />
        </div>
        <div className="flex items-center gap-2">
          <div className="h-8 w-24 bg-muted/60 rounded-md" />
          <div className="h-8 w-28 bg-primary/20 rounded-md flex items-center justify-center gap-2 text-xs text-primary/70 font-medium">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span className="hidden sm:inline">{message}</span>
          </div>
        </div>
      </div>

      {/* Metric Cards Skeleton */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className="p-4 rounded-xl border border-border/50 bg-card/50 flex flex-col justify-between space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="h-4 w-24 bg-muted/70 rounded" />
              <div className="w-8 h-8 rounded-lg bg-muted/60" />
            </div>
            <div className="h-7 w-20 bg-muted/80 rounded" />
            <div className="h-3 w-32 bg-muted/40 rounded" />
          </div>
        ))}
      </div>

      {/* Main Body Skeleton */}
      <div className="flex-1 min-h-[280px] rounded-xl border border-border/50 bg-card/40 p-5 flex flex-col space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-border/30">
          <div className="h-5 w-36 bg-muted/70 rounded" />
          <div className="h-7 w-48 bg-muted/50 rounded-md" />
        </div>
        <div className="space-y-3 pt-2">
          {[1, 2, 3, 4, 5].map((row) => (
            <div
              key={row}
              className="h-10 w-full bg-muted/30 rounded-lg flex items-center px-4 justify-between"
            >
              <div className="h-4 w-1/4 bg-muted/60 rounded" />
              <div className="h-4 w-1/5 bg-muted/50 rounded hidden sm:block" />
              <div className="h-4 w-1/6 bg-muted/40 rounded hidden md:block" />
              <div className="h-6 w-16 bg-muted/60 rounded" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
