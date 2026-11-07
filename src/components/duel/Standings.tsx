import { useEffect, useRef, type CSSProperties } from "react";

import { GameIcon } from "@/components/app/GameIcon";
import { PLAYER_COLOURS, type PlayerLook, type PlayerLooks } from "@/lib/duel/playerLook";
import { puzzleDef, puzzleName } from "@/lib/duel/registry";
import { tieMarks } from "@/lib/duel/tieDisplay";
import type { PuzzleType } from "@/lib/duel/types";
import type { Standing } from "@/lib/duel/scoring";
import { TOTAL_ROUNDS } from "@/lib/duel/types";
import { positionChange, previousStandingOrder } from "@/lib/duel/resultPresentation";
import { isNewLeader } from "@/lib/fx/roomVoices";
import { queueVoice } from "@/lib/sound";
import { COUNT_UP_MS, COUNT_UP_SLIDE_MS, countUpFrom } from "@/lib/fx/celebrations";
import {
  useCelebrationScope,
  useCelebrationsOn,
  useCountUpClimbs,
  useTapToSkip,
} from "@/components/fx/useCelebration";
import { useFlipRows } from "@/components/fx/useFlipRows";

import { AnimatedScore } from "./AnimatedScore";
import { ContinueFooter, type ContinueState } from "./ContinueFooter";
import { Medal } from "./Medal";
import { PlayerBadge } from "./PlayerBadge";
import { CATEGORY_NAMES } from "./GameFrame";
import { useScrollMore } from "./RoomFooter";
import { Nameplate } from "@/design/components";

/** Movement since the round before: ▲ green, ▼ red, – grey. */
export function Arrow({ standing }: { standing: Standing }) {
  const change = positionChange(standing);
  const move = change === "–" ? "same" : change.startsWith("▲") ? "up" : "down";
  return (
    <span data-move={move} className="rs-move">
      {change}
    </span>
  );
}

/**
 * Rooms bigger than the old cap of ten (31 Oct 2026, rooms of up to 16) show compact rows, my own row
 * pinned, and the podium's top three with my place; rooms of ten or fewer are drawn as before.
 */
export const COMPACT_ROOM_FROM = 11;
export function isCompactRoom(players: number): boolean {
  return players >= COMPACT_ROOM_FROM;
}

/** A player's colour as a CSS value for the "you" bar (room-screens.css). */
export function youStyle(look: PlayerLook | undefined): CSSProperties | undefined {
  const hex = look ? PLAYER_COLOURS[look.colour]?.hex : undefined;
  return hex ? ({ ["--you" as string]: hex } as CSSProperties) : undefined;
}

/** The round's winner (or winners, level) and the next round's game, in the space above Continue. */
export interface StandingsExtras {
  winners: { slot: number; name: string }[];
  winnerScore: number;
  /** The round's game. */
  game?: PuzzleType | undefined;
  /** The next round's game (none after the last round). */
  next?: PuzzleType | null | undefined;
}

export function RoundWinnerCard({ round, extras, looks }: { round: number; extras: StandingsExtras; looks?: PlayerLooks | undefined }) {
  const { winners, winnerScore, game } = extras;
  if (!winners.length || winnerScore <= 0) return null;
  const first = winners[0]!;
  return (
    <div data-round-winner className="rs-list">
      <div className="rs-row min-h-[58px]">
        <PlayerBadge look={looks?.get(first.slot)} name={first.name} size={32} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="rs-sub">{winners.length > 1 ? `Round ${round}, level` : `Round ${round} winner`}</span>
          <span data-names className="rs-name th-name">{winners.map((w) => w.name).join(", ")}</span>
        </span>
        <span className="flex shrink-0 flex-col items-end">
          <span className="rs-total text-[18px]">+{winnerScore}</span>
          {game ? <span className="rs-sub max-w-[120px]">{puzzleName(game)}</span> : null}
        </span>
      </div>
    </div>
  );
}

export function NextRoundCard({ round, totalRounds, next }: { round: number; totalRounds: number; next: PuzzleType }) {
  const category = puzzleDef(next).category;
  return (
    <div data-next-round className="rs-list">
      <div className="rs-row min-h-[58px]">
        <GameIcon type={next} size={40} />
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="rs-sub">{round + 1 >= totalRounds ? "Final round" : `Next, round ${round + 1} of ${totalRounds}`}</span>
          <span className="rs-name">{puzzleName(next)}</span>
        </span>
        <span className="th-pill shrink-0" data-cat={category}>{CATEGORY_NAMES[category]}</span>
      </div>
    </div>
  );
}

