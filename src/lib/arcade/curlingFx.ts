/**
 * Curl Champ's effects observer (the Sports overhaul, stage 2, 15 Nov 2026; display only). It watches the sim's states
 * frame by frame, as the sound observer does, and keeps what the renderer's effects need: where stones met, the stones a
 * takeout knocked away, each thrown stone's verdict when it comes to rest (counting, a near miss or neither), the broom
 * strokes laid on the ice while brushing, and the end's count. It never writes to a state, reads no clock but the one it
 * is given (the end's count runs on wall time, after the sim has stopped), and draws nothing (curlingFx.renderer.ts).
 *
 * The verdicts are the sim's own: a stone counts when its throw scored (`pts` > 0 at its settle, which on curlRev 4
 * already applies the rule that it must be nearer the button than every red in the house). A **near miss** is a stone in
 * play that scored nothing but would have scored had it come to rest NEAR_MISS_CM nearer the button: within that much of
 * the scoring edge (the house on curlRev 1–2, CORE_EDGE_V3 / CORE_EDGE_V4 on curlRev 3 / 4), and on curlRev 4 within that
 * much of beating the nearest red in the house (`curlShortBy`).
 */
import {
  CORE_EDGE_V3,
  CORE_EDGE_V4,
  CU,
  CURL_TRAVEL,
  IN_HOUSE,
  STONE_R,
  TEAM_MINE,
  TEAM_THEIRS,
  cm,
  curlCounts,
  curlDist,
  curlInHouse,
  curlTakeouts,
  type CurlingState,
} from "./curling";

/** A near miss: a stone that would have scored this many cm nearer the button. */
export const NEAR_MISS_CM = 25;
/** How long the in-play effects last (ticks): a contact ring, a stroke on the ice, a takeout, a verdict ring. */
export const CURL_FX_RING_TICKS = 36;
export const CURL_FX_STROKE_TICKS = 40;
export const CURL_FX_VERDICT_TICKS = 90;
/** The end: the house view's zoom (ms), then one counting stone lit every CURL_FX_LIGHT_MS (squeezed to fit the hold). */
export const CURL_FX_ZOOM_MS = 380;
export const CURL_FX_LIGHT_MS = 300;
/** The whole end sequence fits this hold (the stage holds the submit at most this long after the run ends). */
export const CURL_FX_END_HOLD_MS = 2200;

/** How long the stage holds an ended run (curlRev 4) so the end count plays out: the zoom, every light, a short rest. */
export function curlEndHoldMs(s: CurlingState): number {
  if (s.rev < 4) return 0;
  const n = curlEndCounting(s).length;
  if (n === 0) return CURL_FX_ZOOM_MS + 700;
  const room = CURL_FX_END_HOLD_MS - CURL_FX_ZOOM_MS - 200;
  const gap = Math.min(CURL_FX_LIGHT_MS, Math.floor(room / n));
  return Math.min(CURL_FX_END_HOLD_MS, CURL_FX_ZOOM_MS + (n - 1) * gap + 500);
}

export interface CurlContact {
  tick: number;
  /** The contact point (cm). */
  x: number;
  y: number;
}

export interface CurlStroke {
  tick: number;
  /** Where the stroke lies on the ice (cm), and which side of the stone it was brushed (−1 left, 1 right, 0 ahead). */
  x: number;
  y: number;
  side: number;
}

export interface CurlVerdict {
  tick: number;
  stone: number;
  kind: "count" | "near";
  /** Where it came to rest (cm). */
  x: number;
  y: number;
}

export interface CurlTakeout {
  tick: number;
  /** Where the red was when it left the house or play (cm). */
  x: number;
  y: number;
}

export interface CurlEnd {
  /** Wall time the run was seen to end (ms), and the counting stones to light, in throw order. */
  at: number;
  stones: { stone: number; x: number; y: number }[];
  /** The gap between lights (ms): CURL_FX_LIGHT_MS, squeezed so the last lights inside the hold. */
  gap: number;
}

