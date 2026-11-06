import { Check } from "lucide-react";
import { useEffect, useState } from "react";

import { DailyArcadeTile, DailyPuzzleTile } from "@/components/app/TabIcons";

import { dailyStatus } from "@/lib/duel/asyncApi";
import {
  DAILY_KINDS,
  DAILY_ROUNDS,
  DAILY_TITLE,
  ukDayKey,
  ukDayWindow,
  type DailyKind,
  type DailyState,
  type DailyStatus,
} from "@/lib/duel/daily";
import { readPlayCards, writePlayCards } from "@/lib/playCards";

/**
 * A daily's row (tab pages refresh, 26 Oct 2026): its size and, once played today, "Done" (with this
 * device's streak from 2 days) and the score beside a teal tick in place of the pill; else the gold
 * Play or Continue pill (tap to play).
 */
function rowState(kind: DailyKind, state: DailyState, streak: number): { sub: string; action: string; done: number | null } {
  const size = kind === "puzzle" ? `${DAILY_ROUNDS[kind]} rounds` : `${DAILY_ROUNDS[kind]} games`;
  if (state.state === "play") return { sub: size, action: "Play", done: null };
  if (state.state === "continue") return { sub: `${size} · started`, action: "Continue", done: null };
  return { sub: streak >= 2 ? `Done · ${streak}-day streak` : "Done", action: "Done", done: state.total };
}

const DAILY_ICON = { puzzle: DailyPuzzleTile, arcade: DailyArcadeTile } as const;

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
 * with Play, Continue, or Done and the device's score (Challenge a friend joins its panel, app-pages.css). Hidden until the status call says the
 * dailies are available (before the async-room migration is applied it never shows).
 */
export function DailyCard({
  status,
  streak = 0,
  onOpen,
}: {
  status: DailyStatus | null;
  /** This device's daily streak (dailyRecord.ts), read once the page is up. */
  streak?: number;
  onOpen: (kind: DailyKind) => void;
}) {
  if (!status?.available) return null;
  return (
    <section aria-label="Daily challenge" data-daily-card className="ap-section">
      <div className="ap-section-head">
        <h2 className="ap-section-title">Today</h2>
        <span className="ap-meta">New at midnight</span>
      </div>
      <div className="jz-panel">
        {DAILY_KINDS.map((kind) => {
          const { sub, action, done } = rowState(kind, status[kind], streak);
          const Icon = DAILY_ICON[kind];
          return (
            <button
              key={kind}
              type="button"
              data-daily-open={kind}
              data-daily-state={status[kind].state}
              onClick={() => onOpen(kind)}
              data-icon="tile"
              className="jz-row press"
            >
              <Icon />
              <span className="jz-row-text">
                <span className="jz-row-title">{DAILY_TITLE[kind]}</span>
                <span data-ellipsis className="jz-row-sub">
                  {sub}
                </span>
              </span>
              {done !== null ? (
                <span data-daily-done className="ap-done-score">
                  <Check aria-hidden="true" strokeWidth={2.6} />
                  {done}
                </span>
              ) : (
                <span className="ap-pill-gold">{action}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
