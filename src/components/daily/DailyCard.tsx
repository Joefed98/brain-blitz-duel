import { ChevronRight, Gamepad2, Puzzle } from "lucide-react";
import { useEffect, useState } from "react";

import { dailyStatus } from "@/lib/duel/asyncApi";
import {
  DAILY_KINDS,
  DAILY_ROUNDS,
  DAILY_TITLE,
  rankLine,
  ukDayKey,
  ukDayWindow,
  type DailyKind,
  type DailyState,
  type DailyStatus,
} from "@/lib/duel/daily";
import { ordinal } from "@/lib/duel/ordinal";
import { readPlayCards, writePlayCards } from "@/lib/playCards";

/** A daily's row: its size, then (once played) the device's score and place, and its button. */
function rowState(kind: DailyKind, state: DailyState): { sub: string; action: string | null } {
  const size = kind === "puzzle" ? `${DAILY_ROUNDS[kind]} rounds` : `${DAILY_ROUNDS[kind]} games`;
  if (state.state === "play") return { sub: size, action: "Play" };
  if (state.state === "continue") return { sub: `${size} · started`, action: "Continue" };
  return { sub: `You scored ${state.total} · ${rankLine(state.rank, state.count, ordinal)}`, action: null };
}

const DAILY_ICON = { puzzle: Puzzle, arcade: Gamepad2 } as const;

/**
 * Today's dailies for this device, fetched after mount: `status` once the server answers (null on a
 * failure), `settled` from then on. The answer is remembered (playCards.ts) so the next visit's card
 * draws it from the first frame.
 */
export function useDailyStatus(): { status: DailyStatus | null; settled: boolean } {
  const [state, setState] = useState<{ status: DailyStatus | null; settled: boolean }>({ status: null, settled: false });
  useEffect(() => {
    let live = true;
    void dailyStatus().then(
      (next) => {
        writePlayCards({ daily: next });
        if (live) setState({ status: next, settled: true });
      },
      // Unreachable: keep drawing the last known card (it still opens /daily).
      () => undefined,
    );
    return () => {
      live = false;
    };
  }, []);
  return state;
}

/**
 * What the card draws: the server's answer once it's in (or, if it said the dailies aren't available,
 * the card as it was, while it collapses), else the last known status when it's today's, else Play.
 */
export function shownDailyStatus(
  state: { status: DailyStatus | null },
  nowMs: number = Date.now(),
  remembered = true,
): DailyStatus {
  if (state.status?.available) return state.status;
  const cached = remembered ? readPlayCards().daily : undefined;
  const day = ukDayKey(nowMs);
  if (cached?.available && cached.day === day) return cached;
  return { available: true, day, closesAt: ukDayWindow(day).closesAt, puzzle: { state: "play" }, arcade: { state: "play" } };
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
    <section aria-label="Daily challenge" data-daily-card className="ap-section">
      <div className="ap-section-head">
        <h2 className="ap-section-title">Today</h2>
        <span className="ap-meta">New at midnight</span>
      </div>
      <div className="ap-panel">
        {DAILY_KINDS.map((kind) => {
          const { sub, action } = rowState(kind, status[kind]);
          const Icon = DAILY_ICON[kind];
          return (
            <button
              key={kind}
              type="button"
              data-daily-open={kind}
              data-daily-state={status[kind].state}
              onClick={() => onOpen(kind)}
              data-icon="sq"
              className="ap-row press"
            >
              <span className="ap-icon-sq">
                <Icon aria-hidden="true" />
              </span>
              <span className="ap-row-text">
                <span className="ap-row-title">{DAILY_TITLE[kind]}</span>
                <span data-ellipsis className="ap-row-sub">
                  {sub}
                </span>
              </span>
              {action ? (
                <span className="ap-pill-gold">
                  {action}
                </span>
              ) : (
                <ChevronRight aria-hidden="true" className="ap-chevron" />
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
