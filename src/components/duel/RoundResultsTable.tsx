import { useEffect, useRef, useState, type ReactNode } from "react";

import {
  VERDICT_LABEL,
  VERDICT_TONE,
  formatElapsed,
  roundResultOrder,
  roundVerdict,
  summaryWithoutTime,
} from "@/lib/duel/resultPresentation";
import type { PlayerLooks } from "@/lib/duel/playerLook";
import type { Standing } from "@/lib/duel/scoring";
import { buzz } from "@/lib/motion";
import { roundPlaces, tieMarks } from "@/lib/duel/tieDisplay";
import { ChevronDown } from "lucide-react";
import { soundCue } from "@/lib/fx/soundCues";
import { cueDurationMs, playRoundWon, playVoice } from "@/lib/sound";

import { AnimatedScore } from "./AnimatedScore";
import { ContinueFooter, type ContinueState } from "./ContinueFooter";
import { Medal } from "./Medal";
import { PlayerBadge } from "./PlayerBadge";
import { useScrollMore } from "./RoomFooter";
import { isCompactRoom, youStyle } from "./Standings";

interface RoundResultsTableProps {
  roundTitle: string;
  /** A short best-answer line ("Best: 17 moves"), when the game has one. */
  best?: string | null;
  rows: Standing[];
  times: ReadonlyMap<number, number | null>;
  /** The round's own clock, ms: a player who reached the buzzer shows it in full ("90s"). */
  clockMs?: number;
  /** Arcade runs, Flash and Bang On: the verdict is the score alone (scoreOnlyVerdict). */
  scoreOnly?: boolean;
  /** Everyone's colour and icon. */
  looks?: PlayerLooks;
  mySlot: number;
  autoSeconds: number;
  finalRound: boolean;
  continueState: ContinueState;
  /** Replays: the round winner's highlight (display only; never blocks Continue). */
  highlight?: ReactNode;
}

export function RoundResultsTable({
  roundTitle,
  best,
  rows,
  times,
  clockMs,
  scoreOnly = false,
  looks,
  mySlot,
  autoSeconds,
  finalRound,
  continueState,
  highlight,
}: RoundResultsTableProps) {
  const ordered = roundResultOrder(rows, times);
  const topScore = Math.max(0, ...ordered.map((row) => row.roundScore));
  const [expanded, setExpanded] = useState<number | null>(null);
  const cued = useRef(false);

  useEffect(() => {
    if (cued.current) return;
    cued.current = true;
    const mine = ordered.find((row) => row.slot === mySlot);
    if (mine && mine.roundScore > 0 && mine.roundScore === topScore) {
      playRoundWon();
      // A shared top score in a 3+ room is a tie: the players sharing it hear "tie" instead.
      const tied = ordered.filter((row) => row.roundScore === topScore).length > 1;
      playVoice(tied ? "voice.tie" : "roundTaken", cueDurationMs("round_won"));
      buzz(12);
      return;
    }
    // Everyone else hears the screen's own sting (the top scorer hears round_won instead, never both).
    soundCue("shared.roundResults");
  }, [mySlot, ordered, topScore]);

  // Places: the round score, then the time used; level on both shares the place (tieDisplay.ts).
  const marks = tieMarks(roundPlaces(ordered, times));
  const listRef = useScrollMore<HTMLOListElement>();
  // Big rooms (31 Oct 2026, up to 16): compact rows; my own row is pinned in view while the list scrolls.
  const compact = isCompactRoom(ordered.length);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 pt-1 text-left animate-phase-in">
      <header className="flex shrink-0 flex-col gap-0.5">
        <div className="rs-head">
          <h1 className="rs-title">{finalRound ? "Final round" : "Round results"}</h1>
          {best && <span className="rs-meta">{best}</span>}
        </div>
        <p className="rs-sub">{roundTitle}</p>
      </header>

      {highlight}

      {/* Rows take their content's height from the top; the list scrolls (and fades) if a big room needs it. */}
      <ol ref={listRef} className="rs-list rs-scroll min-h-0 shrink" data-compact={compact ? "" : undefined} data-pin={compact ? "" : undefined}>
        {ordered.map((row) => {
          const isMe = row.slot === mySlot;
          const won = row.roundScore > 0 && row.roundScore === topScore;
          const open = expanded === row.slot;
          const verdict = roundVerdict(row, scoreOnly);
          const summary = summaryWithoutTime(row.summary);
          const time = formatElapsed(times.get(row.slot) ?? null, clockMs);
          const mark = marks.get(row.slot);
          const look = looks?.get(row.slot);
          const note = finalRound ? null : mark?.note;
          return (
            <li key={row.slot} className="rs-row p-0" data-pinned={isMe && compact ? "" : undefined}>
              <button
                type="button"
                aria-expanded={open}
                onClick={() => setExpanded((value) => (value === row.slot ? null : row.slot))}
                data-you={isMe ? "" : undefined}
                style={isMe ? youStyle(look) : undefined}
                className={`grid ${compact ? "min-h-[44px] py-1" : "min-h-[52px] py-1.5"} w-full ${finalRound ? "grid-cols-[minmax(0,1fr)_auto]" : "grid-cols-[1.5rem_minmax(0,1fr)_auto]"} items-center gap-x-2 pl-3.5 pr-2 text-left ${row.status === "inactive" ? "opacity-40" : ""}`}
              >
                {/* Last round: no positions, so the overall winner stays hidden until the reveal. */}
                {!finalRound && mark && <Medal place={Number(mark.label.replace("=", ""))} shared={mark.shared} />}
                <span className="min-w-0 self-center">
                  <span className="flex min-w-0 items-center gap-2">
                    <PlayerBadge look={look} name={row.name} size={compact ? 24 : 28} />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="flex min-w-0 items-center gap-1.5">
                        <span className="rs-name th-name leading-tight">{row.name}</span>
                        {isMe ? <span className="rs-you shrink-0 text-[13px]">(you)</span> : null}
                        {won && <span className="rs-pill shrink-0">Round won</span>}
                      </span>
                      {/* Under the name, on one line in secondary text: the time used (the buzzer shows the
                          round's full clock), the verdict and the summary, cut with an ellipsis when long.
                          Tapped open, the line wraps and adds the detail. */}
                      <span
                        data-ellipsis
                        data-row-line
                        className={`text-[12.5px] leading-tight text-[var(--ap-text-2)] ${open ? "block whitespace-normal" : "block truncate"}`}
                      >
                        {time ? <span className="tabular-nums">{time} · </span> : null}
                        <span data-verdict={verdict} className={`font-bold ${VERDICT_TONE[verdict]}`}>
                          {VERDICT_LABEL[verdict]}
                        </span>
                        {note ? ` · ${note}` : ""}
                        {summary ? ` · ${open ? [summary, ...row.detail].join(" · ") : summary}` : ""}
                      </span>
                    </span>
                  </span>
                </span>
                <span className="flex items-center gap-1">
                  <AnimatedScore
                    value={row.roundScore}
                    className="th-score rs-total w-12 text-right"
                  />
                  <ChevronDown aria-hidden="true" className={`h-5 w-5 shrink-0 text-[var(--ap-faint)] transition-transform ${open ? "rotate-180" : ""}`} />
                </span>
              </button>
            </li>
          );
        })}
      </ol>
      <div className="min-h-0 flex-1" />

      <ContinueFooter next={finalRound ? "Winner" : "Standings"} autoSeconds={autoSeconds} state={continueState} />
    </div>
  );
}
