import { useEffect, useLayoutEffect, useRef, useState } from "react";

import { ordinal } from "@/lib/duel/ordinal";
import type { Standing } from "@/lib/duel/scoring";
import { TOTAL_ROUNDS } from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect } from "@/lib/sound";

import { AnimatedScore } from "./AnimatedScore";

function Arrow({ standing }: { standing: Standing }) {
  if (standing.previousPosition === null) {
    return <span className="font-mono text-[11px] text-muted-foreground">–</span>;
  }
  const moved = standing.previousPosition - standing.position;
  if (moved === 0) return <span className="font-mono text-[11px] text-muted-foreground">–</span>;
  return (
    <span className={`font-mono text-[11px] ${moved > 0 ? "text-primary" : "text-warn"}`}>
      {moved > 0 ? `▲${moved}` : `▼${-moved}`}
    </span>
  );
}

interface StandingsProps {
  round: number;
  roundTitle: string;
  rows: Standing[];
  mySlot: number;
  autoSeconds: number;
  isHost: boolean;
  ready: boolean;
  onNext: () => void;
}

/** The ranked table between rounds in a room of three or more. */
export function Standings({
  round,
  roundTitle,
  rows,
  mySlot,
  autoSeconds,
  isHost,
  ready,
  onNext,
}: StandingsProps) {
  const topScore = Math.max(0, ...rows.map((r) => r.roundScore));
  const cued = useRef(false);
  const nodes = useRef(new Map<number, HTMLLIElement>());
  const offsets = useRef(new Map<number, number>());
  const [expanded, setExpanded] = useState<number | null>(null);

  useEffect(() => {
    if (cued.current) return;
    cued.current = true;
    playCorrect();
    buzz(12);
  }, []);

  // FLIP: rows slide from where they sat to their new position.
  useLayoutEffect(() => {
    nodes.current.forEach((node, slot) => {
      const top = node.offsetTop;
      const previous = offsets.current.get(slot);
      offsets.current.set(slot, top);
      if (previous === undefined || previous === top) return;
      node.style.transition = "none";
      node.style.transform = `translateY(${previous - top}px)`;
      requestAnimationFrame(() => {
        node.style.transition = "transform 300ms ease-out";
        node.style.transform = "translateY(0)";
      });
    });
  }, [rows]);

  return (
    <div className="flex flex-1 flex-col justify-between gap-6 pt-4 animate-phase-in">
      <div className="flex flex-col gap-4">
        <div className="text-center">
          <p className="break-words font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">
            {roundTitle}
          </p>
          <p className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
            Round {round} of {TOTAL_ROUNDS} · standings
          </p>
        </div>

        <ul className="relative flex flex-col gap-2">
          {rows.map((row) => {
            const isMe = row.slot === mySlot;
            const wonRound = row.roundScore > 0 && row.roundScore === topScore;
            return (
              <li
                key={row.slot}
                ref={(node) => {
                  if (node) nodes.current.set(row.slot, node);
                  else nodes.current.delete(row.slot);
                }}
                className={`rounded-xl border px-3 py-3 ${
                  isMe ? "border-primary/70 bg-primary/10" : "border-border bg-card"
                } ${row.status === "inactive" ? "opacity-40" : ""}`}
              >
                <button
                  type="button"
                  aria-expanded={expanded === row.slot}
                  onClick={() => setExpanded((open) => (open === row.slot ? null : row.slot))}
                  className="grid w-full grid-cols-[1.5rem_1rem_minmax(0,1fr)_auto_auto] items-center gap-x-2 text-left"
                >
                  <span className="font-mono text-sm font-bold tabular-nums text-muted-foreground">
                    {row.position}
                  </span>
                  <Arrow standing={row} />
                  <span className="min-w-0">
                    <span className="block truncate font-display text-sm text-foreground">
                      {row.name}
                    </span>
                    <span
                      title={row.summary}
                      className={`block truncate whitespace-nowrap font-mono text-[10px] ${isMe ? "text-primary/80" : "text-muted-foreground"}`}
                    >
                      {row.summary}
                    </span>
                  </span>
                  <span className="flex items-center gap-1">
                    {wonRound && (
                      <span className="hidden rounded border border-primary px-1 py-0.5 font-display text-[8px] uppercase tracking-wider text-primary min-[390px]:inline">
                        Round won
                      </span>
                    )}
                    <span className="font-mono text-xs tabular-nums text-muted-foreground">
                      {row.roundCorrect === null ? "" : row.roundCorrect ? "✓" : "✕"} +
                      {row.roundScore}
                    </span>
                  </span>
                  <AnimatedScore
                    value={row.total}
                    className="w-10 text-right font-mono text-base font-bold tabular-nums text-foreground"
                  />
                </button>
                {expanded === row.slot && row.detail.length > 0 && (
                  <div className="mt-3 border-t border-border pt-2">
                    {row.detail.map((line, index) => (
                      <p
                        key={index}
                        className={`font-mono text-[10px] leading-relaxed ${isMe ? "text-primary/80" : "text-muted-foreground"}`}
                      >
                        {line}
                      </p>
                    ))}
                  </div>
                )}
              </li>
            );
          })}
        </ul>

        <p className="text-center text-xs text-muted-foreground">
          You are {ordinal(rows.find((r) => r.slot === mySlot)?.position ?? rows.length)} of{" "}
          {rows.length}
        </p>
      </div>

      {isHost ? (
        <button
          type="button"
          onClick={onNext}
          disabled={ready}
          className="press tap-target w-full rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground disabled:opacity-50"
        >
          {ready ? "Next round…" : `Next round (${autoSeconds}s)`}
        </button>
      ) : (
        <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
          Next round in {autoSeconds}s
        </p>
      )}
    </div>
  );
}
