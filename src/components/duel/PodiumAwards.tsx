import { useEffect, useRef } from "react";

import { arcadeReducedEffects } from "@/lib/fx/lowEnd";
import { soundCue } from "@/lib/fx/soundCues";
import { prefersReducedMotion } from "@/lib/motion";
import type { PlayerLooks } from "@/lib/duel/playerLook";
import type { PodiumAward } from "@/lib/duel/podiumAwards";

import { PlayerBadge } from "./PlayerBadge";

/** The first card appears once the podium totals have counted up (Podium's COUNT_UP_MS). */
const FIRST_MS = 1300;
const STAGGER_MS = 220;

/**
 * The final screen's awards (podiumAwards.ts): a title, the player's badge and name, and one line
 * saying why. Cards rise in one after another with the `room.award` cue on the first; with reduced
 * motion or reduced effects they show in place, silently.
 */
export function PodiumAwards({
  awards,
  looks,
  names,
  mySlot,
}: {
  awards: PodiumAward[];
  looks: PlayerLooks;
  names: ReadonlyMap<number, string>;
  mySlot: number;
}) {
  const cued = useRef(false);
  const calm = useRef<boolean | null>(null);
  if (calm.current === null) calm.current = prefersReducedMotion() || arcadeReducedEffects();

  useEffect(() => {
    if (cued.current || !awards.length || calm.current) return;
    cued.current = true;
    const timer = window.setTimeout(() => soundCue("room.award"), FIRST_MS);
    return () => window.clearTimeout(timer);
  }, [awards.length]);

  if (!awards.length) return null;
  return (
    <section data-podium-awards aria-label="Awards" className="flex flex-col gap-1.5">
      <p className="text-center text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Awards</p>
      <ul className="grid grid-cols-2 gap-1.5">
        {awards.map((award, index) => {
          const name = names.get(award.slot) ?? "Player";
          return (
            <li
              key={award.id}
              data-award={award.id}
              className={`flex min-w-0 items-start gap-2 rounded-xl border px-2.5 py-2 ${
                award.slot === mySlot ? "border-primary/70 bg-primary/10" : "border-border bg-card"
              } ${awards.length % 2 === 1 && index === awards.length - 1 ? "col-span-2" : ""} ${
                calm.current ? "" : "podium-award-in"
              }`}
              style={calm.current ? undefined : { animationDelay: `${FIRST_MS + index * STAGGER_MS}ms` }}
            >
              <PlayerBadge look={looks.get(award.slot)} name={name} size={28} className="mt-0.5" />
              <span className="min-w-0 flex-1 text-left">
                <span className="block font-display text-[11px] font-bold uppercase tracking-wide text-primary">
                  {award.title}
                </span>
                <span className="block truncate font-display text-sm text-foreground">{name}</span>
                <span className="line-clamp-2 text-[11px] leading-tight text-foreground/75">{award.line}</span>
              </span>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
