/**
 * The flawless player on hoverRev 9 (the 200 expansion): a human at the top of the game, who sees the
 * screen ahead of the saucer (HORIZON_PX of course, about a second) and plans the next stretch of taps
 * through it perfectly, but no further: every few ticks (REPLAN) it searches the tap sequences over what
 * is in view (taps at least MIN_TAP_GAP apart, 10 a second at most) for the line
 * through every barrier that takes the most of what is on screen: each gold star and chain star in view,
 * every tight gate dead centre on its line (within its 6 px, else its 10 px, else just through it),
 * ending where the next unseen barrier is easiest to reach. No timing error, no reaction lag (a flawless
 * player's taps are anticipated). Script only (floats are fine: the output is a tap log the sim replays).
 *
 * The search is a beam over (height, speed, ticks since the last tap, items taken in order) on the
 * course's own timeline from the current state; the scroll speed depends only on barriers passed, which
 * the planned line never fails, so the timeline is the sim's.
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
  hoverBottom,
  hoverCentreY,
  hoverGapTop,
  hoverScroll,
  hoverStarY,
  type HoverPillar,
  type HoverState,
} from "../../../src/lib/arcade/hover";
import type { ArcadeGame } from "../../../src/lib/arcade/engine";
import { driveTaps } from "../bot";

const FP = 256;
/** The flawless player taps up to 10 times a second (every 6 ticks; the other levels 7.5). */
const MIN_TAP_GAP = 6;
/** How far ahead of the saucer the player sees (the screen right of it), px. */
const HORIZON_PX = Number(process.env.HOVER_FLAWLESS_VIEW ?? 260);
/** Ticks between re-plans. */
const REPLAN = 6;
const BEAM = Number(process.env.HOVER_FLAWLESS_BEAM ?? 6000);
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
  /** Ticks (absolute) the disc can touch it at all, on this plan's timeline. */
  from: number;
  to: number;
  /** Chain index (stars of one chain all count or none), or −1 for a gold star. */
  chain: number;
  w: number;
}

/** The distance after each tick from `s`, passing barriers as the sim does (a line that never crashes). */
function timeline(s: HoverState, ticks: number): number[] {
  const out = [s.distance];
  let d = s.distance;
  let g = s.gates;
  for (let k = 1; k <= ticks; k++) {
    d += hoverScroll(g);
    while (g < s.pillars.length && d > s.pillars[g]!.x0 + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R)) g++;
    out.push(d);
  }
  return out;
}

/**
 * Plans taps from `s` over the visible stretch; returns absolute tap ticks (may be empty) or null when no line
 * survives (the caller then falls back on the ordinary planner).
 */
