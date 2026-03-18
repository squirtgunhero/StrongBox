"use client";

export function SearchFilter() {
  // TODO: Search and filter bar
  return (
    <div className="flex items-center gap-3 mb-4">
      <input
        type="text"
        placeholder="Search..."
        className="h-9 w-64 rounded-md border bg-white px-3 text-sm outline-none focus:border-brand-500 focus:ring-1 focus:ring-brand-500 dark:bg-zinc-800 dark:border-zinc-700"
      />
    </div>
  );
}
