/**
 * Hover's proof player (D5, 23 Nov 2026; the ladder brief's proof): the flawless player of
 * scripts/arcade-skill-bands/bots/hoverFlawless.ts HELD TO JOE'S HUMAN LIMITS (HUMAN_LIMITS: about 0.25 s to react and
 * 0.15 s to move). Script only (floats are fine: the output is a tap log the sim replays, and only the server's grade
 * of that log counts).
 *
 * What holds it to the limits:
 *  - taps at least PROOF_TAP_GAP ticks apart (0.15 s; the flawless bot's 0.1 s is faster than a finger);
 *  - it plans only from what was on the screen PROOF_LAG ticks ago (0.25 s): a barrier, a gold star, a chain star or a
 *    tight gate counts only once it had scrolled into view (the world's right edge) a reaction time earlier, so no tap
 *    answers anything sooner than 0.25 s after it appeared; nothing beyond that edge is known (no aim at an unseen gap,
 *    no plan through a chain or gate still off screen). Its own saucer it knows exactly (the flight after a tap is
 *    fixed), and a sliding gap's steady slide is read from its motion.
 * Otherwise it is the flawless player: every few ticks (REPLAN), and at once whenever something new becomes known, it
 * searches the tap sequences over what it knows for
 * the line through every barrier taking the most of what is in view (gold stars, chain stars, tight gates on their
 * centre line), and plays that plan exactly.
 *
 *   bun scripts/hover-proof-player.ts <rev> <level> [seed…]     (plays and prints the server's grade)
 */
import {
  HOVER_CENTRE_TOL,
  HOVER_DISC_R,
  HOVER_DISC_X,
  HOVER_GRAVITY,
  HOVER_IMPULSE,
  HOVER_PILLAR_W,
  HOVER_STAR_R,
  HOVER_TERMINAL,
  HOVER_WORLD_W,
  hoverBottom,
  hoverCentreY,
  hoverGapTop,
  hoverScrollOf,
  hoverStarY,
  type HoverState,
} from "../src/lib/arcade/hover";
import type { ArcadeGame } from "../src/lib/arcade/engine";
import { HUMAN_LIMITS } from "./arcade-skill-bands/human";

const FP = 256;
const TICK_MS = 1000 / 60;
/** Taps at least this many ticks apart: Joe's 0.15 s to move (9 ticks). */
export const PROOF_TAP_GAP = Math.ceil(HUMAN_LIMITS.moveMs / TICK_MS);
/** Nothing is known until it has been on screen this many ticks: Joe's 0.25 s to react (15 ticks). */
export const PROOF_LAG = Math.ceil(HUMAN_LIMITS.reactMs / TICK_MS);
/** Ticks between re-plans. */
const REPLAN = 6;
/** States the plan's search keeps a tick (the flawless bot's 6,000 finds no better line with the limits on, and is slower). */
export const PROOF_BEAM = 1000;
const clampV = (v: number) => Math.max(-HOVER_TERMINAL, Math.min(HOVER_TERMINAL, v));
/** A flap's climb (fixed-point) and the ticks from the tap to its top. */
const [ARC, APEX_TICKS] = (() => {
  let v = HOVER_IMPULSE;
  let y = 0;
  let best = 0;
  let at = 0;
  for (let k = 0; k < 60; k++) {
    if (k > 0) v = clampV(v + HOVER_GRAVITY);
    y += v;
    if (y < best) {
      best = y;
      at = k;
    }
  }
  return [-best, at];
})();

interface Item {
  x0: number;
  y: (t: number) => number;
  r: number;
  from: number;
  to: number;
  w: number;
}

/** The distance after each tick from `s`, passing barriers as the sim does (a line that never crashes). */
function timeline(s: HoverState, ticks: number): number[] {
  const out = [s.distance];
  let d = s.distance;
  let g = s.gates;
  for (let k = 1; k <= ticks; k++) {
    d += hoverScrollOf(s, g);
    while (g < s.pillars.length && d > s.pillars[g]!.x0 + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R)) g++;
    out.push(d);
  }
  return out;
}

/**
 * Plans taps from `s` with what is known (everything left of world x `known`, fixed-point); returns absolute tap
 * ticks (may be empty) or null when no line survives.
 */
