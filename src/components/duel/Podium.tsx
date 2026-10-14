import { useEffect, useRef, useState, type ReactNode } from "react";

import { ordinal } from "@/lib/duel/ordinal";
import { puzzleName } from "@/lib/duel/registry";
import type { Standing } from "@/lib/duel/scoring";
import type { RoundResultRow, StoredPuzzleType } from "@/lib/duel/types";
import { playerBreakdown } from "@/lib/duel/scoring";
import { buzz } from "@/lib/motion";
import { playVoice } from "@/lib/sound";
import { fx } from "@/lib/fx";

import { CHAT_BAR_HEIGHT } from "@/lib/duel/chatConstants";

import { AnimatedScore } from "./AnimatedScore";
import { ConfettiBurst } from "./ArcadeCelebration";
import { Dots } from "./Dots";

/** Gold, silver-grey and bronze-amber blocks (podium tokens in styles.css). */
const PLINTH = [
  { height: "h-20", tone: "border-podium-gold bg-podium-gold/25 text-podium-gold" },
  { height: "h-14", tone: "border-podium-silver/80 bg-podium-silver/15 text-podium-silver" },
  { height: "h-10", tone: "border-podium-bronze/80 bg-podium-bronze/20 text-podium-bronze" },
];

/** Every total on the podium counts up from 0 over this long. */
const COUNT_UP_MS = 1200;

function Plinth({ standing, place }: { standing: Standing | undefined; place: number }) {
  if (!standing) return <div className="flex-1" />;
  const style = PLINTH[place - 1];
  if (!style) return null;
  return (
    <div className="relative flex flex-1 flex-col items-center justify-end gap-1" data-podium-place={place}>
      {place === 1 && (
        // The winner moment: one confetti burst over the gold block (outside
        // the block's pop-in scale, so the canvas measures its full size).
        <div className="pointer-events-none absolute -inset-x-4 -top-16 bottom-0 z-10" aria-hidden="true">
          <ConfettiBurst world="gem" />
        </div>
      )}
      <span className="max-w-full truncate font-display text-xs text-foreground">
        {standing.name}
      </span>
      <AnimatedScore
        value={standing.total}
        from={0}
        durationMs={COUNT_UP_MS}
        quiet
        className="font-mono text-lg font-bold tabular-nums text-foreground"
      />
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
  roundOrder: StoredPuzzleType[];
  isHost: boolean;
  busy: boolean;
  onPlayAgain: () => void;
  onLeave: () => void;
  /** Replays: the play of the game panel (display only; never blocks Play again or Leave). */
  playOfTheGame?: ReactNode;
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
  playOfTheGame,
}: PodiumProps) {
  const [open, setOpen] = useState<number | null>(null);
  const mine = rows.find((r) => r.slot === mySlot);
  const won = mine?.position === 1;
  const cued = useRef(false);

  useEffect(() => {
    if (cued.current) return;
    cued.current = true;
    fx.onPodium();
    playVoice("gg");
    if (won) buzz([25, 50, 25]);
  }, [won]);

  return (
    <div className="relative flex flex-1 flex-col gap-4 pt-2 animate-phase-in">
      {won ? (
        <h1 className="text-center font-display text-4xl font-bold text-podium-gold animate-word-scale-in">
          1st
        </h1>
      ) : (
        <h1 className="text-center font-display text-2xl font-bold text-foreground animate-word-scale-in">
          You finished {ordinal(mine?.position ?? rows.length)} of {rows.length}
        </h1>
      )}

      <div className="flex items-end gap-2">
        <Plinth standing={rows.find((r) => r.position === 2)} place={2} />
        <Plinth standing={rows.find((r) => r.position === 1)} place={1} />
        <Plinth standing={rows.find((r) => r.position === 3)} place={3} />
      </div>

      {playOfTheGame}

      <p className="-mb-2 text-center text-[11px] text-foreground/70">Tap a player for their round scores</p>
      <ul className="flex flex-col gap-1">
        {rows.map((row) => (
          <li key={row.slot} className="overflow-hidden rounded-xl border border-border bg-card">
            <button
              type="button"
              aria-expanded={open === row.slot}
              aria-label={`${row.name}: ${row.total} points. Show round scores`}
              onClick={() => setOpen((current) => (current === row.slot ? null : row.slot))}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left ${
                row.slot === mySlot ? "bg-primary/10" : ""
              } ${row.status === "inactive" ? "opacity-40" : ""}`}
            >
              <span className="w-6 font-mono text-sm tabular-nums text-muted-foreground">
                {row.position}
              </span>
              <span className="flex-1 truncate font-display text-sm">{row.name}</span>
              <AnimatedScore
                value={row.total}
                from={0}
                durationMs={COUNT_UP_MS}
                quiet
                className="font-mono text-base font-bold tabular-nums"
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
                    <span className="uppercase tracking-widest text-muted-foreground">
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

      {/* Pinned above the chat bar so Play again and Leave never need a scroll. */}
      <div
        data-podium-actions
        className="sticky z-30 mt-auto flex flex-col gap-2 bg-background/95 pb-1 pt-2"
        style={{ bottom: `calc(${CHAT_BAR_HEIGHT + 8}px + env(safe-area-inset-bottom, 0px))` }}
      >
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
