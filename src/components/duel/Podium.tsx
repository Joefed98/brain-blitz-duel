import { useEffect, useRef, useState, type ReactNode } from "react";

import { ordinal } from "@/lib/duel/ordinal";
import { puzzleName } from "@/lib/duel/registry";
import type { Standing } from "@/lib/duel/scoring";
import type { PlayerLooks } from "@/lib/duel/playerLook";
import type { PodiumAward } from "@/lib/duel/podiumAwards";
import type { RoundResultRow, StoredPuzzleType } from "@/lib/duel/types";
import { playerBreakdown } from "@/lib/duel/scoring";
import { buzz } from "@/lib/motion";
import { playVoice } from "@/lib/sound";
import { fx } from "@/lib/fx";
import {
  COUNT_UP_SLIDE_MS,
  celebrationSound,
  countUpFrom,
  podiumHero,
  podiumWinnerIsMe,
  showBanner,
  sparkBurst,
} from "@/lib/fx/celebrations";
import { previousStandingOrder } from "@/lib/duel/resultPresentation";
import { useCelebrationScope, useCelebrationsOn, useCountUpClimbs, useTapToSkip } from "@/components/fx/useCelebration";
import { useFlipRows } from "@/components/fx/useFlipRows";

import { CHAT_BAR_HEIGHT } from "@/lib/duel/chatConstants";

import { FeedbackLink } from "@/components/beta/FeedbackLink";

import { AnimatedScore } from "./AnimatedScore";
import { ConfettiBurst } from "./ArcadeCelebration";
import { Dots } from "./Dots";
import { Medal } from "./Medal";
import { PlayerBadge } from "./PlayerBadge";
import { PodiumAwards } from "./PodiumAwards";

/** Gold, silver-grey and bronze-amber blocks (podium tokens in styles.css). */
const PLINTH = [
  { height: "h-20", tone: "border-podium-gold bg-podium-gold/25 text-podium-gold" },
  { height: "h-14", tone: "border-podium-silver/80 bg-podium-silver/15 text-podium-silver" },
  { height: "h-10", tone: "border-podium-bronze/80 bg-podium-bronze/20 text-podium-bronze" },
];

/** Every total on the podium counts up from 0 over this long (celebrations: from the round before). */
const COUNT_UP_MS = 1200;
/** Celebrations: the hero steps up once the gold block has popped in. */
const PODIUM_HERO_DELAY_MS = 450;

function Plinth({
  standing,
  place,
  looks,
  celebrate,
  skip,
}: {
  standing: Standing | undefined;
  place: number;
  looks: PlayerLooks;
  celebrate: boolean;
  skip: boolean;
}) {
  if (!standing) return <div className="flex-1" />;
  const style = PLINTH[place - 1];
  if (!style) return null;
  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center justify-end gap-1" data-podium-place={place}>
      {place === 1 && (
        // The winner moment: one confetti burst over the gold block (outside
        // the block's pop-in scale, so the canvas measures its full size).
        <div className="pointer-events-none absolute -inset-x-4 -top-16 bottom-0 z-10" aria-hidden="true">
          <ConfettiBurst world="gem" />
        </div>
      )}
      <PlayerBadge look={looks.get(standing.slot)} name={standing.name} size={26} />
      <span className="th-name max-w-full truncate text-xs text-foreground">
        {standing.name}
      </span>
      <AnimatedScore
        value={standing.total}
        from={celebrate ? countUpFrom(standing) : 0}
        durationMs={COUNT_UP_MS}
        quiet
        skip={skip}
        className={`th-score font-mono text-xl font-bold tabular-nums ${place === 1 ? "th-score-top text-primary" : "text-foreground"}`}
      />
      <div
        data-podium-step={celebrate ? place : undefined}
        className={`flex w-full animate-pop-in items-start justify-center rounded-t-xl border pt-2 font-mono text-sm font-bold ${style.height} ${style.tone}`}
      >
        {place}
      </div>
    </div>
  );
}

