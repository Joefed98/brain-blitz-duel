import type { PlayerLooks } from "@/lib/duel/playerLook";
import type { Standing } from "@/lib/duel/scoring";
import { TOTAL_ROUNDS } from "@/lib/duel/types";
import { positionChange, previousStandingOrder } from "@/lib/duel/resultPresentation";
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

function Arrow({ standing }: { standing: Standing }) {
  const change = positionChange(standing);
  if (change === "–") return <span className="font-mono text-[11px] text-muted-foreground">–</span>;
  return (
    <span
      className={`font-mono text-[11px] ${change.startsWith("▲") ? "text-primary" : "text-warn"}`}
    >
      {change}
    </span>
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
}

/** The ranked table between rounds in a room of three or more. */
export function Standings({ round, totalRounds = TOTAL_ROUNDS, rows, looks, mySlot, autoSeconds, continueState }: StandingsProps) {
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

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-2 animate-phase-in">
      <header className="relative shrink-0 px-12 text-center">
        <p className="th-kicker text-primary">Overall standings</p>
        <h1 className="mt-1 font-display text-lg font-bold text-foreground">
          After round {round} of {totalRounds}
        </h1>
        <span className="th-kicker absolute right-0 top-0 whitespace-nowrap text-[10px] tracking-[0.06em] text-muted-foreground">
          Overall
        </span>
      </header>
      <p className="shrink-0 whitespace-nowrap text-center font-mono text-[11px] text-muted-foreground">
        ▲▼ places moved · +points this round · total
      </p>

      {/* Rows take their content's height from the top; the list scrolls if a big room needs it. */}
      <ul className="relative grid min-h-0 flex-[1_1_0px] content-start gap-1.5 overflow-y-auto">
        {displayRows.map((row) => {
          const isMe = row.slot === mySlot;
          return (
            <li
              key={row.slot}
              ref={rowRef(row.slot)}
              data-tint={isMe ? "me" : undefined}
              className={`th-card flex min-h-[44px] items-center rounded-lg border px-2 ${
                isMe ? "border-primary/70 bg-primary/10" : "border-border bg-card"
              } ${row.status === "inactive" ? "opacity-40" : ""}`}
            >
              <div className="grid w-full grid-cols-[1.375rem_1.5rem_minmax(0,1fr)_auto_auto] items-center gap-x-1.5 text-left">
                <Medal place={row.position} />
                <Arrow standing={row} />
                <span className="flex min-w-0 items-center gap-1.5">
                  <PlayerBadge look={looks?.get(row.slot)} name={row.name} size={24} />
                  <span className="th-name block truncate text-sm text-foreground">
                    {row.name}
                  </span>
                </span>
                <span className="whitespace-nowrap font-mono text-[11px] tabular-nums text-muted-foreground">
                  +{row.roundScore}
                </span>
                <AnimatedScore
                  value={row.total}
                  {...(celebrate ? { from: countUpFrom(row), durationMs: COUNT_UP_MS, quiet: true, skip: skipped, countSound: true } : {})}
                  className={`th-score w-14 text-right font-mono text-2xl font-bold tabular-nums ${row.position === 1 ? "th-score-top text-primary" : "text-foreground"}`}
                />
              </div>
            </li>
          );
        })}
      </ul>

      <ContinueFooter next="Next round" autoSeconds={autoSeconds} state={continueState} />
    </div>
  );
}
