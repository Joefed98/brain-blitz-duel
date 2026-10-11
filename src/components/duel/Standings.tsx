import { useEffect, useLayoutEffect, useRef, useState } from "react";

import type { Standing } from "@/lib/duel/scoring";
import { TOTAL_ROUNDS } from "@/lib/duel/types";
import { positionChange, previousStandingOrder } from "@/lib/duel/resultPresentation";
import { Button } from "@/components/ui/button";
import { prefersReducedMotion } from "@/lib/motion";

import { AnimatedScore } from "./AnimatedScore";

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
  mySlot: number;
  autoSeconds: number;
  isHost: boolean;
  onNext: () => void;
}

/** The ranked table between rounds in a room of three or more. */
export function Standings({ round, totalRounds = TOTAL_ROUNDS, rows, mySlot, autoSeconds, isHost, onNext }: StandingsProps) {
  const nodes = useRef(new Map<number, HTMLLIElement>());
  const offsets = useRef(new Map<number, number>());
  const [displayRows, setDisplayRows] = useState(() => previousStandingOrder(rows));

  useEffect(() => {
    const frame = requestAnimationFrame(() => setDisplayRows(rows));
    return () => cancelAnimationFrame(frame);
  }, [rows]);

  // FLIP: rows slide from where they sat to their new position.
  useLayoutEffect(() => {
    nodes.current.forEach((node, slot) => {
      const top = node.offsetTop;
      const previous = offsets.current.get(slot);
      offsets.current.set(slot, top);
      if (previous === undefined || previous === top || prefersReducedMotion()) return;
      node.style.transition = "none";
      node.style.transform = `translateY(${previous - top}px)`;
      requestAnimationFrame(() => {
        node.style.transition = "transform 300ms ease-out";
        node.style.transform = "translateY(0)";
      });
    });
  }, [displayRows]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 pt-2 animate-phase-in">
      <header className="relative shrink-0 px-12 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
          Overall standings
        </p>
        <h1 className="mt-1 font-display text-lg font-bold text-foreground">
          After round {round} of {totalRounds}
        </h1>
        <span className="absolute right-0 top-0 font-mono text-[10px] uppercase text-muted-foreground">
          Overall
        </span>
      </header>

      <ul
        className="relative grid min-h-0 flex-1 gap-1.5"
        style={{ gridTemplateRows: `repeat(${displayRows.length}, minmax(0, 1fr))` }}
      >
        {displayRows.map((row) => {
          const isMe = row.slot === mySlot;
          return (
            <li
              key={row.slot}
              ref={(node) => {
                if (node) nodes.current.set(row.slot, node);
                else nodes.current.delete(row.slot);
              }}
              className={`flex min-h-[38px] items-center rounded-md border px-2 ${
                isMe ? "border-primary/70 bg-primary/10" : "border-border bg-card"
              } ${row.status === "inactive" ? "opacity-40" : ""}`}
            >
              <div className="grid w-full grid-cols-[1.25rem_1.5rem_minmax(0,1fr)_auto_auto] items-center gap-x-1.5 text-left">
                <span className="font-mono text-sm font-bold tabular-nums text-muted-foreground">
                  {row.position}
                </span>
                <Arrow standing={row} />
                <span className="min-w-0">
                  <span className="block truncate font-display text-sm text-foreground">
                    {row.name}
                  </span>
                </span>
                <span className="font-mono text-[10px] tabular-nums text-muted-foreground">
                  +{row.roundScore}
                </span>
                <AnimatedScore
                  value={row.total}
                  className="w-12 text-right font-mono text-xl font-bold tabular-nums text-foreground"
                />
              </div>
            </li>
          );
        })}
      </ul>

      <footer className="shrink-0 pt-1">
        {isHost ? (
          <Button
            onClick={onNext}
            className="press tap-target w-full font-display font-bold uppercase"
          >
            Next round ({autoSeconds}s)
          </Button>
        ) : (
          <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Next round in {autoSeconds}s
          </p>
        )}
      </footer>
    </div>
  );
}
