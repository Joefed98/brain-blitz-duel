import { useEffect, useRef } from "react";

import { MAX_PLAYERS } from "@/lib/duel/types";
import { celebrationSound, meterFill, meterLabel, sparkBurstOn } from "@/lib/fx/celebrations";

import { useCelebrationScope } from "./useCelebration";

/** The fill's ease into a new value (polish-layout/celebrations.css `.charge-meter-fill`). */
const FILL_MS = 520;

/**
 * The lobby's charge meter (Prompt P, 23 Oct 2026; celebrations only): a slim gold bar under the
 * player list, filled players / MAX_PLAYERS, "{n} of 10 players" beside it. Its height is fixed
 * (20 px), so it is there from the first frame and nothing below it moves. A join eases the fill
 * up with a soft crackle; the room filling up sparks once along the bar. Display only.
 */
export function ChargeMeter({ players }: { players: number }) {
  const scope = useCelebrationScope();
  const track = useRef<HTMLDivElement>(null);
  const previous = useRef<number | null>(null);

  useEffect(() => {
    const before = previous.current;
    previous.current = players;
    if (before === null || players <= before) return;
    celebrationSound("crackle");
    if (players < MAX_PLAYERS) return;
    const timer = window.setTimeout(() => {
      sparkBurstOn(scope, track.current, { row: true, count: 60 });
      celebrationSound("chime");
    }, FILL_MS);
    return () => window.clearTimeout(timer);
  }, [players, scope]);

  return (
    <div data-charge-meter={players} className="charge-meter" aria-hidden="true">
      <div ref={track} className="charge-meter-track">
        <div className="charge-meter-fill" style={{ transform: `scaleX(${meterFill(players)})` }} />
      </div>
      <span className="charge-meter-label">{meterLabel(players)}</span>
    </div>
  );
}
