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
      data-skin="room"
      className="th-scrim fixed inset-0 z-[70] flex items-center justify-center bg-background/90 p-6"
    >
      <div className="th-sheet w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 text-center">
        <p className="whitespace-nowrap font-display text-lg font-bold uppercase tracking-[0.03em]">
          {title}
        </p>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="th-btn-ghost press tap-target flex-1 rounded-xl border border-border font-display text-sm font-bold uppercase tracking-wide"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="th-btn-gold press tap-target flex-1 rounded-xl bg-primary font-display text-sm font-extrabold uppercase tracking-wide text-primary-foreground"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
