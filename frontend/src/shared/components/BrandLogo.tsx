import React from "react";
import { cn } from "@/shared/lib/utils";

interface BrandLogoProps {
  className?: string;
  size?: "sm" | "md" | "lg";
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className,
  size = "md",
}) => {
  const sizeMap = {
    sm: "w-5 h-5",
    md: "w-7 h-7",
    lg: "w-10 h-10",
  };

  return (
    <img
      src="/logo.svg"
      alt="Telegram Video Migrator Logo"
      className={cn("rounded-md object-contain shrink-0 shadow-sm shadow-cyan-950/40", sizeMap[size], className)}
    />
  );
};
