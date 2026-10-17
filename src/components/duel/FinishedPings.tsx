import { useEffect, useRef, useState } from "react";

import { finishedThisRound, newFinishers, pingText, PING_SHOW_MS, type FinishedPing } from "@/lib/duel/finishedPings";
import type { PlayerLooks } from "@/lib/duel/playerLook";
import type { DuelPlayerRow } from "@/lib/duel/types";

import { PlayerBadge } from "./PlayerBadge";

/**
 * The pings to show now for a room round (finishedPings.ts): new finishers appear, players who
 * finish while a ping is up join it, and it clears PING_SHOW_MS after the last one joined.
 * `roundKey` names the round (a new key starts afresh); `active` is false outside the live round.
 */
export function useFinishedPings(
  players: readonly DuelPlayerRow[],
  round: number,
  mySlot: number,
  active: boolean,
  roundKey: string,
): FinishedPing[] {
  const [shown, setShown] = useState<FinishedPing[]>([]);
  const announced = useRef<{ key: string; slots: Set<number> }>({ key: "", slots: new Set() });
  const timer = useRef<number | undefined>(undefined);
  const fresh = finishedThisRound(players, round, mySlot);
  const signature = fresh.map((p) => `${p.slot}:${p.name}`).join("|");

  useEffect(() => {
    if (announced.current.key !== roundKey) {
      announced.current = { key: roundKey, slots: new Set() };
      window.clearTimeout(timer.current);
      setShown([]);
    }
    if (!active) return;
    const next = newFinishers(fresh, announced.current.slots);
    if (!next.length) return;
    for (const p of next) announced.current.slots.add(p.slot);
    setShown((current) => [...current, ...next]);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setShown([]), PING_SHOW_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, active, roundKey]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return active ? shown : [];
}

/**
 * The slim "Sam finished ✓" strip, laid over a header area it is given (absolute, never moving
 * anything): the room's score strip on puzzle screens, the arcade header's score and round label on
 * arcade play screens; never the play area, the timer or any control. Badges are the players' own
 * colours and icons (PlayerBadge), always beside their names. Silent; display only.
 */
export function FinishedPingStrip({ pings, looks, lines = 1 }: { pings: readonly FinishedPing[]; looks: PlayerLooks; lines?: 1 | 2 }) {
  if (!pings.length) return null;
  return (
    <div
      data-finished-ping={pings.map((p) => p.slot).join(",")}
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-20 flex min-w-0 items-center gap-1.5 rounded-full border border-border bg-card px-1.5 animate-fade-in"
    >
      <span className="flex shrink-0 items-center -space-x-1.5">
        {pings.slice(0, 3).map((p) => (
          <PlayerBadge key={p.slot} look={looks.get(p.slot)} name={p.name} size={18} className="ring-2 ring-card" />
        ))}
      </span>
      <span
        className={`min-w-0 font-display text-xs font-semibold leading-tight text-foreground ${lines === 1 ? "truncate" : "line-clamp-2 break-words"}`}
      >
        {pingText(pings)} <span className="text-primary">✓</span>
      </span>
    </div>
  );
}
