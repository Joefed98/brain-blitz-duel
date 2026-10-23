import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { MuteToggle } from "@/components/duel/MuteToggle";

/** The direction-controls choice GridDrag keeps on the device (arrows or joystick). */
const ARROW_KEY = "duelz-arrow-control";

function readArrows(): "arrows" | "joystick" {
  try {
    return window.localStorage.getItem(ARROW_KEY) === "joystick" ? "joystick" : "arrows";
  } catch {
    return "arrows";
  }
}

/**
 * Profile's settings (the gear): the existing device settings in one sheet, nothing new. Sound is
 * the same MuteToggle as every screen's header (effects and music, each with its switch and
 * volume); direction controls are the arrows/joystick choice the grid games offer in play
 * (GridDrag's own key); "How it works" reopens the first-time intro.
 */
export function SettingsSheet({
  onClose,
  onHowItWorks,
  onTerms,
}: {
  onClose: () => void;
  onHowItWorks: () => void;
  /** Opens the beta terms (/terms). */
  onTerms?: () => void;
}) {
  const [arrows, setArrows] = useState<"arrows" | "joystick">("arrows");
  useEffect(() => setArrows(readArrows()), []);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [onClose]);
  const choose = (value: "arrows" | "joystick") => {
    setArrows(value);
    try {
      window.localStorage.setItem(ARROW_KEY, value);
    } catch {
      /* storage is a nicety */
    }
  };
  return createPortal(
    <div
      data-skin="profile"
      className="th-scrim fixed inset-0 z-40 flex items-end justify-center bg-black/60"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Settings"
        data-settings-sheet
        onClick={(e) => e.stopPropagation()}
        className="th-sheet flex w-full max-w-[430px] flex-col gap-4 rounded-t-3xl border border-b-0 border-border bg-card px-5 pt-4"
        style={{ paddingBottom: "max(24px, calc(env(safe-area-inset-bottom, 0px) + 16px))" }}
      >
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="press tap-target -mr-2 flex w-11 items-center justify-center text-muted-foreground"
          >
            <X aria-hidden="true" className="h-5 w-5" />
          </button>
        </div>
        <div className="th-card flex items-center justify-between gap-3 rounded-xl border border-border bg-background/60 px-4 py-2">
          <span className="flex flex-col">
            <span className="font-display text-sm font-semibold text-foreground">Sound</span>
            <span className="text-xs text-muted-foreground">Effects and music</span>
          </span>
          <MuteToggle />
        </div>
        <div className="th-card flex flex-col gap-2 rounded-xl border border-border bg-background/60 px-4 py-3">
          <span className="flex flex-col">
            <span className="font-display text-sm font-semibold text-foreground">
              Direction controls
            </span>
            <span className="text-xs text-muted-foreground">For games played with arrows</span>
          </span>
          <div role="radiogroup" aria-label="Direction controls" className="grid grid-cols-2 gap-2">
            {(["arrows", "joystick"] as const).map((value) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={arrows === value}
                onClick={() => choose(value)}
                className={`th-chip press tap-target rounded-lg border font-display text-sm font-bold uppercase tracking-wide ${
                  arrows === value
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border text-muted-foreground"
                }`}
              >
                {value === "arrows" ? "Arrows" : "Joystick"}
              </button>
            ))}
          </div>
        </div>
        <button
          type="button"
          onClick={onHowItWorks}
          className="th-btn-ghost press tap-target w-full rounded-xl border border-border font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground"
        >
          How it works
        </button>
        {onTerms ? (
          <button
            type="button"
            data-open-terms
            onClick={onTerms}
            className="th-btn-ghost press tap-target w-full rounded-xl border border-border font-display text-sm font-semibold uppercase tracking-widest text-muted-foreground"
          >
            Beta terms
          </button>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