export function planProof(s: HoverState, lastTap: number, known: number, beamWidth: number): number[] | null {
  const dist = timeline(s, 220);
  const bottom = hoverBottom(s);
  const t0 = s.tick;
  const knownPillar = (p: { x0: number }) => p.x0 < known;
  // The horizon: while the saucer's front stays in known space (nothing unseen can be hit before it).
  let H = 0;
  while (H < 219 && dist[H + 1]! + HOVER_DISC_X + HOVER_DISC_R < known) H++;
  H = Math.max(1, H);
  type Band = { ranges: [number, number][]; tight: [number, number] | null; centre: number | null };
  const bands: (Band | null)[] = new Array(220).fill(null);
  for (let k = 1; k < 220; k++) {
    const d = dist[k]!;
    for (const p of s.pillars) {
      if (!knownPillar(p)) continue;
      const left = p.x0 - d;
      if (!(left + HOVER_PILLAR_W > HOVER_DISC_X - HOVER_DISC_R && left < HOVER_DISC_X + HOVER_DISC_R)) continue;
      const ranges: [number, number][] = [[hoverGapTop(p, t0 + k) + HOVER_DISC_R, hoverGapTop(p, t0 + k) + p.gapH - HOVER_DISC_R]];
      if (p.gap2Top !== undefined) ranges.push([p.gap2Top + HOVER_DISC_R, p.gap2Top + (p.gap2H ?? 0) - HOVER_DISC_R]);
      let tight: [number, number] | null = null;
      let centre: number | null = null;
      if (p.tightTop !== undefined) {
        tight = [p.tightTop + HOVER_DISC_R, p.tightTop + (p.tightH ?? 0) - HOVER_DISC_R];
        if (left <= HOVER_DISC_X && HOVER_DISC_X <= left + HOVER_PILLAR_W) centre = hoverCentreY(p);
      }
      bands[k] = { ranges, tight, centre };
    }
  }
  // A known gold gate whose flap is due inside the horizon is planned through (its whole barrier is in view).
  for (const p of s.pillars) {
    if (p.tightTop === undefined || !knownPillar(p)) continue;
    const mid = p.x0 + (HOVER_PILLAR_W >> 1) - HOVER_DISC_X;
    if (mid <= dist[0]!) continue;
    let k = 0;
    while (k < 219 && dist[k]! < mid) k++;
    if (k > H && k - APEX_TICKS - 2 <= H) {
      const end = p.x0 + HOVER_PILLAR_W + HOVER_DISC_R - HOVER_DISC_X;
      while (k < 218 && dist[k]! < end) k++;
      H = Math.max(H, k);
    }
  }
  // A known barrier the horizon ends inside is planned through to its end.
  while (H < 218 && bands[H] && bands[H + 1]) H++;
  if (H < 218 && bands[H]) H++;
  // Items in view (known), in course order.
  const items: Item[] = [];
  const add = (x0: number, y: (t: number) => number, w: number) => {
    if (x0 - HOVER_STAR_R >= known) return;
    const reach = HOVER_DISC_R + HOVER_STAR_R;
    let from = -1;
    let to = -1;
    for (let k = 1; k <= H; k++)
      if (Math.abs(x0 - dist[k]! - HOVER_DISC_X) <= reach) {
        if (from < 0) from = k;
        to = k;
      }
    if (from > 0) items.push({ x0, y, r: HOVER_STAR_R, from, to, w });
  };
  s.pillars.forEach((p, i) => {
    if (p.starDy === undefined || (s.starsTaken ?? []).includes(i) || !knownPillar(p)) return;
    add(p.x0 + (HOVER_PILLAR_W >> 1), (t) => hoverStarY(p, t)!, 4);
  });
  (s.chains ?? []).forEach((c, ci) => {
    const hits = s.chainHits ?? [];
    c.stars.forEach((st, j) => {
      if (!hits.includes(ci * 8 + j)) add(st.x0, () => st.y, 3);
    });
  });
  items.sort((a, b) => a.x0 - b.x0);
  // Terminal aim: the middle of the first known gap beyond the horizon (else mid-height: an unseen gap).
  let aim = bottom >> 1;
  const nextAny = s.pillars.find((p) => p.x0 + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R) > dist[H]!);
  const next = nextAny && knownPillar(nextAny) ? nextAny : undefined;
  if (next) {
    aim = (next.tightTop ?? hoverGapTop(next, t0 + H)) + ((next.tightTop !== undefined ? next.tightH! : next.gapH) >> 1);
    if (next.gap2Top !== undefined && next.tightTop === undefined) aim = (aim + next.gap2Top + ((next.gap2H ?? 0) >> 1)) >> 1;
  }
  const modes: { tight: boolean; tol: number | null }[] = [
    { tight: true, tol: HOVER_CENTRE_TOL[2] - 128 },
    { tight: true, tol: null },
    { tight: false, tol: null },
  ];
  for (const mode of modes) {
    const r = beam(mode);
    if (r) return r.map((k) => t0 + k);
  }
  return null;

  function beam(mode: { tight: boolean; tol: number | null }): number[] | null {
    type Node = { y: number; v: number; since: number; done: number; score: number; parent: number; tap: boolean };
    const layers: Node[][] = [];
    let layer: Node[] = [{ y: s.y, v: s.vy, since: Math.min(PROOF_TAP_GAP, s.tick - lastTap), done: 0, score: 0, parent: -1, tap: false }];
    const reachOf = (it: Item, k: number, y: number) => {
      const dx = it.x0 - dist[k]! - HOVER_DISC_X;
      const dy = it.y(t0 + k) - y;
      const rr = HOVER_DISC_R + it.r - 64;
      return dx * dx + dy * dy <= rr * rr;
    };
    for (let k = 1; k <= H; k++) {
      const seen = new Map<number, number>();
      const out: Node[] = [];
      const b = bands[k];
      layer.forEach((n, pi) => {
        for (const tap of n.since >= PROOF_TAP_GAP ? [false, true] : [false]) {
          const v = tap ? HOVER_IMPULSE : clampV(n.v + HOVER_GRAVITY);
          const y = n.y + v;
          if (y - HOVER_DISC_R <= 512 || y + HOVER_DISC_R >= bottom - 512) continue;
          if (b) {
            const allowed = mode.tight && b.tight ? [b.tight] : b.ranges;
            if (!allowed.some(([lo, hi]) => y >= lo + 128 && y <= hi - 128)) continue;
            if (mode.tight && b.tight && b.centre !== null && mode.tol !== null && Math.abs(y - b.centre) > mode.tol) continue;
          }
          let stray = 0;
          if (b && mode.tight && b.tight && b.centre !== null) {
            const dv = Math.abs(y - b.centre);
            if (dv > HOVER_CENTRE_TOL[0] - 128) stray += 1.2;
            if (dv > HOVER_CENTRE_TOL[1] - 128) stray += 0.6;
          }
          let done = n.done;
          let score = n.score;
          while (done < items.length) {
            const it = items[done]!;
            if (it.from <= k && reachOf(it, k, y)) {
              score += it.w;
              done++;
            } else if (it.to < k) done++;
            else break;
          }
          const since = tap ? 1 : Math.min(PROOF_TAP_GAP, n.since + 1);
          const key = ((y >> 8) * 1024 + ((v + 4096) >> 4)) * 64 * 16 + since * 64 + done;
          const at = seen.get(key);
          const node = { y, v, since, done, score: score - stray - (tap ? 0.01 : 0), parent: pi, tap };
          if (at === undefined) {
            seen.set(key, out.length);
            out.push(node);
          } else if (node.score > out[at]!.score) out[at] = node;
        }
      });
      if (!out.length) return null;
      let keep = out;
      if (out.length > beamWidth) {
        const groups = new Map<number, Node[]>();
        for (const n of out) {
          const g = (n.y >> 9) * 128 + ((n.v + 4096) >> 7);
          const list = groups.get(g);
          if (list) list.push(n);
          else groups.set(g, [n]);
        }
        const cap = Math.max(1, Math.floor(beamWidth / groups.size));
        keep = [];
        for (const list of groups.values()) {
          list.sort((a, b2) => b2.score - a.score || Math.abs(a.v) - Math.abs(b2.v));
          keep.push(...list.slice(0, cap));
        }
      }
      layers.push(keep);
      layer = keep;
    }
    // The end of the line: how much of the next known barrier's gap(s) it can still reach by that barrier's entry
    // (falling, or tapping as fast as allowed), then its distance from the aim.
    const nextGaps: [number, number][] = [];
    let nextIn = H;
    if (next) {
      let k = H;
      const enter = next.x0 - (HOVER_DISC_X + HOVER_DISC_R);
      let d = dist[H]!;
      let g = s.gates;
      while (g < s.pillars.length && d > s.pillars[g]!.x0 + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R)) g++;
      while (d < enter && k < H + 200) {
        d += hoverScrollOf(s, g);
        k++;
      }
      nextIn = k;
      const gt = hoverGapTop(next, t0 + k);
      if (next.tightTop !== undefined) nextGaps.push([next.tightTop + HOVER_DISC_R, next.tightTop + (next.tightH ?? 0) - HOVER_DISC_R]);
      nextGaps.push([gt + HOVER_DISC_R, gt + next.gapH - HOVER_DISC_R]);
      if (next.gap2Top !== undefined) nextGaps.push([next.gap2Top + HOVER_DISC_R, next.gap2Top + (next.gap2H ?? 0) - HOVER_DISC_R]);
    }
    const apexTap = (() => {
      if (!next || next.tightTop === undefined) return -1;
      const mid = next.x0 + (HOVER_PILLAR_W >> 1) - HOVER_DISC_X;
      let k = 0;
      let d = dist[0]!;
      let g = s.gates;
      while (d < mid && k < H + 260) {
        d += hoverScrollOf(s, g);
        while (g < s.pillars.length && d > s.pillars[g]!.x0 + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R)) g++;
        k++;
      }
      return k - APEX_TICKS;
    })();
    const apexY = next && next.tightTop !== undefined ? hoverCentreY(next) + ARC : 0;
    const apexReach = (n: { y: number; v: number }): number => {
      if (apexTap <= H) return 0;
      let yd = n.y;
      let vd = n.v;
      for (let k = H + 1; k < apexTap; k++) {
        vd = clampV(vd + HOVER_GRAVITY);
        yd = Math.min(bottom, yd + vd);
      }
      return yd >= apexY - 6 * FP ? 6000 : 0;
    };
    const reachable = (n: { y: number; v: number; since: number }) => {
      if (!nextGaps.length) return 0;
      let yd = n.y;
      let vd = n.v;
      let yu = n.y;
      let vu = n.v;
      let su = n.since;
      for (let k = H + 1; k <= nextIn; k++) {
        vd = clampV(vd + HOVER_GRAVITY);
        yd = Math.min(bottom, yd + vd);
        const tap = su >= PROOF_TAP_GAP;
        vu = tap ? HOVER_IMPULSE : clampV(vu + HOVER_GRAVITY);
        yu = Math.max(HOVER_DISC_R, yu + vu);
        su = tap ? 1 : su + 1;
      }
      let cover = 0;
      for (const [lo, hi] of nextGaps) cover += Math.max(0, Math.min(hi, yd) - Math.max(lo, yu));
      return cover / FP + apexReach(n);
    };
    let best = -1;
    let bestV = -Infinity;
    layer.forEach((n, i) => {
      // An unseen next gap: keep the saucer high in the sky's middle third with room both ways (a player holds the middle).
      const v = n.score * 1000 + reachable(n) - Math.abs(n.y - aim) / (8 * FP) - Math.abs(n.v) / (16 * FP);
      if (v > bestV) {
        bestV = v;
        best = i;
      }
    });
    const taps: number[] = [];
    let i = best;
    for (let k = H; k >= 1; k--) {
      const n = layers[k - 1]![i]!;
      if (n.tap) taps.push(k);
      i = n.parent;
    }
    return taps.reverse();
  }
}

