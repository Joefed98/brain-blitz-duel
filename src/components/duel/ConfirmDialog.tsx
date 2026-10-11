import type { ReactNode } from "react";

/** One confirm sheet for room actions that can't be undone (leave, disband, finish). */
export function ConfirmDialog({
  title,
  body,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  title: string;
  body: ReactNode;
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <div
      role="alertdialog"
      aria-label={title}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-background/90 p-6"
    >
      <div className="w-full max-w-sm space-y-4 rounded-md border border-border bg-card p-5 text-center">
        <p className="font-display text-lg">{title}</p>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="press tap-target flex-1 rounded-md border border-border"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="press tap-target flex-1 rounded-md bg-primary text-primary-foreground"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
