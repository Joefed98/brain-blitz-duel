/**
 * The room's equipped celebrations on the final screen (wave 2 E2; docs/art/wave-2 "Celebrations"): the winner's win
 * celebration, and the podium entrance (Circuit Overload) of any top-three player who equipped one, each drawn from
 * its approved scene with that player's own avatar and place. Everyone sees each player's own choice (their public
 * cosmetics); with none equipped this renders nothing, so the screen is exactly as before.
 *
 * Short and out of the way: a strip of its own under the heading (never over a score, place or name), playing for
 * CELEBRATION_PLAY_MS and then resting on its still; never delaying anything (the screen's timers and actions are
 * untouched). Under prefers-reduced-motion it is the still from the first frame (the sources' own rules).
 */
import { useEffect, useId, useMemo, useState } from "react";

import { avatarKey, avatarMarkup, celebrationScene, ensureCosmeticStyles } from "@/design/identity";
import { CELEBRATIONS } from "@/design/identity/cosmeticsArt.data";
import type { PublicCosmetics } from "@/lib/cosmetics/types";
import { ordinal } from "@/lib/duel/ordinal";

/** How long a celebration plays before it rests on its still. */
export const CELEBRATION_PLAY_MS = 3000;
/** At most this many scenes on one screen. */
const MAX_SCENES = 3;

export interface CelebrationEntry {
  slot: number;
  place: number;
  name: string;
  cosmetics: Omit<PublicCosmetics, "userId">;
}

/** The scenes a final screen shows: winners' win celebrations first, then the top three's entrances, at most three. */
export function celebrationScenes(entries: readonly CelebrationEntry[]): { slot: number; place: number; name: string; item: string; kind: "win" | "entrance"; cosmetics: CelebrationEntry["cosmetics"] }[] {
  const wins = entries
    .filter((e) => e.place === 1 && e.cosmetics.celebration && CELEBRATIONS[e.cosmetics.celebration])
    .map((e) => ({ ...e, item: e.cosmetics.celebration!, kind: "win" as const }));
  const entrances = entries
    .filter((e) => e.place <= 3 && e.cosmetics.entrance && CELEBRATIONS[e.cosmetics.entrance])
    .sort((a, b) => a.place - b.place || a.slot - b.slot)
    .map((e) => ({ ...e, item: e.cosmetics.entrance!, kind: "entrance" as const }));
  return [...wins, ...entrances].slice(0, MAX_SCENES);
}

function Scene({ item, place, name, cosmetics }: { item: string; place: number; name: string; cosmetics: CelebrationEntry["cosmetics"] }) {
  const prefix = `ce${useId().replace(/[^a-zA-Z0-9_-]/g, "")}-`;
  const look = cosmetics.avatar
    ? { ...cosmetics.avatar, finish: cosmetics.finish, accessory: cosmetics.accessory, special: cosmetics.special }
    : null;
  const lookKey = look ? avatarKey(look) : "";
  // One { __html } per scene (CLAUDE.md working rule 6).
  const html = useMemo(
    () => ({ __html: celebrationScene(item, prefix, look ? avatarMarkup(look, `${prefix}v-`) : null, ordinal(place)) ?? "" }),
    [item, prefix, lookKey, place], // eslint-disable-line react-hooks/exhaustive-deps
  );
  return (
    <figure className="jz-celebration" data-celebration={item}>
      <span className="jz-celebration-art" dangerouslySetInnerHTML={html} />
      <figcaption className="jz-celebration-name">{name}</figcaption>
    </figure>
  );
}

export function PodiumCelebrations({ entries }: { entries: readonly CelebrationEntry[] }) {
  const scenes = celebrationScenes(entries);
  const [rest, setRest] = useState(false);
  useEffect(() => {
    if (!scenes.length) return;
    const timer = window.setTimeout(() => setRest(true), CELEBRATION_PLAY_MS);
    return () => window.clearTimeout(timer);
  }, [scenes.length]);
  if (!scenes.length) return null;
  ensureCosmeticStyles();
  return (
    <div className="jzc jz-celebrations" aria-hidden="true" data-podium-celebrations={scenes.length} data-rest={rest ? "" : undefined}>
      {scenes.map((s) => (
        <Scene key={`${s.kind}-${s.slot}`} item={s.item} place={s.place} name={s.name} cosmetics={s.cosmetics} />
      ))}
    </div>
  );
}
