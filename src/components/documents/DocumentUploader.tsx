"use client";

export function DocumentUploader() {
  // TODO: Drag-and-drop multi-file upload to Supabase Storage
  return (
    <div className="rounded-lg border-2 border-dashed border-white/[0.12] p-8 text-center">
      <p className="text-sm text-zinc-500">
        Drag and drop files here, or click to browse
      </p>
    </div>
  );
}
