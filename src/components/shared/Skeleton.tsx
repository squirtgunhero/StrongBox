"use client";

import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800",
        className
      )}
    />
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="rounded-lg border bg-white p-5 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex items-center justify-between mb-4">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-8 w-24" />
      </div>
      <div className="space-y-3">
        {/* Header */}
        <div className="flex gap-4 pb-2 border-b dark:border-zinc-800">
          {Array.from({ length: cols }).map((_, i) => (
            <Skeleton key={i} className="h-3 flex-1" />
          ))}
        </div>
        {/* Rows */}
        {Array.from({ length: rows }).map((_, r) => (
          <div key={r} className="flex gap-4 py-2">
            {Array.from({ length: cols }).map((_, c) => (
              <Skeleton key={c} className="h-4 flex-1" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

export function KPICardSkeleton() {
  return (
    <div className="rounded-lg border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="h-7 w-24 mt-2" />
      <Skeleton className="h-3 w-16 mt-1.5" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-9 w-28 rounded-md" />
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4 mb-6">
        {Array.from({ length: 4 }).map((_, i) => (
          <KPICardSkeleton key={i} />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3 mb-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-white p-5 dark:bg-zinc-900 dark:border-zinc-800">
            <Skeleton className="h-5 w-36 mb-4" />
            <Skeleton className="h-40 w-full" />
          </div>
        ))}
      </div>
      <TableSkeleton rows={5} cols={5} />
    </div>
  );
}

export function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Skeleton className="h-5 w-5" />
          <Skeleton className="h-7 w-48" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-24 rounded-md" />
          <Skeleton className="h-9 w-24 rounded-md" />
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-lg border bg-white p-4 dark:bg-zinc-900 dark:border-zinc-800">
            <Skeleton className="h-3 w-20 mb-2" />
            <Skeleton className="h-5 w-32" />
          </div>
        ))}
      </div>
    </div>
  );
}
