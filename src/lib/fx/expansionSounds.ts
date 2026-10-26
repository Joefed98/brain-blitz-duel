/**
 * Sounds for the E2 expansion's skill features (Meteor snakeRev 9, Tempo beatRev 9;
 * docs/expansions/e2.md). No new recordings: each moment plays one of the existing sounds (the
 * celebrations' zap, spark chime, meter crackles and count ding, and the UI tick) through
 * playCueSlot, so mute, the Effects slider, intro-demo hush and each slot's play caps all apply.
 *
 * A watcher keeps the counters it last saw and plays a sound when one rises (a rewind or a new run
 * resets it silently). Presentation only: it reads sim state and never writes it.
 */
import { playCueSlot } from "@/lib/sound";

export type ExpansionSound = "zap" | "chime" | "crackle" | "ding" | "tick";

const SLOTS: Record<Exclude<ExpansionSound, "crackle">, string> = {
  zap: "shared.celebrate.zap",
  chime: "shared.celebrate.chime",
  ding: "shared.celebrate.countDing",
  tick: "tick",
};
const CRACKLES = ["shared.celebrate.crackle1", "shared.celebrate.crackle2", "shared.celebrate.crackle3"] as const;

/** Plays one expansion sound (quietly for the frequent ones). */
export function playExpansionSound(sound: ExpansionSound, n = 0, volume = 1): void {
  if (sound === "crackle") playCueSlot(CRACKLES[n % CRACKLES.length]!, volume * 0.8, 1 + Math.min(4, n) * 0.06);
  else playCueSlot(SLOTS[sound], volume);
}

/** One watched counter: its value in the state, and the sound to play when it rises. */
export interface ExpansionWatch<S> {
  count: (s: S) => number;
  sound: ExpansionSound;
  volume?: number;
}

/** Watches counters frame by frame; `live` false (a lock-in, the run over) still tracks, silently. */
export function expansionSounds<S extends { tick: number }>(watches: readonly ExpansionWatch<S>[]): (state: S, live: boolean) => void {
  let last: number[] | null = null;
  let tick = -1;
  return (state, live) => {
    const now = watches.map((w) => w.count(state));
    if (last && state.tick >= tick && live)
      watches.forEach((w, i) => {
        if (now[i]! > last![i]!) playExpansionSound(w.sound, now[i]!, w.volume ?? 1);
      });
    last = now;
    tick = state.tick;
  };
}
