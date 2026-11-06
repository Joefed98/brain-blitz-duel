/**
 * Live sound cues for the shared arcade success effects (docs/sound-cues/arcade-effects.md).
 *
 * The shared success layer (arcadeFxGames.renderer.ts) draws a pop, banner, burst or
 * clear when a counter the sim keeps rises. Replays already name those moments
 * (src/lib/replay/moments.ts); here the same counters, read with the same firing
 * rule, dispatch a named `duelz-sound` cue on the frame the effect starts in live
 * play. Moments that already have a sound at that frame (an arcade moment in
 * gameSounds.ts, the stage's own sound) get no row.
 *
 * `replaces` keeps two sounds from stacking: once the new cue's slot has a file, the
 * listed sounds are left out on that frame only (an arcade moment slot such as
 * `hover.gate`, another new cue, or the generic `complete` / `combo` / `correct`).
 * Without a file nothing is left out, so today's sounds are unchanged.
 *
 * Presentation only: reads sim state, never writes it; never imported by a sim.
 */
import type { Counter } from "@/lib/replay/moments";
import { counterFired, momentCounters } from "@/lib/replay/moments";
import { cueHasFile, demoHushed } from "@/lib/sound";
import { soundCue } from "./soundCues";

export interface MomentCue {
  game: string;
  /** The moment id in MOMENT_TABLE (src/lib/replay/moments.ts). */
  moment: string;
  /** `<gameId>.<event>`; never a replay cue name (those are `<gameId>.<moment-id>`). */
  cue: string;
  /** Sounds left out on this frame once `cue` has a file. */
  replaces?: readonly string[];
  /** At most one per this many ms. */
  gapMs?: number;
  /**
   * Only on states this is true for: two rows on one moment can then sound it differently by the run's look
   * (Grappler's jungle canopy, swingRev 17, has its own gate sound; every earlier revision keeps the zap).
   */
  when?: (state: Record<string, unknown>) => boolean;
}

const row = (game: string, moment: string, cue: string, replaces: readonly string[] = [], gapMs?: number, when?: (state: Record<string, unknown>) => boolean): MomentCue => ({
  game,
  moment,
  cue,
  replaces,
  ...(gapMs !== undefined ? { gapMs } : {}),
  ...(when ? { when } : {}),
});

