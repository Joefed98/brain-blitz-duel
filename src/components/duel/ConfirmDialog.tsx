import type { ReactNode } from "react";
import { Button } from "@/design/components";

/** One confirm sheet for room actions that can't be undone (leave, disband, finish). Neutral: none of them plays (the gold rule). */
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
      className="jz-scrim fixed inset-0 z-[70] flex items-center justify-center bg-background/90 p-6" /* design-lint-ignore: its stacking order over the room */
    >
      <div className="jz-dialog w-full max-w-sm space-y-4 rounded-2xl border border-border bg-card p-5 text-center">
        <p className="whitespace-nowrap text-lg font-extrabold">
          {title}
        </p>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div className="flex gap-3">
          <Button variant="quiet" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button variant="secondary" onClick={onConfirm} className="flex-1">
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
