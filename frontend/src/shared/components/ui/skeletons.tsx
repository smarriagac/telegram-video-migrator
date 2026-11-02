import React from "react";
import { Skeleton } from "./skeleton";
import { cn } from "@/shared/lib/utils";

export interface TableSkeletonProps {
  rows?: number;
  columns?: number;
  className?: string;
}

export const TableSkeleton: React.FC<TableSkeletonProps> = ({
  rows = 5,
  columns = 5,
  className,
}) => {
  return (
    <div className={cn("w-full space-y-2.5 p-3", className)}>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <div
          key={`skel-row-${rIdx}`}
          className="flex items-center gap-4 py-2 border-b border-border/40 last:border-none"
        >
          {Array.from({ length: columns }).map((_, cIdx) => (
            <Skeleton
              key={`skel-cell-${rIdx}-${cIdx}`}
              className={cn(
                "h-4 rounded",
                cIdx === 0
                  ? "w-2/5"
                  : cIdx === columns - 1
                  ? "w-16 ml-auto"
                  : "w-1/4"
              )}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

export const StatGridSkeleton: React.FC<{ count?: number }> = ({ count = 4 }) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 sm:gap-2.5 shrink-0">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`skel-stat-${i}`}
          className="p-2.5 sm:p-3 rounded-lg border border-border bg-card space-y-2 shadow-sm"
        >
          <div className="flex items-center justify-between">
            <Skeleton className="h-2.5 w-24 rounded" />
            <Skeleton className="h-3.5 w-3.5 rounded-full" />
          </div>
          <Skeleton className="h-6 w-14 rounded" />
          <Skeleton className="h-2.5 w-32 rounded" />
        </div>
      ))}
    </div>
  );
};

export const ChatListSkeleton: React.FC<{ count?: number }> = ({ count = 7 }) => {
  return (
    <div className="space-y-2 p-2">
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={`skel-chat-${i}`}
          className="flex items-center gap-3 p-2 rounded-lg border border-transparent bg-secondary/30"
        >
          <Skeleton className="w-9 h-9 rounded-full shrink-0" />
          <div className="flex-1 space-y-1.5 min-w-0">
            <div className="flex items-center justify-between">
              <Skeleton className="h-3.5 w-28 rounded" />
              <Skeleton className="h-2.5 w-10 rounded" />
            </div>
            <Skeleton className="h-2.5 w-40 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
};

export const ChatMessagesSkeleton: React.FC<{ count?: number }> = ({ count = 5 }) => {
  return (
    <div className="space-y-3 p-4 flex-1">
      {Array.from({ length: count }).map((_, i) => {
        const isOutgoing = i % 2 !== 0;
        return (
          <div
            key={`skel-msg-${i}`}
            className={cn(
              "flex flex-col gap-1 max-w-[70%]",
              isOutgoing ? "ml-auto items-end" : "mr-auto items-start"
            )}
          >
            <Skeleton
              className={cn(
                "h-12 rounded-xl",
                isOutgoing ? "w-52 bg-primary/20" : "w-60 bg-secondary/60"
              )}
            />
            <Skeleton className="h-2 w-12 rounded" />
          </div>
        );
      })}
    </div>
  );
};

export const PageSkeleton: React.FC = () => {
  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-7xl mx-auto w-full">
      <div className="space-y-2">
        <Skeleton className="h-7 w-64 rounded-md" />
        <Skeleton className="h-4 w-96 rounded-md" />
      </div>
      <StatGridSkeleton count={4} />
      <div className="p-4 rounded-lg border border-border bg-card space-y-3">
        <div className="flex justify-between items-center pb-2 border-b border-border">
          <Skeleton className="h-4 w-40 rounded" />
          <Skeleton className="h-7 w-24 rounded" />
        </div>
        <TableSkeleton rows={6} columns={4} />
      </div>
    </div>
  );
};

export const MediaGallerySkeleton: React.FC<{ count?: number }> = ({ count = 12 }) => {
  return (
    <div className="flex-1 min-h-0 overflow-y-auto p-1 pr-1.5">
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 min-[1900px]:grid-cols-6 gap-2 sm:gap-2.5">
        {Array.from({ length: count }).map((_, i) => (
          <div
            key={`skel-media-${i}`}
            className="w-full aspect-[16/10] min-h-[96px] sm:min-h-[105px] rounded-md border border-border bg-card p-2.5 flex flex-col justify-between shadow-sm"
          >
            <div className="flex items-center justify-between">
              <Skeleton className="w-4 h-4 rounded" />
              <Skeleton className="w-12 h-3 rounded" />
            </div>
            <div className="space-y-1.5">
              <Skeleton className="w-4/5 h-3 rounded" />
              <Skeleton className="w-1/2 h-2.5 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const ChannelCardsSkeleton: React.FC = () => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
      {[0, 1].map((idx) => (
        <div
          key={`skel-channel-${idx}`}
          className="bg-card rounded-md border border-border p-3.5 shadow-sm space-y-3"
        >
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-2">
              <Skeleton className="w-2 h-2 rounded-full" />
              <Skeleton className="w-32 h-3.5 rounded" />
            </div>
            <Skeleton className="w-16 h-2.5 rounded" />
          </div>
          <Skeleton className="w-28 h-2.5 rounded" />
          <Skeleton className="w-full h-8 rounded-md" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="w-20 h-4 rounded-full" />
            <Skeleton className="w-24 h-4 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  );
};
