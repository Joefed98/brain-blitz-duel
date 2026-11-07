import { useState } from "react";

import { ConfirmDialog } from "./ConfirmDialog";
import { RoomMenu } from "./RoomFooter";

/**
 * Shown when everyone else has left or dropped out of a game in progress.
 * The game keeps running on its timers (absent players score 0 a round), and
 * the player still here can end it now as a win.
 */
export function DropoutBanner({
  absentNames,
  myTotal,
  absentTotal,
  onFinish,
}: {
  absentNames: string[];
  myTotal: number;
  /** Shown for a two-player game only. */
  absentTotal: number | null;
  onFinish: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const who =
    absentNames.length === 1
      ? absentNames[0]!
      : absentNames.length === 0
        ? "Everyone else"
        : "The other players";
  const finish = async () => {
    setConfirming(false);
    setBusy(true);
    setError(null);
    try {
      await onFinish();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn’t finish yet. Try again.");
      setBusy(false);
    }
  };
  return (
    <div
      role="status"
      data-dropout-banner
      className="mb-2 flex shrink-0 items-center gap-3 rounded-md border border-timer-orange/60 bg-timer-orange/10 px-3 py-2 text-left"
    >
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-semibold text-foreground">
          {who} left the game
        </p>
        <p className="text-xs text-foreground/80">
          You {myTotal}
          {absentTotal !== null ? `, ${who} ${absentTotal}` : ""}. Rounds carry on; they score 0.
        </p>
        {error && <p className="text-xs text-warn">{error}</p>}
      </div>
      <button
        type="button"
        disabled={busy}
        onClick={() => setConfirming(true)}
        className="press tap-target shrink-0 rounded-xl bg-primary px-3 text-sm font-bold text-primary-foreground disabled:opacity-50"
      >
        Finish now
      </button>
      {confirming && (
        <ConfirmDialog
          title="Finish the game now?"
          body="The game ends here and you win. Scores so far are kept."
          confirmLabel="Finish"
          onCancel={() => setConfirming(false)}
          onConfirm={() => void finish()}
        />
      )}
    </div>
  );
}

/** A guest's way out (the "⋯" menu's Leave) of a game in progress, with a confirm. */
export function LeaveGameButton({ onLeave }: { onLeave: () => Promise<void> }) {
  const [confirming, setConfirming] = useState(false);
  return (
    <>
      {/* In the header's "⋯" menu (Polish batch R). */}
      <RoomMenu items={[{ label: "Leave", onSelect: () => setConfirming(true), danger: true }]} />
      {confirming && (
        <ConfirmDialog
          title="Leave this game?"
          body="You can’t rejoin this game, and you’ll drop off its scoreboard."
          confirmLabel="Leave"
          onCancel={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            void onLeave();
          }}
        />
      )}
    </>
  );
}
