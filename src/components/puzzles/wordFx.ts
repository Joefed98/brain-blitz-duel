import { gameFx, type GameFxKind } from "@/lib/fx/kit";

import { wordCue } from "./wordFinish";

/**
 * The Word overhaul's effects (stage 2, 15 Nov 2026; docs/design/game-reviews/word.md, the effects kit
 * docs/design/game-fx/README.md). Presentation only: every effect animates a piece's own element through the kit
 * (transform and opacity, never a control's box or the arena), plays the kit's shared sound, and names the game's own
 * cue (`<game>.<event>`, docs/sound-cues/word-elevenlabs.md). Once Joe's recording for a cue is in, it plays from its
 * file and stands in for the kit's shared sound that moment (NEW_GAME_SOUND_REPLACES); until then the shared sound
 * plays as before. Nothing here reads or writes an answer, a grade, a score or the clock.
 */

/** A kit effect on an element (or none: sound and haptic only) plus the game's own cue. */
export function wordFx(
  kind: GameFxKind,
  el: Element | null | undefined,
  cue: string | null,
  options: Parameters<typeof gameFx>[2] = {},
): Animation | null | undefined {
  const animation = gameFx(kind, (el as HTMLElement | null | undefined) ?? null, options);
  if (cue) wordCue(cue);
  return animation;
}

/** A rising run of cues (`<game>.trace1` … `<game>.trace9`): the n-th, held to the run's ends. */
export function stepCue(cues: readonly string[], n: number): string {
  return cues[Math.max(0, Math.min(cues.length - 1, n))]!;
}

/**
 * FLIP: `el` has just been laid out at its new place; it slides there from `from` (a box measured before the change).
 * The kit's slide, on the element's own transform.
 */
export function flyFrom(el: Element | null | undefined, from: DOMRect | null | undefined, cue: string | null = null): void {
  if (!el || !from) return;
  const to = el.getBoundingClientRect();
  wordFx("slide", el, cue, { from: { x: from.left + from.width / 2 - (to.left + to.width / 2), y: from.top + from.height / 2 - (to.top + to.height / 2) }, silent: !!cue });
}

/** Runs `step(i)` for each of `n` items, `gapMs` apart (a ripple, a flip one after another); returns a cancel. */
export function stagger(n: number, gapMs: number, step: (i: number) => void): () => void {
  const timers: ReturnType<typeof setTimeout>[] = [];
  for (let i = 0; i < n; i++) timers.push(setTimeout(() => step(i), i * gapMs));
  return () => timers.forEach(clearTimeout);
}

/** "Three within 10 s": records a success and answers how many sit inside the window (a combo from `need`). */
export function comboWindow(times: number[], now: number, windowMs = 10_000): number {
  times.push(now);
  while (times.length > 0 && now - times[0]! > windowMs) times.shift();
  return times.length;
}

/**
 * A game's own cue for an effect moment (a letter traced, a word made, a key pressed) with no kit effect of its own; the
 * finish cues go through wordCue (wordFinish.ts). The same dispatch: Joe's recording once it is in, else nothing extra.
 */
export function effectCue(cue: string): void {
  wordCue(cue);
}
