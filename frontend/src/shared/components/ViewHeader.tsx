import React from "react";
import { cn } from "@/shared/lib/utils";

export interface ViewHeaderProps {
  icon?: React.ReactNode;
  iconBoxColor?: "cyan" | "emerald" | "indigo" | "amber" | "rose" | "none";
  title: string;
  subtitle: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const ViewHeader: React.FC<ViewHeaderProps> = ({
  icon,
  iconBoxColor = "cyan",
  title,
  subtitle,
  badge,
  children,
  className,
}) => {
  const colorMap = {
    cyan: "bg-cyan-500/10 border-cyan-500/20 text-cyan-400",
    emerald: "bg-emerald-500/10 border-emerald-500/20 text-emerald-400",
    indigo: "bg-indigo-500/10 border-indigo-500/20 text-indigo-400",
    amber: "bg-amber-500/10 border-amber-500/20 text-amber-400",
    rose: "bg-rose-500/10 border-rose-500/20 text-rose-400",
    none: "",
  };

  return (
    <header
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-2.5 flex-shrink-0",
        className
      )}
    >
      <div>
        <div className="flex items-center space-x-2.5">
          {icon &&
            (iconBoxColor === "none" ? (
              icon
            ) : (
              <div
                className={cn(
                  "w-7 h-7 rounded-md border flex items-center justify-center shrink-0 shadow-sm shadow-black/40",
                  colorMap[iconBoxColor]
                )}
              >
                {icon}
              </div>
            ))}
          <h1 className="text-base sm:text-lg font-bold tracking-tight text-white flex items-center gap-2">
            <span>{title}</span>
            {badge}
          </h1>
        </div>
        <p className="text-[11px] text-zinc-400 mt-0.5">{subtitle}</p>
      </div>

      {children && (
        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          {children}
        </div>
      )}
    </header>
  );
};