/** cm a stone at rest would need to come nearer the button to score (0 when it scored; Infinity out of play). */
export function curlShortBy(s: Pick<CurlingState, "x" | "y" | "live" | "team" | "rev">, i: number): number {
  if (!s.live[i]) return Infinity;
  const d = curlDist(s.x[i]!, s.y[i]!) / CU;
  const edge = s.rev >= 4 ? CORE_EDGE_V4 : s.rev >= 3 ? CORE_EDGE_V3 : IN_HOUSE;
  let need = Math.max(0, d - edge);
  if (s.rev >= 4 && !curlCounts(s, i)) {
    // Nearer than the nearest red in the house (strictly).
    let red = Infinity;
    for (let j = 0; j < s.x.length; j++) {
      if (s.team[j] !== TEAM_THEIRS || !s.live[j] || !curlInHouse(s.x[j]!, s.y[j]!)) continue;
      red = Math.min(red, curlDist(s.x[j]!, s.y[j]!) / CU);
    }
    need = Math.max(need, d - red + 1);
  }
  return need;
}

/** The counting stones at the end, in throw order: your stones whose throw scored and that are still in play. */
export function curlEndCounting(s: CurlingState): { stone: number; x: number; y: number }[] {
  const out: { stone: number; x: number; y: number }[] = [];
  for (let k = 0; k < s.pts.length; k++) {
    const i = s.theirs + k;
    if ((s.pts[k] ?? 0) > 0 && s.live[i] && s.team[i] === TEAM_MINE) out.push({ stone: i, x: s.x[i]! / CU, y: s.y[i]! / CU });
  }
  return out;
}

/**
 * The contact point of a hit this tick: the midpoint of the nearest pair of stones that were in play (cm). A stone
 * knocked out of play on the very tick it was hit still counts (it was in play a tick before).
 */
function contactPoint(s: CurlingState, prev: CurlingState): { x: number; y: number } | null {
  let best = Infinity;
  let at: { x: number; y: number } | null = null;
  const inPlay = (i: number) => s.live[i] === 1 || prev.live[i] === 1;
  for (let i = 0; i < s.x.length; i++) {
    if (!inPlay(i)) continue;
    for (let j = i + 1; j < s.x.length; j++) {
      if (!inPlay(j)) continue;
      const dx = s.x[i]! - s.x[j]!;
      const dy = s.y[i]! - s.y[j]!;
      const d = dx * dx + dy * dy;
      if (d < best) {
        best = d;
        at = { x: (s.x[i]! + s.x[j]!) / 2 / CU, y: (s.y[i]! + s.y[j]!) / 2 / CU };
      }
    }
  }
  // Only a real touch (the nearest pair within a stone's width and a little of touching).
  return at && Math.sqrt(best) / CU <= STONE_R * 2 + 6 ? at : null;
}

export class CurlFxTracker {
  contacts: CurlContact[] = [];
  strokes: CurlStroke[] = [];
  verdicts: CurlVerdict[] = [];
  takeouts: CurlTakeout[] = [];
  end: CurlEnd | null = null;
  /**
   * The end's count ticks due this frame (the stage plays them, one `curling.countTick` a stone as it lights); the
   * in-play sounds (the clack, the crowd's "ooh" and "aw") come from the sound observer (gameSounds.ts curlingSounds).
   */
  cues: string[] = [];
  private prev: CurlingState | null = null;
  /** How many of the end's counting stones have lit (the tick's pitch steps with it). */
  lit = 0;

  reset(): void {
    this.contacts = [];
    this.strokes = [];
    this.verdicts = [];
    this.takeouts = [];
    this.end = null;
    this.cues = [];
    this.prev = null;
    this.lit = 0;
  }

