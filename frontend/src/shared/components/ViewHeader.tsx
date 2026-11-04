import React from "react";
import { cn } from "@/shared/lib/utils";

export interface ViewHeaderProps {
  icon?: React.ReactNode;
  iconBoxColor?: "cyan" | "emerald" | "indigo" | "amber" | "rose" | "none";
  title?: string;
  subtitle?: string;
  badge?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export const ViewHeader: React.FC<ViewHeaderProps> = ({
  badge,
  children,
  className,
}) => {
  // In the hierarchical layout, module titles and subtitles live in the top breadcrumb header.
  // ViewHeader acts as a clean toolbar for module controls, badges and filters without duplicating titles.
  if (!children && !badge) return null;

  return (
    <div
      className={cn(
        "flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 border-b border-border/60 pb-2 flex-shrink-0 w-full",
        className
      )}
    >
      <div className="flex items-center gap-2 empty:hidden">
        {badge}
      </div>

      {children && (
        <div className="flex items-center gap-2 flex-wrap shrink-0 self-start sm:self-auto">
          {children}
        </div>
      )}
    </div>
  );
};