/**
 * The proof player's tap log on a game's run from `init`: re-plans every REPLAN ticks (and as soon as a barrier or star
 * becomes known) on what it knew PROOF_LAG ticks earlier and plays the plan exactly; when no line survives it keeps the saucer up (a tap whenever falling below the
 * middle, at most every PROOF_TAP_GAP ticks), a run that then ends where it ends.
 */
export function hoverProofTaps(game: ArcadeGame<HoverState>, init: HoverState, beamWidth = PROOF_BEAM): { taps: number[]; state: HoverState } {
  let plan: number[] = [];
  let planned = -100;
  let failed = false;
  let lastTap = -100;
  const distAt: number[] = [init.distance];
  let s = init;
  const taps: number[] = [];
  // What is known: everything left of the screen's right edge as it was PROOF_LAG ticks ago; a re-plan comes every
  // REPLAN ticks and as soon as anything new (a barrier, a star) becomes known, so nothing waits past the reaction time.
  const xs = [
    ...init.pillars.map((p) => p.x0),
    ...init.pillars.filter((p) => p.starDy !== undefined).map((p) => p.x0 + (HOVER_PILLAR_W >> 1) - HOVER_STAR_R),
    ...(init.chains ?? []).flatMap((c) => c.stars.map((st) => st.x0 - HOVER_STAR_R)),
  ].sort((a, b) => a - b);
  let knownCount = -1;
  while (!game.isOver(s) && s.tick < game.runTicks) {
    const t = s.tick + 1;
    const seenTick = Math.max(0, s.tick - PROOF_LAG);
    const known = distAt[seenTick]! + HOVER_WORLD_W * FP;
    let count = 0;
    while (count < xs.length && xs[count]! < known) count++;
    if (s.tick - planned >= REPLAN || failed || count !== knownCount) {
      knownCount = count;
      const p = planProof(s, lastTap, known, beamWidth);
      failed = p === null;
      if (p) {
        plan = p;
        planned = s.tick;
      }
    }
    let tap = plan.includes(t) && t - lastTap >= PROOF_TAP_GAP;
    // No line survives: keep the saucer up (the old plan past its end, a tap whenever it falls below the middle).
    if (failed && !plan.some((x) => x >= t) && t - lastTap >= PROOF_TAP_GAP && s.vy >= 0 && s.y > hoverBottom(s) >> 1) tap = true;
    if (tap) {
      lastTap = t;
      taps.push(t);
    }
    s = game.step(s, tap) as HoverState;
    distAt.push(s.distance);
  }
  return { taps, state: s };
}