/** Every shared success effect that had no sound of its own at the frame it starts. */
export const MOMENT_CUES: readonly MomentCue[] = [
  row("hover", "zone", "hover.newZone", ["hover.gate"]),
  row("hover", "two-gap", "hover.twoGap", ["hover.gate"]),
  row("hover", "slipped-through", "hover.slippedThrough", ["hover.gate", "hover.twoGap"]),
  row("hover", "all-barriers", "hover.allBarriers", ["hover.gate", "hover.newZone", "hover.twoGap", "hover.slippedThrough", "complete"]),
  row("breaker", "bricks", "breaker.bricksStreak", ["breaker.brickHit", "breaker.brickBreak"]),
  row("breaker", "moving-target", "breaker.movingTarget", ["breaker.brickHit", "breaker.brickBreak"], 120),
  row("breaker", "row-clear", "breaker.rowClear", ["breaker.brickHit", "breaker.brickBreak", "breaker.bricksStreak", "breaker.movingTarget"]),
  row("breaker", "wall-cleared", "breaker.wallCleared", ["breaker.brickHit", "breaker.brickBreak", "breaker.bricksStreak", "breaker.movingTarget", "breaker.rowClear", "complete"]),
  row("pinball", "spinner", "pinball.spinnerRip", ["pinball.spinner"]),
  row("rally", "long-rally", "rally.longRally", ["rally.hit"]),
  row("rally", "target", "rally.targetHit"),
  row("rally", "bumper", "rally.bumperBounce", [], 150),
  row("beat", "combo", "beat.comboTen", ["combo"]),
  row("beat", "swipe", "beat.swipeHit", ["beat.note"]),
  row("beat", "full-combo", "beat.fullCombo", ["complete"]),
  row("snake", "stars", "snake.starsStreak", ["snake.eat"]),
  row("snake", "shower-dodged", "snake.showerDodged", ["snake.rockLand"]),
  row("snake", "all-eaten", "snake.allEaten", ["snake.eat", "snake.starsStreak", "complete"]),
  row("burst", "wave-cleared", "burst.waveCleared", ["burst.hit"]),
  row("burst", "last-life-wave", "burst.lastLifeWave", ["burst.hit", "burst.waveCleared"]),
  row("burst", "flawless", "burst.flawlessFinish", ["complete"]),
  row("wavefront", "saucer", "wavefront.saucerDown", ["wavefront.bigExplode", "wavefront.shapePop"]),
  row("wavefront", "wave-cleared", "wavefront.waveCleared", ["wavefront.formation", "wavefront.bigExplode", "wavefront.shapePop"]),
  row("wavefront", "diver-down", "wavefront.diverDown", ["wavefront.bigExplode", "wavefront.shapePop"], 150),
  row("wavefront", "boss-hits", "wavefront.bossStreak", ["wavefront.bossHit"]),
  row("wavefront", "boss-down", "wavefront.bossDown", ["wavefront.bigExplode", "wavefront.shapePop", "wavefront.waveCleared", "complete"]),
  row("orbit", "planets", "orbit.planetsStreak", ["orbit.planetCaught", "orbit.shootingStar"]),
  row("orbit", "all-planets", "orbit.allPlanets", ["orbit.planetCaught", "orbit.planetsStreak", "orbit.shootingStar", "complete"]),
  row("orbit", "black-hole", "orbit.blackHole", ["orbit.planetCaught"]),
  row("skyline", "floors", "skyline.floorsStreak", ["skyline.drop"]),
  row("skyline", "wind-flag", "skyline.windFlag", ["skyline.drop"]),
  row("skyline", "wind-perfect", "skyline.windPerfect", ["skyline.perfect"]),
  row("cross", "bikes", "cross.pastBikes", ["cross.hop"]),
  row("cross", "cones", "cross.pastRoadworks", ["cross.hop"]),
  row("inkbridge", "gold-star", "inkbridge.goldStar"),
  row("inkbridge", "all-levels", "inkbridge.allLevels", ["inkbridge.pot", "complete"]),
  row("inkbridge", "trick-shot", "inkbridge.trickShot", ["inkbridge.pot"]),
  row("slice", "sliced", "slice.slicedStreak", ["slice.cut"]),
  row("slice", "mayo", "slice.mayoSqueeze", ["slice.cut"]),
  row("slice", "many-in-one", "slice.manyInOne", ["slice.cut", "slice.slicedStreak"]),
  row("bintoss", "in-a-row", "bintoss.inARow", ["bintoss.basket"]),
  row("bintoss", "hoop", "bintoss.hoopSwish", ["bintoss.basket", "bintoss.inARow"]),
  row("bintoss", "spinner", "bintoss.spinnerBasket", ["bintoss.basket", "bintoss.inARow"]),
  row("bullseye", "inner-bull", "bullseye.innerBull", ["bullseye.bull"]),
  row("bullseye", "balloon", "bullseye.balloonPop", ["bullseye.thud"]),
  row("bullseye", "bulls-in-a-row", "bullseye.bullsRow", ["bullseye.bull"]),
  row("bullseye", "all-on-target", "bullseye.allOnTarget", ["bullseye.thud", "complete"]),
  row("bubble", "big-pop", "bubble.bigPop", ["bubble.pop"]),
  row("bubble", "big-drop", "bubble.bigDrop", ["bubble.pop"]),
  row("bubble", "reef-cleared", "bubble.reefCleared", ["bubble.pop", "bubble.bigPop", "bubble.bigDrop", "complete"]),
  row("ricochet", "height", "ricochet.heightStreak"),
  row("ricochet", "full-height", "ricochet.fullHeight", ["complete"]),
  row("flip", "seconds", "flip.surviveStreak"),
  row("flip", "survived", "flip.survivedFinish", ["complete"]),
  row("flip", "star", "flip.starTaken"),
  row("flip", "all-stars", "flip.allStars", ["flip.starTaken"]),
  row("flip", "just-in-time", "flip.justInTime"),
  row("flip", "trail-star", "flip.trailStar", [], 40),
  row("flip", "star-trail", "flip.trailDone", ["flip.trailStar"]),
  row("flip", "double-flip", "flip.doubleFlip", ["combo"]),
  row("flip", "checkpoint", "flip.checkpointPassed"),
  row("flip", "saved", "flip.crashSaved"),
  row("flip", "speed-zone", "flip.speedZone"),
  row("flip", "sweet-spot", "flip.sweetLanding"),
  row("swing", "distance", "swing.distanceStreak"),
  row("swing", "over-lava", "swing.overLava"),
  row("swing", "finish", "swing.finishLine", ["complete"]),
  row("swing", "gem", "swing.gemTaken", [], 120),
  row("swing", "speed-gate", "swing.gateLit"),
  row("swing", "ledge", "swing.ledgeLanded"),
  row("swing", "combo", "swing.comboPoint", ["combo"]),
  row("swing", "section", "swing.sectionClear"),
  row("swing", "par", "swing.parBeaten", ["swing.sectionClear"]),
  // Swing's jungle canopy (swingRev 17, `slide`) lights its gates with Joe's own sound; every earlier course keeps the zap.
  row("swing", "gate14", "swing.assaultGate", [], undefined, (s) => !s["slide"]),
  row("swing", "gate14", "swing.gate", [], undefined, (s) => !!s["slide"]),
  row("swing", "gem14", "swing.assaultGem", [], 120),
  row("swing", "star14", "swing.assaultStar", [], 120),
  row("swing", "clear14", "swing.assaultClear"),
  row("swing", "course14", "swing.assaultCourse", ["complete"]),
  row("snip", "all-apples", "snip.allApples", ["snip.basket", "complete"]),
  row("tilt", "all-mazes", "tilt.allMazes", ["tilt.mazeDone", "complete"]),
  row("balltrack", "home", "balltrack.homeStreak", ["balltrack.marbleHome"]),
  row("balltrack", "all-home", "balltrack.allHome", ["balltrack.marbleHome", "balltrack.homeStreak", "complete"]),
  row("balltrack", "turned-home", "balltrack.turnedHome", ["balltrack.marbleHome"]),
  row("balltrack", "switched-home", "balltrack.switchedHome", ["balltrack.marbleHome"]),
  // Gemstone's gem chimes play later, as the shatter animation reaches each step: no overlap.
  row("matchup", "line-of-five", "matchup.lineOfFive"),
  row("matchup", "jackpot-gem", "matchup.jackpotMade"),
  row("matchup", "par-smashed", "matchup.parSmashed"),
  row("wordfall", "long-word", "wordfall.longWord", ["correct"]),
  row("wordfall", "par", "wordfall.parReached"),
  row("whack", "bonks", "whack.bonkStreak", ["correct"]),
  row("whack", "clean-twenty", "whack.cleanTwenty", ["correct", "whack.bonkStreak"]),
  row("clayshoot", "clays", "clayshoot.claysStreak", ["clayshoot.shatter"]),
  row("clayshoot", "double", "clayshoot.doubleHit", ["clayshoot.shatter", "clayshoot.claysStreak"]),
  row("stroop", "sorted", "stroop.sortedStreak", ["stroop.right"]),
];

