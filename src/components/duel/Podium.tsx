import { useEffect, useRef, useState, type ReactNode } from "react";

import { ordinal } from "@/lib/duel/ordinal";
import { puzzleName } from "@/lib/duel/registry";
import type { Standing } from "@/lib/duel/scoring";
import type { PlayerLooks } from "@/lib/duel/playerLook";
import type { PodiumAward } from "@/lib/duel/podiumAwards";
import type { PuzzleType, RoundResultRow, StoredPuzzleType } from "@/lib/duel/types";
import { tieMarks } from "@/lib/duel/tieDisplay";
import { GameIcon, hasGameIcon } from "@/components/app/GameIcon";
import { ChevronDown } from "lucide-react";
import { playerBreakdown, roundPlacingsOf } from "@/lib/duel/scoring";
import { haptic } from "@/lib/haptics";
import { playVoice, queueVoice } from "@/lib/sound";
import { cleanSweepSlot, isPhotoFinish } from "@/lib/fx/roomVoices";
import { fx } from "@/lib/fx";
import {
  COUNT_UP_SLIDE_MS,
  celebrationSound,
  podiumHero,
  podiumWinnerIsMe,
  showBanner,
  sparkBurst,
} from "@/lib/fx/celebrations";
import { placedOf, previousStandingOrder, shownCountFrom, shownTotal } from "@/lib/duel/resultPresentation";
import { useCelebrationScope, useCelebrationsOn, useCountUpClimbs, useTapToSkip } from "@/components/fx/useCelebration";
import { useFlipRows } from "@/components/fx/useFlipRows";


import { FeedbackLink } from "@/components/beta/FeedbackLink";

import { AnimatedScore } from "./AnimatedScore";
import { ConfettiBurst } from "./ArcadeCelebration";
import { Dots } from "./Dots";
import { Medal } from "./Medal";
import { PlayerBadge } from "./PlayerBadge";
import { PodiumAwards } from "./PodiumAwards";
import { RoomFooter } from "./RoomFooter";
import { isCompactRoom, youStyle } from "./Standings";
import { Button } from "@/design/components";

