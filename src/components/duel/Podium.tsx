import { useEffect, useRef, useState } from "react";

import { ordinal } from "@/lib/duel/ordinal";
import { puzzleName } from "@/lib/duel/registry";
import type { Standing } from "@/lib/duel/scoring";
import type { PuzzleType, RoundResultRow } from "@/lib/duel/types";
import { playerBreakdown } from "@/lib/duel/scoring";
import { buzz } from "@/lib/motion";
import { playWin } from "@/lib/sound";

import { AnimatedScore } from "./AnimatedScore";
import { Dots } from "./Dots";
import { WinBurst } from "./WinBurst";

const PLINTH = [
  { height: "h-24", tone: "border-primary/70 bg-primary/15 text-primary" },
  { height: "h-16", tone: "border-border bg-card text-muted-foreground" },
  { height: "h-12", tone: "border-warn/50 bg-warn/10 text-warn" },
];

function Plinth({ standing, place }: { standing: Standing | undefined; place: number }) {
  if (!standing) return <div className="flex-1" />;
  const style = PLINTH[place - 1]!;
  return (
    <div className="flex flex-1 flex-col items-center justify-end gap-2">
      <span className="max-w-full truncate font-display text-xs text-foreground">
        {standing.name}
      </span>
      <span className="font-mono text-lg font-bold tabular-nums text-foreground">
        {standing.total}
      </span>
      <div
        className={`flex w-full animate-pop-in items-start justify-center rounded-t-xl border pt-2 font-mono text-sm font-bold ${style.height} ${style.tone}`}
      >
        {place}
      </div>
    </div>
  );
}

interface PodiumProps {
  rows: Standing[];
  mySlot: number;
  results: RoundResultRow[];
  roundOrder: PuzzleType[];
  isHost: boolean;
  busy: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
}

/** The final screen for a room of three or more players. */
export function Podium({
  rows,
  mySlot,
  results,
  roundOrder,
  isHost,
  busy,
  onPlayAgain,
  onLeave,
}: PodiumProps) {
  const [open, setOpen] = useState<number | null>(null);
  const mine = rows.find((r) => r.slot === mySlot);
  const won = mine?.position === 1;
  const cued = useRef(false);

  useEffect(() => {
    if (cued.current) return;
    cued.current = true;
    if (won) {
      playWin();
      buzz([25, 50, 25]);
    }
  }, [won]);

  return (
    <div className="relative flex flex-1 flex-col justify-between gap-6 pt-6 animate-phase-in">
      {won && <WinBurst />}

      {won ? (
        <h1 className="text-center font-display text-5xl font-bold text-primary animate-word-scale-in">
          1st
        </h1>
      ) : (
        <h1 className="text-center font-display text-3xl font-bold text-foreground animate-word-scale-in">
          You finished {ordinal(mine?.position ?? rows.length)} of {rows.length}
        </h1>
      )}

      <div className="flex items-end gap-2">
        <Plinth standing={rows.find((r) => r.position === 2)} place={2} />
        <Plinth standing={rows.find((r) => r.position === 1)} place={1} />
        <Plinth standing={rows.find((r) => r.position === 3)} place={3} />
      </div>

      <ul className="flex flex-col gap-1 overflow-y-auto">
        {rows.map((row) => (
          <li key={row.slot} className="overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              onClick={() => setOpen((current) => (current === row.slot ? null : row.slot))}
              className={`flex w-full items-center gap-3 px-3 py-3 text-left ${
                row.slot === mySlot ? "bg-primary/10" : ""
              } ${row.status === "inactive" ? "opacity-40" : ""}`}
            >
              <span className="w-6 font-mono text-sm tabular-nums text-muted-foreground">
                {row.position}
              </span>
              <span className="flex-1 truncate font-display text-sm">{row.name}</span>
              <AnimatedScore
                value={row.total}
                className="font-mono text-base font-bold tabular-nums"
              />
              <span className="font-mono text-xs text-muted-foreground">
                {open === row.slot ? "−" : "+"}
              </span>
            </button>
            {open === row.slot && (
              <div className="border-t border-border px-3 py-2">
                {playerBreakdown(results, row.slot).map((entry) => (
                  <div
                    key={entry.round}
                    className="flex items-center justify-between py-1 text-[11px]"
                  >
                    <span className="uppercase tracking-widest text-muted-foreground">
                      {puzzleName(roundOrder[entry.round - 1] ?? "anagram")}
                    </span>
                    <span className="font-mono tabular-nums">{entry.score}</span>
                  </div>
                ))}
              </div>
            )}
          </li>
        ))}
      </ul>

      <div className="flex flex-col gap-3">
        {isHost ? (
          <button
            type="button"
            onClick={onPlayAgain}
            disabled={busy}
            className="press tap-target flex w-full items-center justify-center gap-2 rounded-xl bg-primary font-display text-base font-bold uppercase tracking-wide text-primary-foreground"
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
        ) : (
          <p className="text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
            Waiting for host…
          </p>
        )}
        <button
          type="button"
          onClick={onLeave}
          className="press tap-target w-full rounded-xl border border-border font-display text-base font-semibold uppercase tracking-wide text-muted-foreground"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
