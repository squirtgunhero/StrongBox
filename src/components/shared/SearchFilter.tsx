"use client";

export function SearchFilter() {
  return (
    <div className="flex items-center gap-3 mb-4">
      <input
        type="text"
        placeholder="Search..."
        className="h-9 w-64 rounded-md px-3 text-sm text-white outline-none placeholder:text-zinc-500 focus:ring-1 focus:ring-[#3B82F6]"
        style={{ background: "var(--surface-secondary)", border: "1px solid var(--border)" }}
      />
    </div>
  );
}