export function planFlawless(s: HoverState, lastTap: number): number[] | null {
  const speed = hoverScroll(s.gates);
  const dist = timeline(s, 220);
  const bottom = hoverBottom(s);
  const t0 = s.tick;
  const viewEnd = s.distance + HORIZON_PX * FP + HOVER_DISC_X;
  // A chain is flown on one flap, so once its first star is in view the whole chain is planned for: the
  // horizon stretches to its last star and through the barrier after it (a player reads the arc of stars as one).
  let H = Math.max(30, Math.min(140, Math.floor((HORIZON_PX * FP) / speed)));
  for (const c of s.chains ?? []) {
    if (c.stars[0]!.x0 > viewEnd) continue;
    // ...and on through the barrier after it (the chain's flap leads into it; the course is laid so it can be flown).
    const b = s.pillars[c.after + 1];
    const last = b ? b.x0 + HOVER_PILLAR_W + HOVER_DISC_R - HOVER_DISC_X : c.stars[c.stars.length - 1]!.x0 - HOVER_DISC_X + HOVER_DISC_R + HOVER_STAR_R;
    let k = 0;
    while (k < 219 && dist[k]! < last) k++;
    H = Math.max(H, Math.min(219, k + 2));
  }
  // Barrier bands per step (k = 1..H), the tight gate (and its centre band) when it is threaded.
  type Band = { ranges: [number, number][]; tight: [number, number] | null; centre: number | null };
  const bands: (Band | null)[] = new Array(220).fill(null);
  for (let k = 1; k < 220; k++) {
    const d = dist[k]!;
    for (const p of s.pillars) {
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
  // A gold gate whose flap is due inside the horizon is planned through too: a flawless player knows a gate's line is
  // flown on the top of a flap and sets it up as the gate comes into view (at most a flap's length beyond the screen).
  for (const p of s.pillars) {
    if (p.tightTop === undefined) continue;
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
  // A barrier the horizon ends inside is planned through to its end (a player sees the whole of it).
  while (H < 218 && bands[H] && bands[H + 1]) H++;
  if (H < 218 && bands[H]) H++;
  // Items in view, in course order.
  const items: Item[] = [];
  const add = (x0: number, y: (t: number) => number, chain: number, w: number, always = false) => {
    if (x0 > viewEnd && !always) return;
    const reach = HOVER_DISC_R + HOVER_STAR_R;
    let from = -1;
    let to = -1;
    for (let k = 1; k <= H; k++)
      if (Math.abs(x0 - dist[k]! - HOVER_DISC_X) <= reach) {
        if (from < 0) from = k;
        to = k;
      }
    if (from > 0) items.push({ x0, y, r: HOVER_STAR_R, from, to, chain, w });
  };
  s.pillars.forEach((p, i) => {
    if (p.starDy === undefined || (s.starsTaken ?? []).includes(i)) return;
    add(p.x0 + (HOVER_PILLAR_W >> 1), (t) => hoverStarY(p, t)!, -1, 4);
  });
  (s.chains ?? []).forEach((c, ci) => {
    const hits = s.chainHits ?? [];
    // A chain already broken (a star passed untaken) is worth nothing.
    if (c.stars.some((st, j) => !hits.includes(ci * 8 + j) && st.x0 - s.distance < HOVER_DISC_X - (HOVER_DISC_R + HOVER_STAR_R))) return;
    if (c.stars[0]!.x0 > viewEnd) return;
    c.stars.forEach((st, j) => {
      if (!hits.includes(ci * 8 + j)) add(st.x0, () => st.y, ci, 3, true);
    });
  });
  items.sort((a, b) => a.x0 - b.x0);
  // Terminal aim: the middle of the first gap beyond the horizon that the plan has not reached yet (else mid-height).
  let aim = bottom >> 1;
  const next = s.pillars.find((p) => p.x0 + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R) > dist[H]!);
  // (Between a two-gap barrier's gaps, so either stays open for what comes into view after it.)
  if (next) {
    aim = (next.tightTop ?? hoverGapTop(next, t0 + H)) + ((next.tightTop !== undefined ? next.tightH! : next.gapH) >> 1);
    if (next.gap2Top !== undefined && next.tightTop === undefined) aim = (aim + next.gap2Top + ((next.gap2H ?? 0) >> 1)) >> 1;
  }

  // Modes, from most to least ambitious: tight gates on their line within 6 px, then 10 px, then anywhere in them, then the main gaps.
  // The centre line is weighed against the stars in view (soft: straying costs per tick, past 6 px and past 10 px), so
  // a dead-centre line never costs a whole chain; the hard 15 px band then keeps the pass graded at all.
  const modes: { tight: boolean; tol: number | null }[] = [
    { tight: true, tol: HOVER_CENTRE_TOL[2] - 128 },
    { tight: true, tol: null },
    { tight: false, tol: null },
  ];
  for (const mode of modes) {
    const r = beam(s, H, bands, items, mode, bottom, aim, lastTap);
    if (process.env.HOVER_FLAWLESS_TRACE && Math.abs(t0 - Number(process.env.HOVER_FLAWLESS_TRACE)) < 60) console.error(`t ${t0} y ${s.y >> 8} H ${H} items ${items.length} mode ${JSON.stringify(mode)} -> ${r ? r.join(",") : "none"} hits ${(s.chainHits ?? []).length}`);
    if (r) return r.map((k) => t0 + k);
  }
  return null;

  function beam(
    st: HoverState,
    horizon: number,
    bandsAt: (Band | null)[],
    its: Item[],
    mode: { tight: boolean; tol: number | null },
    floor: number,
    target: number,
    last: number,
  ): number[] | null {
    type Node = { y: number; v: number; since: number; done: number; score: number; parent: number; tap: boolean };
    const layers: Node[][] = [];
    let layer: Node[] = [{ y: st.y, v: st.vy, since: Math.min(MIN_TAP_GAP, st.tick - last), done: 0, score: 0, parent: -1, tap: false }];
    const reachOf = (it: Item, k: number, y: number) => {
      const dx = it.x0 - dist[k]! - HOVER_DISC_X;
      const dy = it.y(t0 + k) - y;
      const rr = HOVER_DISC_R + it.r - 64;
      return dx * dx + dy * dy <= rr * rr;
    };
    for (let k = 1; k <= horizon; k++) {
      const seen = new Map<number, number>();
      const out: Node[] = [];
      const b = bandsAt[k];
      layer.forEach((n, pi) => {
        for (const tap of n.since >= MIN_TAP_GAP ? [false, true] : [false]) {
          const v = tap ? HOVER_IMPULSE : clampV(n.v + HOVER_GRAVITY);
          const y = n.y + v;
          if (y - HOVER_DISC_R <= 512 || y + HOVER_DISC_R >= floor - 512) continue;
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
          // Items in order: taken when touched in their window, skipped (no score) once their window has passed.
          while (done < its.length) {
            const it = its[done]!;
            if (it.from <= k && reachOf(it, k, y)) {
              score += it.w;
              done++;
            } else if (it.to < k) done++;
            else break;
          }
          const since = tap ? 1 : Math.min(MIN_TAP_GAP, n.since + 1);
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
      if (out.length > BEAM) {
        // Keep the best by score within each group, spread over the groups.
        const bandsMap = new Map<number, Node[]>();
        for (const n of out) {
          // Groups by height (2 px) and speed (half a px a tick), so the kept states stay spread over both.
          const g = (n.y >> 9) * 128 + ((n.v + 4096) >> 7);
          const list = bandsMap.get(g);
          if (list) list.push(n);
          else bandsMap.set(g, [n]);
        }
        const cap = Math.max(1, Math.floor(BEAM / bandsMap.size));
        keep = [];
        for (const list of bandsMap.values()) {
          list.sort((a, b2) => b2.score - a.score || Math.abs(a.v) - Math.abs(b2.v));
          keep.push(...list.slice(0, cap));
        }
      }
      layers.push(keep);
      layer = keep;
    }
    // Chains: a chain only counts whole; drop the chain-star score of a chain the line leaves part-taken (in view).
    let best = -1;
    let bestV = -Infinity;
    // The end of the line is judged by how much of the next barrier's gap(s) it can still reach by that barrier's
    // entry (falling, or tapping as fast as allowed), then by its distance from the aim.
    const nextGaps: [number, number][] = [];
    let nextIn = horizon;
    if (next) {
      let k = horizon;
      const enter = next.x0 - (HOVER_DISC_X + HOVER_DISC_R);
      let d = dist[horizon]!;
      let g = st.gates;
      while (g < st.pillars.length && d > st.pillars[g]!.x0 + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R)) g++;
      while (d < enter && k < horizon + 200) {
        d += hoverScroll(g);
        k++;
      }
      nextIn = k;
      const gt = hoverGapTop(next, t0 + k);
      if (next.tightTop !== undefined) nextGaps.push([next.tightTop + HOVER_DISC_R, next.tightTop + (next.tightH ?? 0) - HOVER_DISC_R]);
      nextGaps.push([gt + HOVER_DISC_R, gt + next.gapH - HOVER_DISC_R]);
      if (next.gap2Top !== undefined) nextGaps.push([next.gap2Top + HOVER_DISC_R, next.gap2Top + (next.gap2H ?? 0) - HOVER_DISC_R]);
    }
    const reachable = (n: { y: number; v: number; since: number }) => {
      if (!nextGaps.length) return 0;
      let yd = n.y;
      let vd = n.v;
      let yu = n.y;
      let vu = n.v;
      let su = n.since;
      for (let k = horizon + 1; k <= nextIn; k++) {
        vd = clampV(vd + HOVER_GRAVITY);
        yd = Math.min(floor, yd + vd);
        const tap = su >= MIN_TAP_GAP;
        vu = tap ? HOVER_IMPULSE : clampV(vu + HOVER_GRAVITY);
        yu = Math.max(HOVER_DISC_R, yu + vu);
        su = tap ? 1 : su + 1;
      }
      let cover = 0;
      for (const [lo, hi] of nextGaps) cover += Math.max(0, Math.min(hi, yd) - Math.max(lo, yu));
      return cover / FP + apexReach(n);
    };
    // A tight gate next: its centre line is flown on the top of a flap, so the saucer must be able to fall to a flap
    // below the line by the time that flap is due (worth far more than the room: the gate and its line pay up to 9).
    const apexTap = (() => {
      if (!next || next.tightTop === undefined) return -1;
      const mid = next.x0 + (HOVER_PILLAR_W >> 1) - HOVER_DISC_X;
      let k = 0;
      let d = dist[0]!;
      let g = st.gates;
      while (d < mid && k < horizon + 260) {
        d += hoverScroll(g);
        while (g < st.pillars.length && d > st.pillars[g]!.x0 + HOVER_PILLAR_W - (HOVER_DISC_X - HOVER_DISC_R)) g++;
        k++;
      }
      return k - APEX_TICKS;
    })();
    const apexY = next && next.tightTop !== undefined ? hoverCentreY(next) + ARC : 0;
    function apexReach(n: { y: number; v: number }): number {
      if (apexTap <= horizon) return 0;
      let yd = n.y;
      let vd = n.v;
      for (let k = horizon + 1; k < apexTap; k++) {
        vd = clampV(vd + HOVER_GRAVITY);
        yd = Math.min(floor, yd + vd);
      }
      return yd >= apexY - 6 * FP ? 6000 : 0;
    }
    layer.forEach((n, i) => {
      const v = n.score * 1000 + reachable(n) - Math.abs(n.y - target) / (8 * FP) - Math.abs(n.v) / (16 * FP);
      if (v > bestV) {
        bestV = v;
        best = i;
      }
    });
    if (process.env.HOVER_FLAWLESS_TRACE && Math.abs(t0 - Number(process.env.HOVER_FLAWLESS_TRACE)) < 60) console.error(`  best score ${(bestV / 1000).toFixed(2)} done ${layer[best]!.done} of ${its.length}, last layer ${layer.length}`);
    const taps: number[] = [];
    let i = best;
    for (let k = horizon; k >= 1; k--) {
      const n = layers[k - 1]![i]!;
      if (n.tap) taps.push(k);
      i = n.parent;
    }
    return taps.reverse();
  }
}

/** The flawless bot on a hoverRev 9 course: re-plans every REPLAN ticks and plays the plan exactly. */
export function flawlessTaps(game: ArcadeGame<HoverState>, init: HoverState, fallback: (s: HoverState, t: number) => boolean): { taps: number[] } {
  let plan: number[] = [];
  let planned = -100;
  let lastTap = -100;
  let fallbackOn = false;
  return driveTaps(
    game,
    (s: HoverState, t) => {
      if (t - planned >= REPLAN || fallbackOn) {
        const p = planFlawless(s, lastTap);
        fallbackOn = p === null;
        if (p === null && process.env.HOVER_FLAWLESS_DBG) console.error("fallback at", t, "gates", s.gates);
        if (p) {
          plan = p;
          planned = t;
        }
      }
      const tap = fallbackOn ? fallback(s, t) : plan.includes(t) && t - lastTap >= MIN_TAP_GAP;
      if (tap) lastTap = t;
      return tap;
    },
    init,
  );
}

export type { HoverPillar };
