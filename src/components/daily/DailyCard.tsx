import { CalendarDays, ChevronRight } from "lucide-react";
import { useEffect, useState } from "react";

import { dailyStatus } from "@/lib/duel/asyncApi";
import {
  DAILY_KINDS,
  DAILY_TITLE,
  rankLine,
  type DailyKind,
  type DailyState,
  type DailyStatus,
} from "@/lib/duel/daily";
import { ordinal } from "@/lib/duel/ordinal";

/** The card's line for one daily: Play, Continue, or your score and place. */
function cardState(state: DailyState): { action: string; detail: string | null } {
  if (state.state === "play") return { action: "Play", detail: null };
  if (state.state === "continue") return { action: "Continue", detail: null };
  return { action: `${state.total}`, detail: rankLine(state.rank, state.count, ordinal) };
}

/** Today's dailies for this device, fetched after mount; null while loading or when unavailable. */
export function useDailyStatus(): DailyStatus | null {
  const [status, setStatus] = useState<DailyStatus | null>(null);
  useEffect(() => {
    let live = true;
    void dailyStatus().then(
      (next) => live && setStatus(next),
      () => live && setStatus(null),
    );
    return () => {
      live = false;
    };
  }, []);
  return status;
}

/**
 * The Play tab's "Daily challenge" card (21 Oct 2026): today's Daily Puzzle and Daily Arcade, each
 * with Play, Continue, or the device's score and place. Hidden until the status call says the
 * dailies are available (before the async-room migration is applied it never shows).
 */
export function DailyCard({
  status,
  onOpen,
}: {
  status: DailyStatus | null;
  onOpen: (kind: DailyKind) => void;
}) {
  if (!status?.available) return null;
  return (
    <section
      aria-label="Daily challenge"
      data-daily-card
      data-tint="gold"
      className="th-card flex flex-col gap-2 rounded-2xl border border-border bg-card/80 p-4"
    >
      <div className="flex items-center justify-between gap-2">
        <p className="th-kicker flex items-center gap-1.5 text-primary">
          <CalendarDays aria-hidden="true" className="h-4 w-4" /> Daily challenge
        </p>
        <span className="whitespace-nowrap font-mono text-[11px] uppercase tracking-[0.1em] text-muted-foreground">
          New at midnight UK
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {DAILY_KINDS.map((kind) => {
          const { action, detail } = cardState(status[kind]);
          const done = status[kind].state === "done";
          return (
            <button
              key={kind}
              type="button"
              data-daily-open={kind}
              data-daily-state={status[kind].state}
              onClick={() => onOpen(kind)}
              className="th-card press flex min-h-[64px] min-w-0 items-center justify-between gap-1 rounded-xl border border-primary/40 bg-primary/5 px-3 py-2 text-left"
            >
              <span className="flex min-w-0 flex-col">
                <span className="truncate font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
                  {DAILY_TITLE[kind]}
                </span>
                <span
                  className={`truncate ${done ? "th-score font-mono text-xl font-bold tabular-nums text-foreground" : "font-display text-base font-extrabold uppercase tracking-wide text-primary"}`}
                >
                  {action}
                  {detail ? (
                    <span className="ml-1.5 font-display text-xs font-bold uppercase text-primary">
                      {detail}
                    </span>
                  ) : null}
                </span>
              </span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </section>
  );
}