interface StandingsProps {
  round: number;
  /** The room's own round count; older rooms default to six. */
  totalRounds?: number;
  rows: Standing[];
  /** Everyone's colour and icon. */
  looks?: PlayerLooks;
  mySlot: number;
  autoSeconds: number;
  continueState: ContinueState;
  /** The round's winner and the next round's game, above Continue. */
  extras?: StandingsExtras | undefined;
}

/** The ranked table between rounds in a room of three or more. */
export function Standings({ round, totalRounds = TOTAL_ROUNDS, rows, looks, mySlot, autoSeconds, continueState, extras }: StandingsProps) {
  // Celebrations (src/lib/fx/celebrations.ts): totals count up from the round before over
  // COUNT_UP_MS, the rows slide into place more slowly and a climb gets sparks and a zap at its
  // row; a tap anywhere skips to the final state. Off: today's quick slide and final totals.
  const celebrate = useCelebrationsOn();
  const scope = useCelebrationScope();
  const skipped = useTapToSkip(celebrate);
  const { displayRows, rowRef, nodes } = useFlipRows(rows, {
    from: previousStandingOrder(rows),
    slideMs: celebrate ? COUNT_UP_SLIDE_MS : 300,
    skip: skipped,
  });
  useCountUpClimbs(celebrate, scope, rows, nodes);
  // "New leader" (3 Nov 2026, roomVoices.ts): once, when first place changed hands this round.
  const leaderCued = useRef(false);
  useEffect(() => {
    if (leaderCued.current) return;
    leaderCued.current = true;
    if (isNewLeader(rows)) queueVoice("voice.newLeader", 600);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const marks = tieMarks(rows.map((row) => ({ slot: row.slot, points: row.total, position: row.position })));
  const listRef = useScrollMore<HTMLUListElement>();
  const compact = isCompactRoom(rows.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-1 text-left animate-phase-in">
      <header className="rs-head shrink-0">
        <h1 className="rs-title">Standings</h1>
        <span className="rs-meta">
          After round {round} of {totalRounds}
        </span>
      </header>

      {/* Rows take their content's height from the top; the list scrolls (and fades) if a big room needs it. */}
      <ul ref={listRef} className="rs-list rs-scroll relative min-h-0 shrink" data-compact={compact ? "" : undefined} data-pin={compact ? "" : undefined}>
        {displayRows.map((row) => {
          const isMe = row.slot === mySlot;
          const mark = marks.get(row.slot);
          const look = looks?.get(row.slot);
          return (
            <li
              key={row.slot}
              ref={rowRef(row.slot)}
              data-you={isMe ? "" : undefined}
              data-pinned={isMe && compact ? "" : undefined}
              style={isMe ? youStyle(look) : undefined}
              className={`rs-row ${row.status === "inactive" ? "opacity-40" : ""}`}
            >
              <div className="grid w-full grid-cols-[1.5rem_1.375rem_minmax(0,1fr)_auto_3.25rem] items-center gap-x-2">
                <Medal place={row.position} shared={mark?.shared} />
                <Arrow standing={row} />
                <Nameplate look={look} name={row.name} you={isMe} kind="mini" disc={compact ? 24 : 28} />
                <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-[var(--ap-text-2)]">
                  +{row.roundScore}
                </span>
                <AnimatedScore
                  value={row.total}
                  {...(celebrate ? { from: countUpFrom(row), durationMs: COUNT_UP_MS, quiet: true, skip: skipped, countSound: true } : {})}
                  className="th-score rs-total text-right"
                />
                {mark?.note ? <span data-tie-note className="rs-sub rs-tie-note">{mark.note}</span> : null}
              </div>
            </li>
          );
        })}
      </ul>

      {extras ? (
        <div className="flex shrink-0 flex-col gap-2">
          <RoundWinnerCard round={round} extras={extras} looks={looks} />
          {extras.next ? <NextRoundCard round={round} totalRounds={totalRounds} next={extras.next} /> : null}
        </div>
      ) : null}
      <div className="min-h-0 flex-1" />

      <ContinueFooter next="Next round" autoSeconds={autoSeconds} state={continueState} />
    </div>
  );
}