/** The steps: flat panels, the top one tallest, each with its medal (Polish batch R: a compact podium). */
const STEP_HEIGHT = ["h-[46px]", "h-[34px]", "h-[26px]"];

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
  shared,
}: {
  standing: Standing | undefined;
  place: number;
  looks: PlayerLooks;
  celebrate: boolean;
  skip: boolean;
  shared: boolean;
}) {
  if (!standing) return <div className="flex-1" />;
  const height = STEP_HEIGHT[place - 1];
  if (!height) return null;
  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center justify-end gap-0.5" data-podium-place={place}>
      {place === 1 && (
        // The winner moment: one confetti burst over the gold block (outside
        // the block's pop-in scale, so the canvas measures its full size).
        <div className="pointer-events-none absolute -inset-x-4 -top-16 bottom-0 z-10" aria-hidden="true">
          <ConfettiBurst world="gem" />
        </div>
      )}
      {/* The winner's name and total keep to the step's left part, so the hero on its right end is clear. */}
      <div className={`flex w-full min-w-0 flex-col items-center gap-0.5 ${place === 1 && celebrate ? "pr-9" : ""}`}>
        <PlayerBadge look={looks.get(standing.slot)} name={standing.name} size={place === 1 ? 30 : 26} />
        <span className="th-name max-w-full truncate text-[13px] font-semibold text-foreground">
          {standing.name}
        </span>
        <AnimatedScore
          value={shownTotal(standing)}
          from={celebrate ? shownCountFrom(standing) : 0}
          durationMs={COUNT_UP_MS}
          quiet
          skip={skip}
          countSound={celebrate}
          className="th-score text-[19px] tabular-nums text-foreground"
        />
      </div>
      <div
        data-podium-step={celebrate ? place : undefined}
        className={`mt-1 flex w-full animate-pop-in items-start justify-center rounded-t-[14px] bg-[var(--ap-panel)] pt-2 ${height}`}
      >
        <Medal place={place} shared={shared} />
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
  /** Leave: the header's "⋯" menu (the room route draws it, Polish batch R). */
  onLeave?: () => void;
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
  playOfTheGame,
  share,
  challenge,
  actions,
}: PodiumProps) {
  const [open, setOpen] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);
  const mine = rows.find((r) => r.slot === mySlot);
  const won = mine?.position === 1;
  const sharedFirst = won && rows.filter((r) => r.position === 1).length > 1;
  const cued = useRef(false);
  // Celebrations (src/lib/fx/celebrations.ts): the hero beside the winner's step with a burst (and,
  // for the winner's own phone, "You win!" and the spark chime); totals count up from the round before and
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
        sparkBurst(scope, box.right - 20, box.top - 28, { count: 44 });
        // The hero takes his pose: the sting on every phone (the winner's and everyone watching).
        celebrationSound("victory");
      }
      if (iWon) {
        showBanner(scope, "You win!");
        celebrationSound("chime");
      }
    }, PODIUM_HERO_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [celebrate]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (cued.current) return;
    cued.current = true;
    fx.onPodium();
    // The winner hears "you win" (a shared first place "draw", 3 Nov 2026); everyone else "GG".
    playVoice(sharedFirst ? "voice.draw" : won ? "voice.youWin" : "gg");
    // The room's end lines (roomVoices.ts), after that one: a shared first place is a draw for
    // everyone watching too; else the top two's totals 1–5 apart are a photo finish (only here, at the
    // room's end, Joe's decision); else one player taking every round is a clean sweep.
    const firstShared = rows.filter((r) => r.position === 1).length > 1;
    if (firstShared && !sharedFirst) queueVoice("voice.draw");
    else if (!firstShared && isPhotoFinish(rows.map((r) => r.total))) queueVoice("voice.photoFinish");
    else if (!firstShared && cleanSweepSlot(results, roundOrder.length) !== null) queueVoice("voice.cleanSweep");
    // Haptics (lib/haptics.ts): the winner's phone celebrates.
    if (won) haptic("celebrate");
  }, [won, sharedFirst]); // eslint-disable-line react-hooks/exhaustive-deps

  const marks = tieMarks(rows.map(placedOf));
  // Placings rooms (scoringMode.ts): points on every row, and each round's place in the round list.
  const placings = rows.some((row) => row.points !== undefined);
  const roundPlaces = (round: number) => roundPlacingsOf(results, rows, round);
  // Rooms of 11+ (31 Oct 2026, up to 16): the top three and my own row, the rest one tap away.
  const big = isCompactRoom(rows.length);
  const podiumRows = big && !showAll ? listRows.filter((row) => row.position <= 3 || row.slot === mySlot) : listRows;
  const sharedAt = (place: number) => rows.filter((r) => r.position === place).length > 1;

  return (
    <div ref={root} className="relative flex flex-1 flex-col gap-2.5 text-left animate-phase-in">
      {won ? (
        <h1 className="text-center text-[30px] font-extrabold leading-tight text-foreground animate-word-scale-in">
          {sharedFirst ? "Joint winner!" : "You win!"}
        </h1>
      ) : (
        <h1 className="whitespace-nowrap text-center text-[22px] font-extrabold text-foreground animate-word-scale-in">
          You finished {ordinal(mine?.position ?? rows.length)} of {rows.length}
        </h1>
      )}

      <div className="flex items-end gap-2 px-1">
        <Plinth standing={rows.find((r) => r.position === 2)} place={2} looks={looks} celebrate={celebrate} skip={skipped} shared={sharedAt(2)} />
        <Plinth standing={rows.find((r) => r.position === 1)} place={1} looks={looks} celebrate={celebrate} skip={skipped} shared={sharedAt(1)} />
        <Plinth standing={rows.find((r) => r.position === 3)} place={3} looks={looks} celebrate={celebrate} skip={skipped} shared={sharedAt(3)} />
      </div>

      <ul className="rs-list" data-podium-list={big ? (showAll ? "all" : "top") : undefined}>
        {podiumRows.map((row) => {
          const isMe = row.slot === mySlot;
          // Big rooms: under the top three, a line with your place, then your row.
          const placeLine =
            big && !showAll && isMe && row.position > 3 ? (
              <li key="place-line" data-podium-place-line className="rs-row min-h-9 py-1 text-[13px] font-semibold text-[var(--ap-text-2)]">
                Your place: {ordinal(row.position)} of {rows.length}
              </li>
            ) : null;
          const mark = marks.get(row.slot);
          const look = looks.get(row.slot);
          return [
            placeLine,
            <li key={row.slot} ref={celebrate ? rowRef(row.slot) : undefined} className="rs-row flex-col items-stretch gap-0 p-0">
              <button
                type="button"
                aria-expanded={open === row.slot}
                aria-label={`${row.name}: ${shownTotal(row)} ${shownTotal(row) === 1 ? "point" : "points"}. Show round scores`}
                onClick={() => setOpen((current) => (current === row.slot ? null : row.slot))}
                data-you={isMe ? "" : undefined}
                style={isMe ? youStyle(look) : undefined}
                className={`flex min-h-12 w-full items-center gap-2.5 py-1 pl-3.5 pr-2 text-left ${row.status === "inactive" ? "opacity-40" : ""}`}
              >
                <Medal place={row.position} shared={mark?.shared} />
                <PlayerBadge look={look} name={row.name} size={28} />
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="flex min-w-0 items-baseline gap-1">
                    <span className="rs-name th-name">{row.name}</span>
                    {isMe ? <span className="rs-you shrink-0 text-[13px]">(you)</span> : null}
                  </span>
                  {mark?.note ? <span data-tie-note className="rs-sub">{mark.note}</span> : null}
                </span>
                <AnimatedScore
                  value={shownTotal(row)}
                  from={celebrate ? shownCountFrom(row) : 0}
                  durationMs={COUNT_UP_MS}
                  quiet
                  skip={skipped}
                  countSound={celebrate}
                  className="th-score rs-total"
                />
                <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-[var(--ap-faint)] transition-transform ${open === row.slot ? "rotate-180" : ""}`} />
              </button>
              {open === row.slot && (
                <div className="border-t border-border px-3.5 py-1.5">
                  {playerBreakdown(results, row.slot, roundOrder.length || undefined).map((entry) => {
                    const type = roundOrder[entry.round - 1] ?? "wordsmith";
                    const placing = placings ? roundPlaces(entry.round).get(row.slot) : undefined;
                    return (
                      <div key={entry.round} className="flex min-h-9 items-center gap-2.5 py-0.5 text-[13px]">
                        {hasGameIcon(type) ? <GameIcon type={type as PuzzleType} size={26} /> : <span className="h-[26px] w-[26px]" />}
                        <span className="min-w-0 flex-1 truncate text-[var(--ap-text-2)]">{puzzleName(type)}</span>
                        {placing ? (
                          <>
                            <span data-round-place className="rs-gain font-normal">
                              {ordinal(placing.place)} · {entry.score}
                            </span>
                            <span className="font-semibold tabular-nums">+{placing.points}</span>
                          </>
                        ) : (
                        <span className="font-semibold tabular-nums">{entry.score}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </li>,
          ];
        })}
        {big ? (
          <li className="rs-row p-0">
            <button
              type="button"
              data-podium-all
              aria-expanded={showAll}
              onClick={() => setShowAll((value) => !value)}
              className="press flex min-h-11 w-full items-center justify-center gap-1 text-[13px] font-semibold text-[var(--ap-text-2)]"
            >
              {showAll ? "Show the top three" : `See all ${rows.length} players`}
              <ChevronDown aria-hidden="true" className={`h-4 w-4 transition-transform ${showAll ? "rotate-180" : ""}`} />
            </button>
          </li>
        ) : null}
      </ul>

      <PodiumAwards awards={awards} looks={looks} names={new Map(rows.map((r) => [r.slot, r.name]))} mySlot={mySlot} />

      {playOfTheGame}

      {challenge}

      {/* SEND FEEDBACK (the beta's form; nothing while TALLY_URL is empty). */}
      <FeedbackLink small />

      {actions ? (
        // A friend challenge's own buttons, pinned to the screen's bottom (no chat under it).
        <div data-podium-actions className="room-sticky-footer sticky bottom-0 z-30 mt-auto flex flex-col gap-2 bg-background pb-2 pt-2">
          {actions}
        </div>
      ) : (
        // The room footer: the chat button, Share (secondary) and Play again (gold, the host's). Leave is
        // in the header's "⋯" menu.
        <RoomFooter className="mt-auto">
          <div data-podium-actions className="flex min-w-0 flex-1 items-center gap-2">
            {isHost ? (
              <Button
                variant="gold"
                size={52}
                onClick={onPlayAgain}
                disabled={busy}
              >
                {busy ? (
                  <>
                    <span>Setting up</span>
                    <Dots className="bg-primary-foreground" />
                  </>
                ) : (
                  "Play again"
                )}
              </Button>
            ) : (
              <p className="rs-status h-[52px]">Waiting for the host{/* design-lint-ignore: the existing height; only the words changed */}</p>
            )}
            {share}
          </div>
        </RoomFooter>
      )}
    </div>
  );
}
