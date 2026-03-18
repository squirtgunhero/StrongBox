"use client";

export function DocumentUploader() {
  // TODO: Drag-and-drop multi-file upload to Supabase Storage
  return (
    <div className="rounded-lg border-2 border-dashed border-zinc-300 p-8 text-center dark:border-zinc-700">
      <p className="text-sm text-zinc-500">
        Drag and drop files here, or click to browse
      </p>
    </div>
  );
}