  /** Observes the frame's state (and the wall clock, for the end's count only). */
  observe(s: CurlingState, nowMs: number): void {
    this.cues = [];
    const prev = this.prev;
    if (prev && (s.tick < prev.tick || s.seed !== prev.seed)) {
      this.reset();
      return this.observe(s, nowMs);
    }
    if (prev && s.tick > prev.tick) {
      if (s.hits > prev.hits) {
        const p = contactPoint(s, prev);
        if (p) this.contacts.push({ tick: s.tick, ...p });
      }
      if (s.phase === CURL_TRAVEL && s.active >= 0 && s.sweeps > prev.sweeps && s.live[s.active]) {
        const side = s.rev >= 2 ? Math.sign(s.bend) : 0;
        // Laid on the ice ahead of the stone, on the side brushed (curlRev 1: straight ahead).
        this.strokes.push({ tick: s.tick, x: s.x[s.active]! / CU + side * 22, y: s.y[s.active]! / CU - 55, side });
      }
      if (curlTakeouts(s) > curlTakeouts(prev)) {
        for (let i = 0; i < s.theirs; i++) {
          const wasIn = prev.live[i] && curlInHouse(prev.x[i]!, prev.y[i]!);
          const isIn = s.live[i] && curlInHouse(s.x[i]!, s.y[i]!);
          if (wasIn && !isIn) this.takeouts.push({ tick: s.tick, x: prev.x[i]! / CU, y: prev.y[i]! / CU });
        }
      }
      if (s.pts.length > prev.pts.length) {
        const i = s.theirs + s.pts.length - 1;
        const scored = (s.pts[s.pts.length - 1] ?? 0) > 0;
        if (scored) this.verdicts.push({ tick: s.tick, stone: i, kind: "count", x: s.x[i]! / CU, y: s.y[i]! / CU });
        else if (curlShortBy(s, i) <= NEAR_MISS_CM) {
          this.verdicts.push({ tick: s.tick, stone: i, kind: "near", x: s.x[i]! / CU, y: s.y[i]! / CU });
        }
      }
    }
    // Forget what has faded.
    const keep = s.tick - CURL_FX_VERDICT_TICKS;
    if (this.contacts.length && this.contacts[0]!.tick < keep) this.contacts = this.contacts.filter((c) => c.tick >= s.tick - CURL_FX_RING_TICKS);
    if (this.strokes.length && this.strokes[0]!.tick < s.tick - CURL_FX_STROKE_TICKS) this.strokes = this.strokes.filter((c) => c.tick >= s.tick - CURL_FX_STROKE_TICKS);
    if (this.takeouts.length && this.takeouts[0]!.tick < keep) this.takeouts = this.takeouts.filter((c) => c.tick >= keep);
    // The end: the counting stones, lit one by one on the wall clock (the sim has stopped).
    if (s.over && !this.end) {
      const stones = curlEndCounting(s);
      const room = CURL_FX_END_HOLD_MS - CURL_FX_ZOOM_MS - 200;
      this.end = { at: nowMs, stones, gap: stones.length > 0 ? Math.min(CURL_FX_LIGHT_MS, Math.floor(room / stones.length)) : CURL_FX_LIGHT_MS };
      this.lit = 0;
    }
    if (this.end) {
      const shown = curlEndLit(this.end, nowMs);
      while (this.lit < shown) {
        this.lit++;
        this.cues.push("curling.countTick");
      }
    }
    this.prev = s;
  }
}

/** How many of the end's counting stones are lit at `nowMs`. */
export function curlEndLit(end: CurlEnd, nowMs: number): number {
  const t = nowMs - end.at - CURL_FX_ZOOM_MS;
  if (t < 0) return 0;
  return Math.min(end.stones.length, 1 + Math.floor(t / end.gap));
}

/** The end zoom's progress 0…1 at `nowMs` (eased by the renderer). */
export function curlEndZoom(end: CurlEnd, nowMs: number): number {
  return Math.max(0, Math.min(1, (nowMs - end.at) / CURL_FX_ZOOM_MS));
}