if (import.meta.main) {
  const { hoverGameFor, hoverCheckpoint, HOVER_CHECKPOINT_INTERVAL } = await import("../src/lib/arcade/hover");
  const { encodeHoverRun, replayHoverRun } = await import("../src/lib/duel/hover");
  const { roomSeed } = await import("./arcade-skill-bands/games");
  const [revArg, levelArg, ...seedArgs] = process.argv.slice(2);
  const rev = Number(revArg ?? 11);
  const level = (levelArg ?? "normal") as "easy" | "normal" | "hard" | "expert";
  const seeds = seedArgs.length ? seedArgs.map(Number) : [0, 1, 2].map(roomSeed);
  for (const seed of seeds) {
    const t0 = performance.now();
    const game = hoverGameFor(rev, level);
    const { taps } = hoverProofTaps(game, game.init(seed) as HoverState);
    const set = new Set(taps);
    let st = game.init(seed) as HoverState;
    const cps = [];
    while (!game.isOver(st)) {
      st = game.step(st, set.has(st.tick + 1)) as HoverState;
      if (st.tick % HOVER_CHECKPOINT_INTERVAL === 0) cps.push(hoverCheckpoint(st));
    }
    const raw = encodeHoverRun({ seed, claimedScore: game.score(st), inputs: taps, endTick: st.tick, checkpoints: cps });
    const r = replayHoverRun(seed, raw, rev, level);
    const gaps = taps.slice(1).map((x, i) => x - taps[i]!);
    console.log(`seed ${seed} rev ${rev} ${level}: score ${r.score} flagged ${r.flagged} gates ${r.gates}/${r.totalGates} stars ${r.stars}/${r.totalStars} tight ${r.state.tight} chains ${r.state.chainsDone} hits ${(r.state.chainHits ?? []).length} ctr ${r.state.ctrFine ?? 0} breaks ${r.state.shieldBreaks ?? 0} crashed ${r.state.crashed} min gap ${Math.min(...gaps)} (${((performance.now() - t0) / 1000).toFixed(1)} s)`);
  }
}