interface Watch {
  counters: { counter: Counter; cue: MomentCue }[];
  variant: "orbit3" | undefined;
  prev: { tick: number } | null;
  last: object | null;
  quiet: ReadonlySet<string>;
}

const EMPTY: ReadonlySet<string> = new Set();
const watches = new Map<string, Watch>();
const lastAt = new Map<string, number>();

function variantOf(game: string, state: object): "orbit3" | undefined {
  return game === "orbit" && (state as { rev?: number }).rev === 3 ? "orbit3" : undefined;
}

function watchFor(game: string, variant: "orbit3" | undefined): Watch {
  const existing = watches.get(game);
  if (existing && existing.variant === variant) return existing;
  const rows = MOMENT_CUES.filter((c) => c.game === game);
  const counters = momentCounters(game, variant).flatMap((counter) =>
    rows.filter((r) => r.moment === counter.row.id).map((cue) => ({ counter, cue })),
  );
  const watch: Watch = { counters, variant, prev: null, last: null, quiet: EMPTY };
  watches.set(game, watch);
  return watch;
}

/**
 * Call once per drawn frame (any number of callers may: the result is memoised on the
 * state object). Dispatches the cues whose effect starts on this frame and returns the
 * sounds to leave out on it. A rewind (new run) starts over without firing.
 */
export function momentFrame(game: string, state: { tick: number }): ReadonlySet<string> {
  const watch = watchFor(game, variantOf(game, state));
  if (watch.last === state) return watch.quiet;
  const prev = watch.prev;
  watch.last = state;
  watch.prev = state;
  watch.quiet = EMPTY;
  if (!prev || state.tick <= prev.tick || watch.counters.length === 0) return EMPTY;
  const fired = watch.counters
    .filter(({ counter, cue }) => (!cue.when || cue.when(state)) && counterFired(counter, prev, state))
    .map(({ cue }) => cue);
  if (fired.length === 0) return EMPTY;
  const quiet = new Set<string>();
  for (const cue of fired) if (cueHasFile(cue.cue)) for (const r of cue.replaces ?? []) quiet.add(r);
  watch.quiet = quiet;
  if (demoHushed()) return quiet;
  const now = typeof performance === "undefined" ? 0 : performance.now();
  for (const cue of fired) {
    if (quiet.has(cue.cue)) continue;
    if (cue.gapMs !== undefined && now - (lastAt.get(cue.cue) ?? -Infinity) < cue.gapMs) continue;
    lastAt.set(cue.cue, now);
    soundCue(cue.cue);
  }
  return quiet;
}

const liveAt = new Map<string, number>();
/**
 * A renderer or stage effect with no arcade moment of its own (docs/sound-cues/arcade-effects.md):
 * dispatches its named cue (silent until the slot has a file), never during an intro demo, at most
 * one per `gapMs`.
 */
export function liveCue(cue: string, gapMs = 0, rate?: number): void {
  if (demoHushed()) return;
  if (gapMs > 0) {
    const now = typeof performance === "undefined" ? 0 : performance.now();
    if (now - (liveAt.get(cue) ?? -Infinity) < gapMs) return;
    liveAt.set(cue, now);
  }
  soundCue(cue, rate);
}