interface PodiumProps {
  rows: Standing[];
  /** Everyone's colour and icon. */
  looks?: PlayerLooks;
  /** The final screen's awards (podiumAwards.ts). */
  awards?: PodiumAward[];
  mySlot: number;
  results: RoundResultRow[];
  roundOrder: StoredPuzzleType[];
  isHost: boolean;
  busy: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
  /** Replays: the play of the game panel (display only; never blocks Play again or Leave). */
  playOfTheGame?: ReactNode;
  /** The Share button (RoomShareButton), beside Play again. */
  share?: ReactNode;
  /** Rooms: "Challenge a friend" (RoomChallengeButton), its own row under Play again and Share. */
  challenge?: ReactNode;
  /**
   * A friend challenge's final screen (22 Oct 2026): its own buttons in place of the room's
   * (Play again, Share, Leave), pinned to the screen's bottom (no chat bar under it).
   */
  actions?: ReactNode;
}

/** The final screen for a room of three or more players. */
export function Podium({
  rows,
  looks = new Map(),
  awards = [],
  mySlot,
  results,
  roundOrder,
  isHost,
  busy,
  onPlayAgain,
  onLeave,
  playOfTheGame,
  share,
  challenge,
  actions,
}: PodiumProps) {
  const [open, setOpen] = useState<number | null>(null);
  const mine = rows.find((r) => r.slot === mySlot);
  const won = mine?.position === 1;
  const sharedFirst = won && rows.filter((r) => r.position === 1).length > 1;
  const cued = useRef(false);
  // Celebrations (src/lib/fx/celebrations.ts): the hero beside the winner's step with a burst (and,
  // for the winner's own phone, "You win!" and the zap); totals count up from the round before and
  // the list slides from the previous order, a tap skipping to the final state.
  const celebrate = useCelebrationsOn();
  const scope = useCelebrationScope();
  const skipped = useTapToSkip(celebrate);
  const root = useRef<HTMLDivElement>(null);
  const { displayRows, rowRef, nodes } = useFlipRows(rows, {
    from: celebrate ? previousStandingOrder(rows) : rows,
    slideMs: COUNT_UP_SLIDE_MS,
    skip: skipped,
  });
  const listRows = celebrate ? displayRows : rows;
  useCountUpClimbs(celebrate, scope, rows, nodes);
  useEffect(() => {
    if (!celebrate) return;
    const iWon = podiumWinnerIsMe(rows, mySlot);
    const timer = window.setTimeout(() => {
      const step = root.current?.querySelector('[data-podium-step="1"]');
      if (step) {
        podiumHero(scope, step);
        const box = step.getBoundingClientRect();
        sparkBurst(scope, box.right - 17, box.bottom - 30, { count: 44 });
        celebrationSound("chime");
      }
      if (iWon) {
        showBanner(scope, "You win!");
        celebrationSound("zap");
      }
    }, PODIUM_HERO_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [celebrate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cued.current) return;
    cued.current = true;
    fx.onPodium();
    // The winner hears "you win" (a shared first place "tie"); everyone else "GG".
    playVoice(sharedFirst ? "voice.tie" : won ? "voice.youWin" : "gg");
    if (won) buzz([25, 50, 25]);
  }, [won, sharedFirst]);

  return (
    <div ref={root} className="relative flex flex-1 flex-col gap-4 pt-2 animate-phase-in">
      {won ? (
        <h1 className="text-center font-display text-4xl font-bold text-podium-gold animate-word-scale-in">
          1st
        </h1>
      ) : (
        <h1 className="whitespace-nowrap text-center font-display text-[22px] font-bold text-foreground animate-word-scale-in">
          You finished {ordinal(mine?.position ?? rows.length)} of {rows.length}
        </h1>
      )}

      <div className="flex items-end gap-2">
        <Plinth standing={rows.find((r) => r.position === 2)} place={2} looks={looks} celebrate={celebrate} skip={skipped} />
        <Plinth standing={rows.find((r) => r.position === 1)} place={1} looks={looks} celebrate={celebrate} skip={skipped} />
        <Plinth standing={rows.find((r) => r.position === 3)} place={3} looks={looks} celebrate={celebrate} skip={skipped} />
      </div>

      <PodiumAwards awards={awards} looks={looks} names={new Map(rows.map((r) => [r.slot, r.name]))} mySlot={mySlot} />

      {playOfTheGame}

      <p className="-mb-2 whitespace-nowrap text-center text-[11px] text-muted-foreground">Tap a player for their round scores</p>
      <ul className="flex flex-col gap-1">
        {listRows.map((row) => (
          <li key={row.slot} ref={celebrate ? rowRef(row.slot) : undefined} data-tint={row.slot === mySlot ? "me" : undefined} className="th-card overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              aria-expanded={open === row.slot}
              aria-label={`${row.name}: ${row.total} points. Show round scores`}
              onClick={() => setOpen((current) => (current === row.slot ? null : row.slot))}
              className={`flex min-h-11 w-full items-center gap-3 px-3 py-2 text-left ${
                row.slot === mySlot ? "bg-primary/10" : ""
              } ${row.status === "inactive" ? "opacity-40" : ""}`}
            >
              <Medal place={row.position} />
              <PlayerBadge look={looks.get(row.slot)} name={row.name} size={24} />
              <span className="th-name min-w-0 flex-1 truncate text-sm">{row.name}</span>
              <AnimatedScore
                value={row.total}
                from={celebrate ? countUpFrom(row) : 0}
                durationMs={COUNT_UP_MS}
                quiet
                skip={skipped}
                className={`th-score font-mono text-xl font-bold tabular-nums ${row.position === 1 ? "th-score-top text-primary" : ""}`}
              />
              <span aria-hidden="true" className="w-3 text-center font-mono text-xs text-muted-foreground">
                {open === row.slot ? "▴" : "▾"}
              </span>
            </button>
            {open === row.slot && (
              <div className="border-t border-border px-3 py-2">
                {playerBreakdown(results, row.slot, roundOrder.length || undefined).map((entry) => (
                  <div
                    key={entry.round}
                    className="flex items-center justify-between py-1 text-[11px]"
                  >
                    <span className="th-kicker truncate text-[11px] tracking-[0.08em] text-muted-foreground">
                      {puzzleName(roundOrder[entry.round - 1] ?? "wordsmith")}
                    </span>
                    <span className="font-mono tabular-nums">{entry.score}</span>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      {/* SEND FEEDBACK (the beta's form; nothing while TALLY_URL is empty). */}
      <FeedbackLink small />

      {/* Pinned flush on the chat bar, solid, so Play again and Leave never need a scroll and no row shows through. */}
      <div
        data-podium-actions
        className="room-sticky-footer sticky z-30 mt-auto flex flex-col gap-2 bg-background pb-2 pt-2"
        style={{ bottom: actions ? "0px" : `calc(${CHAT_BAR_HEIGHT}px + env(safe-area-inset-bottom, 0px))` }}
      >
        {actions ?? (
        <>
        {!isHost && (
          <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Waiting for host…
          </p>
        )}
        {(isHost || share) && (
          <div className="flex gap-2">
            {isHost && (
              <button
                type="button"
                onClick={onPlayAgain}
                disabled={busy}
                className="th-btn-gold press tap-target flex min-w-0 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-primary font-display text-base font-extrabold uppercase tracking-wide text-primary-foreground"
              >
                {busy ? (
                  <>
                    <span>Setting up</span>
                    <Dots className="bg-primary-foreground" />
                  </>
                ) : (
                  "Play again"
                )}
              </button>
            )}
            {share}
          </div>
        )}
        {challenge}
        <button
          type="button"
          onClick={onLeave}
          className="th-btn-ghost press tap-target w-full rounded-xl border border-border font-display text-base font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Leave
        </button>
        </>
        )}
      </div>
    </div>
  );
}
