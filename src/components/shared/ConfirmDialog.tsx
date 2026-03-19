"use client";

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "default" | "destructive";
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  onConfirm,
  onCancel,
  variant = "default",
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="fixed inset-0 bg-black/70" onClick={onCancel} />
      <div className="relative z-50 w-full max-w-md rounded-xl p-6 shadow-2xl" style={{ background: "var(--surface)", border: "1px solid var(--border-strong)" }}>
        <h2 className="text-lg font-semibold text-zinc-900">{title}</h2>
        <p className="mt-2 text-sm text-zinc-600">
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="rounded-md px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-[#f3f3f3] transition-colors"
            style={{ border: "1px solid var(--border)" }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className={`rounded-md px-4 py-2 text-sm font-medium text-white ${
              variant === "destructive"
                ? "bg-red-600 hover:bg-red-700"
                : "bg-[#C33732] hover:bg-[#A52F2B]"
            }`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
