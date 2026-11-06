import { X } from "lucide-react";
import { useEffect, useState } from "react";

import { APP_NAME } from "@/lib/brand";
import type { PublicGame } from "@/lib/publicSchedule";
import { nextPublicLabel } from "@/lib/share/welcome";
import {
  noteShareWelcome,
  sendShareEvent,
  shareWelcomeDue,
  type ShareRecorder,
  type WelcomeOutcome,
} from "@/lib/share/shareRef";

/**
 * The Play tab's one-time welcome for a device that arrived from a shared link and landed on the
 * home (shareRef.ts shareWelcomeDue; a room-lobby landing gets none, the lobby is the welcome).
 * Shown on that visit only, until closed: the ✕, TRY A PRACTICE GAME (Warm up's first game) or,
 * when a public game is scheduled, NEXT PUBLIC GAME (the Tournaments tab). Each is counted once
 * with the arrival (arrival_welcome). Presentation and device storage only.
 */
export function ShareWelcomeCard({
  nextGame,
  now,
  onPractice,
  onPublic,
  record = sendShareEvent,
  assumeDue = false,
  onDue,
}: {
  nextGame: PublicGame | null;
  now: number;
  onPractice: () => void;
  onPublic: () => void;
  record?: ShareRecorder;
  /**
   * The Play tab reserved the card before the first paint (playCards.ts): draw it from the first frame
   * (the decision below then confirms it, or the Play tab's slot collapses it).
   */
  assumeDue?: boolean;
  /** Told the decision once device storage has been read. */
  onDue?: (due: boolean) => void;
}) {
  // Device storage is read after mount, so the server-rendered page and the first client render agree.
  const [due, setDue] = useState(assumeDue);
  useEffect(() => {
    const now = shareWelcomeDue(window.location, record);
    onDue?.(now);
    if (!now) return;
    setDue(true);
    noteShareWelcome("shown", record);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  if (!due) return null;

  const close = (outcome: WelcomeOutcome, then?: () => void) => {
    noteShareWelcome(outcome, record);
    setDue(false);
    then?.();
  };

  return (
    <section
      data-share-welcome
      data-tint="gold"
      aria-label="Welcome"
      className="th-card relative flex flex-col gap-3 rounded-2xl border border-border bg-card/80 p-4"
    >
      <button
        type="button"
        data-share-welcome-dismiss
        aria-label="Dismiss"
        onClick={() => close("dismissed")}
        className="press absolute right-1 top-1 flex h-11 w-11 items-center justify-center rounded-full text-muted-foreground"
      >
        <X aria-hidden="true" className="h-5 w-5" />
      </button>
      <div className="pr-9">
        <h2 className="whitespace-nowrap font-display text-lg font-extrabold uppercase leading-tight tracking-[0.02em] text-primary">
          Your friend played {APP_NAME}
        </h2>
        {/* Two set lines, each kept whole (the sentence on one line doesn't fit a 375 px phone): plain text with a line
            break, 14 px (DESIGN.md's meta size). Block spans gave each line a second, taller box in Archivo, which
            share-check's line count read as an extra line (6 Nov 2026). */}
        <p data-share-welcome-line className="mt-1 whitespace-nowrap text-sm text-muted-foreground">
          Quick multiplayer puzzle and arcade games.{" "}
          <br />
          No sign-up.
        </p>
      </div>
      <div className="flex flex-col gap-2">
        <button
          type="button"
          data-share-welcome-practice
          onClick={() => close("practice", onPractice)}
          className="th-btn-gold press tap-target flex w-full items-center justify-center whitespace-nowrap rounded-xl bg-primary px-3 font-display text-base font-extrabold uppercase tracking-wide text-primary-foreground"
        >
          Try a practice game
        </button>
        {nextGame ? (
          <button
            type="button"
            data-share-welcome-public
            onClick={() => close("public", onPublic)}
            className="th-btn-teal press tap-target flex w-full items-center justify-center whitespace-nowrap rounded-xl px-3 font-display text-[13px] font-extrabold uppercase"
          >
            {nextPublicLabel(nextGame, now)}
          </button>
        ) : null}
      </div>
    </section>
  );
}
