import type { PlayerLooks } from "@/lib/duel/playerLook";
import type { Standing } from "@/lib/duel/scoring";
import { tieMarks } from "@/lib/duel/tieDisplay";
import { TOTAL_ROUNDS } from "@/lib/duel/types";
import { AnimatedScore } from "./AnimatedScore";
import { ContinueFooter, type ContinueState } from "./ContinueFooter";
import { Medal } from "./Medal";
import { PlayerBadge } from "./PlayerBadge";
import { Arrow, NextRoundCard, RoundWinnerCard, youStyle, type StandingsExtras } from "./Standings";

interface DuelOverallProps {
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

/** The two-player standings between rounds: the same rows as a bigger room's (Polish batch R). */
export function DuelOverall({
  round,
  totalRounds = TOTAL_ROUNDS,
  rows,
  looks,
  mySlot,
  autoSeconds,
  continueState,
  extras,
}: DuelOverallProps) {
  const ordered = [...rows].sort((a, b) => a.position - b.position || a.slot - b.slot);
  const marks = tieMarks(ordered.map((row) => ({ slot: row.slot, points: row.total, position: row.position })));
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-1 text-left animate-phase-in">
      <header className="rs-head shrink-0">
        <h1 className="rs-title">Standings</h1>
        <span className="rs-meta">
          After round {round} of {totalRounds}
        </span>
      </header>
      <ul className="rs-list shrink-0">
        {ordered.map((row) => {
          const isMe = row.slot === mySlot;
          const mark = marks.get(row.slot);
          const look = looks?.get(row.slot);
          return (
            <li
              key={row.slot}
              data-you={isMe ? "" : undefined}
              style={isMe ? youStyle(look) : undefined}
              className={`rs-row min-h-[60px] ${row.status === "inactive" ? "opacity-40" : ""}`}
            >
              <div className="grid w-full grid-cols-[1.5rem_1.375rem_minmax(0,1fr)_auto_3.75rem] items-center gap-x-2">
                <Medal place={row.position} shared={mark?.shared} />
                <Arrow standing={row} />
                <span className="flex min-w-0 items-center gap-2">
                  <PlayerBadge look={look} name={row.name} size={30} />
                  <span className="flex min-w-0 flex-col">
                    <span className="flex min-w-0 items-baseline gap-1">
                      <span className="rs-name th-name">{row.name}</span>
                      {isMe ? <span className="rs-you shrink-0 text-[13px]">(you)</span> : null}
                    </span>
                  </span>
                </span>
                <span className="whitespace-nowrap text-[13px] font-semibold tabular-nums text-[var(--ap-text-2)]">
                  +{row.roundScore}
                </span>
                <span className="th-score rs-total text-right text-[26px]">
                  <AnimatedScore value={row.total} />
                </span>
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
