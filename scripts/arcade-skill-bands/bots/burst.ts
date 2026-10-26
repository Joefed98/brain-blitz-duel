/**
 * Fission: the phone has three buttons, ◀ FIRE ▶. Holding an arrow walks the
 * figure (4 px a tick) towards that wall; letting go stops it where it is. The
 * player picks an atom to attack (near ones first, re-chosen every second or so
 * and a reaction after the old one splits), walks to where it will be, letting
 * go of the arrow at an anticipated moment (timing error), and taps FIRE when
 * the atom is about to cross the shot line. Atoms are seen late (tracking lag)
 * and their paths are read with an error that grows with how far ahead the
 * player looks; atoms born from a split are only seen a reaction later. When an
 * atom will come down on the figure the player walks to the nearest safe spot.
 * Falling icons are chased when the player decides to and it looks safe.
 *
 * burstRev 8 (the expansion, docs/expansions/e9.md): a player who goes for the
 * golden atoms walks under one while it is up (seen a reaction late) and fires
 * when the beam's line looks clear of atoms; misses come from the player's own
 * path reads and slips, so better players clear more waves clean.
 */
import {
  burstFloorY,
  BURST_INPUT_FIRE,
  BURST_INPUT_MOVE,
  BURST_RADIUS,
  BURST_WORLD_W,
  burstCeilingOf,
  burstBounceOf,
  burstGoldenNow,
  BURST_V8_GOLDEN_LIFE,
  BURST_ICON_DOUBLE,
  type BurstBall,
  type BurstState,
} from "../../../src/lib/arcade/burst";
import { driveEvents, Plan, type SkillBot } from "../bot";

/** Path-read error per tick looked ahead, px. */
const READ: Record<string, number> = { weak: 0.4, average: 0.3, good: 0.2, great: 0.13, near: 0.08, elite: 0.05 };
/** How far ahead (ticks) the player checks that a spot is safe. */
const LOOKAHEAD: Record<string, number> = { weak: 22, average: 28, good: 36, great: 44, near: 52, elite: 58 };
/** Chance of going for a falling icon. */
const ICON: Record<string, number> = { weak: 0.35, average: 0.5, good: 0.7, great: 0.85, near: 0.95, elite: 1 };
/** How many atoms (the nearest) the player keeps an eye on for danger at once. */
const WATCH: Record<string, number> = { weak: 2, average: 2, good: 3, great: 4, near: 6, elite: 7 };
/** Shortest gap between two deliberate button presses, ticks (about 6–8.5 a second). */
const PRESS_GAP: Record<string, number> = { weak: 12, average: 10, good: 9, great: 8, near: 7, elite: 6 };
/** burstRev 8: chance a shot is a careful one (not fired on a crossing read past a ceiling bounce); keeps waves clean. */
const CAREFUL: Record<string, number> = { weak: 0, average: 0.1, good: 0.3, great: 0.6, near: 0.85, elite: 0.95 };
/** burstRev 8: chance of going for a golden atom when one appears. */
const GOLDEN: Record<string, number> = { weak: 0.2, average: 0.35, good: 0.55, great: 0.75, near: 0.9, elite: 1 };

const FP = 256;
const WALK = 4;
const HALF_W = 12;
const PLAYER_H = 36;
const GRAVITY = 32;
const SHOT_SPEED = 9;
const MIN_X = HALF_W;
const MAX_X = BURST_WORLD_W - HALF_W;
const APEX_PCT = [75, 60, 45, 30];
/** The floor and bounce speeds, set per run from the game's own arena (burstRev 4's taller one). */
let BURST_FLOOR_Y = 0;
let BOUNCE_V: number[] = [];
function setArena(floor: number, state?: BurstState): void {
  BURST_FLOOR_Y = floor;
  const arenaH = floor - 40;
  BOUNCE_V = state?.exp ? [...burstBounceOf(state)] : APEX_PCT.map((pct) => Math.trunc(Math.sqrt(2 * GRAVITY * Math.trunc((arenaH * pct) / 100) * FP)));
}

/**
 * burstRev 8: whether the bots play the expansion's features (the golden atoms, the DOUBLE icon). The
 * measuring script (scripts/expansion-e9-bands.ts) turns it off to measure each feature's own payout.
 */
export const burstBotOptions = { features: true };

interface Tracked {
  x: number;
  y: number;
  size: number;
  err: number;
  noticeAt: number;
  id: number;
}

/**
 * A ball's centre over the next n ticks (floor, walls and ceiling; no ceiling deflection, which the player
 * cannot know in advance), and whether it has touched the ceiling by then (`c`: past that the read is a guess).
 */
function path(b: BurstBall, ceil: number, n: number): { x: number; y: number; c?: number }[] {
  const out: { x: number; y: number; c?: number }[] = [];
  let touched = 0;
  const r = BURST_RADIUS[b.size]! * FP;
  let { x, y, vx, vy } = b;
  for (let i = 0; i < n; i++) {
    vy += GRAVITY;
    y += vy;
    x += vx;
    if (y + r >= BURST_FLOOR_Y * FP) {
      y = BURST_FLOOR_Y * FP - r;
      vy = -BOUNCE_V[b.size]!;
    }
    if (y - r < ceil * FP) {
      y = ceil * FP + r;
      if (vy < 0) vy = -vy;
      touched = 1;
    }
    if (x - r < 0) {
      x = r;
      vx = Math.abs(vx);
    } else if (x + r > BURST_WORLD_W * FP) {
      x = BURST_WORLD_W * FP - r;
      vx = -Math.abs(vx);
    }
    out.push(touched ? { x: x / FP, y: y / FP, c: 1 } : { x: x / FP, y: y / FP });
  }
  return out;
}

/** Does a ball at (bx, by) of radius r touch the figure at px (with a margin)? */
function touches(bx: number, by: number, r: number, px: number, margin: number): boolean {
  const left = px - HALF_W - margin;
  const right = px + HALF_W + margin;
  const top = BURST_FLOOR_Y - PLAYER_H - margin;
  const cx = Math.max(left, Math.min(right, bx));
  const cy = Math.max(top, Math.min(BURST_FLOOR_Y, by));
  const dx = bx - cx;
  const dy = by - cy;
  return dx * dx + dy * dy <= r * r;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  setArena(burstFloorY(game.init(seed)), game.init(seed) as BurstState);
  const features = Boolean((game.init(seed) as BurstState).exp) && burstBotOptions.features;
  const level = human.level;
  const read = READ[level]!;
  const horizon = LOOKAHEAD[level]!;
  const gap = PRESS_GAP[level]!;
  const history: BurstState[] = [];
  const lag = human.lagTicks();
  const init = game.init(seed) as BurstState;
  const plan = new Plan();
  let tracked: Tracked[] = [];
  let nextId = 1;
  /** Arrow held: -1 left, 1 right, 0 none; when to let go. */
  let hold = 0;
  let releaseAt = -1;
  let holdTarget = 0;
  let lastPress = -100;
  let lastFire = -100;
  let careAt = -1;
  let hadShot = false;
  let beamEnd = -100;
  let careful = false;
  let fireFlip = 0;
  /** The atom being attacked and when to choose again. */
  let targetId = -1;
  let rethinkAt = 0;
  let aimErr = 0;
  const iconWill = new Map<string, { go: boolean; at: number }>();
  const goldenWill = new Map<number, { go: boolean; at: number; err: number }>();

  return driveEvents(game, (s: BurstState, t) => {
    history.push(s);
    const seen = history[Math.max(0, history.length - 1 - lag)]!;
    const ceil = burstCeilingOf(seen);

    // Track atoms frame to frame; one born from a split (or a new wave) is seen a reaction later.
    const next: Tracked[] = [];
    for (const b of seen.balls) {
      const x = b.x / FP;
      const y = b.y / FP;
      let best: Tracked | null = null;
      let bestD = 24;
      for (const o of tracked) {
        if (o.size !== b.size || next.includes(o)) continue;
        const d = Math.abs(o.x - x) + Math.abs(o.y - y);
        if (d < bestD) {
          bestD = d;
          best = o;
        }
      }
      next.push(best ? { ...best, x, y } : { x, y, size: b.size, err: human.normal(), noticeAt: t + human.reactTicks(), id: nextId++ });
    }
    tracked = next;

    // The player's read of each noticed atom's path, from the late view to `horizon` ticks past now.
    const reads: { tr: Tracked; pts: { x: number; y: number }[]; r: number }[] = [];
    seen.balls.forEach((b, i) => {
      const tr = tracked[i]!;
      if (t < tr.noticeAt) return;
      const frozen = (seen.freeze ?? 0) > 0;
      const raw: { x: number; y: number; c?: number }[] = frozen ? Array.from({ length: horizon + lag }, () => ({ x: b.x / FP, y: b.y / FP })) : path(b, ceil, horizon + lag);
      const pts = raw.slice(lag).map((p, k) => ({ x: p.x + tr.err * read * (k + 1), y: p.y, c: p.c }));
      reads.push({ tr, pts, r: BURST_RADIUS[b.size]! });
    });

    const x = s.x / FP;
    /** Where the figure would be k ticks from now walking to `to`. */
    const at = (to: number, k: number) => x + Math.max(-WALK * k, Math.min(WALK * k, to - x));
    const margin = 2 + human.p.aimSdPx * 0.5;
    // Attention: only the few atoms nearest the figure are watched for danger.
    const watched = [...reads].sort((a, b) => Math.abs(a.pts[0]!.x - x) + Math.abs(a.pts[0]!.y - BURST_FLOOR_Y) / 2 - (Math.abs(b.pts[0]!.x - x) + Math.abs(b.pts[0]!.y - BURST_FLOOR_Y) / 2)).slice(0, WATCH[level]!);
    const safe = (to: number) => {
      for (const rd of watched) for (let k = 0; k < rd.pts.length; k++) if (touches(rd.pts[k]!.x, rd.pts[k]!.y, rd.r, at(to, k + 1), margin)) return false;
      return true;
    };

    // ---- Where the player wants to be. ----
    let want = x;
    // A falling icon worth catching.
    let chasing = false;
    for (const icon of seen.icons) {
      // A player who doesn't know the DOUBLE beam leaves its icon alone.
      if (icon.kind === BURST_ICON_DOUBLE && !features) continue;
      const key = `${icon.x}:${icon.kind}`;
      if (!iconWill.has(key)) iconWill.set(key, { go: human.chance(ICON[level]!), at: t + human.reactTicks() });
      const w = iconWill.get(key)!;
      if (!w.go || t < w.at) continue;
      const ix = icon.x / FP;
      const fall = icon.kind === 0 ? 3 : 2;
      const ticks = (BURST_FLOOR_Y - PLAYER_H - icon.y / FP) / fall;
      if (Math.abs(ix - x) / WALK < ticks + 4) {
        want = ix;
        chasing = true;
        break;
      }
    }
    // burstRev 8: a golden atom up now; a player going for it lines up under it (noticing it a reaction late).
    const gn = features ? burstGoldenNow(seen, seen.tick) : -1;
    let atom: { x: number; y: number } | null = null;
    if (gn >= 0) {
      if (!goldenWill.has(gn)) goldenWill.set(gn, { go: human.chance(GOLDEN[level]!), at: t + human.reactTicks(), err: human.normal() });
      const w = goldenWill.get(gn)!;
      const g = seen.goldens![gn]!;
      if (w.go && t >= w.at) atom = { x: g.x + w.err * human.p.aimSdPx * 0.6, y: g.y };
    }
    if (atom && !chasing) {
      want = atom.x;
      chasing = true;
    }
    if (!chasing) {
      const targ = reads.find((rd) => rd.tr.id === targetId);
      if (!targ || t >= rethinkAt) {
        if (!targ && targetId >= 0) {
          // The atom split or popped: take in the new picture first.
          targetId = -1;
          rethinkAt = t + human.reactTicks();
        } else if (reads.length > 0) {
          // Nearest atoms first; small fast ones are harder to catch under.
          const values = reads.map((rd) => {
            let v = -Math.abs(rd.pts[Math.min(20, rd.pts.length - 1)]!.x - x) / 80 - rd.tr.size * 0.3;
            return v;
          });
          targetId = reads[human.pick(values)]!.tr.id;
          aimErr = human.normal();
          rethinkAt = t + human.thinkTicks(1000);
        }
      }
      const tg = reads.find((rd) => rd.tr.id === targetId);
      if (tg) {
        // Meet it where it will be in a moment (the walk there and the shot's climb), off its line a little.
        const k = Math.min(tg.pts.length - 1, Math.round(Math.abs(tg.pts[0]!.x - x) / (WALK * 2)) + 12);
        want = tg.pts[k]!.x + aimErr * human.p.aimSdPx;
      }
    }
    want = Math.max(MIN_X, Math.min(MAX_X, want));
    if (!safe(want)) {
      // Nearest safe spot; if nowhere looks safe, keep away from the nearest low atom.
      let best = NaN;
      for (let d = 0; d <= BURST_WORLD_W && Number.isNaN(best); d += 8) {
        for (const sgn of [-1, 1]) {
          const c = want + sgn * d;
          if (c >= MIN_X && c <= MAX_X && safe(c)) {
            best = c;
            break;
          }
        }
      }
      want = Number.isNaN(best) ? x : best;
    }

    // ---- Fire: an atom is about to cross the shot line. ----
    // The beam just ended (on an atom, most often): the player sees the result a tracking lag later, so they
    // don't fire again at what their late view still shows there.
    if (s.shots.length === 0 && hadShot) beamEnd = t;
    hadShot = s.shots.length > 0;
    if (s.shots.length === 0 && t - lastFire >= gap && t - lastPress >= 2 && (!features || t - beamEnd > lag)) {
      let go = false;
      if (careAt !== lastFire) {
        careAt = lastFire;
        careful = features && human.chance(CAREFUL[level]!);
      }
      for (const rd of reads) {
        for (let k = 0; k < Math.min(rd.pts.length, 40) && !go; k++) {
          const p = rd.pts[k]!;
          // burstRev 8: a careful player doesn't fire on a crossing read past a ceiling bounce (it may deflect).
          if (careful && p.c) break;
          const lineTop = BURST_FLOOR_Y - SHOT_SPEED * (k + 1);
          if (Math.abs(p.x - x) <= rd.r * 0.8 && p.y + rd.r >= lineTop) go = true;
        }
        if (go) break;
      }
      // A golden atom: only while it will still be up when the beam gets there (a player watching its ring).
      const climb = atom ? Math.ceil((BURST_FLOOR_Y - atom.y) / SHOT_SPEED) : 0;
      const lasts = gn >= 0 ? seen.goldens![gn]!.tick + BURST_V8_GOLDEN_LIFE - s.tick : 0;
      if (atom && !go && Math.abs(atom.x - x) <= 6 && lasts > climb + (level === "weak" || level === "average" ? 0 : 6)) {
        // The beam's line up to the golden atom looks clear of atoms for its climb.
        const k = Math.ceil((BURST_FLOOR_Y - atom.y) / SHOT_SPEED);
        let blocked = false;
        for (const rd of reads) for (let j = 0; j < Math.min(rd.pts.length, k) && !blocked; j++) if (Math.abs(rd.pts[j]!.x - x) <= rd.r + 2 && rd.pts[j]!.y + rd.r >= atom.y) blocked = true;
        if (!blocked) go = true;
      }
      if (go || human.slip(0.01)) {
        plan.at(t, { k: BURST_INPUT_FIRE, a: 0, b: (fireFlip ^= 1), c: 0, d: 0 });
        lastFire = t;
      }
    }

    // ---- Arrows: hold towards the wanted spot, let go when the figure should be there. ----
    const dir = Math.abs(want - x) < WALK * 2 ? 0 : want > x ? 1 : -1;
    if (t - lastPress >= gap) {
      if (dir !== 0 && (dir !== hold || Math.abs(want - holdTarget) > 24)) {
        hold = dir;
        holdTarget = want;
        plan.at(t, { k: BURST_INPUT_MOVE, a: dir < 0 ? 0 : BURST_WORLD_W, b: 0, c: 0, d: 0 });
        releaseAt = t + Math.max(1, Math.round(Math.abs(want - x) / WALK)) + human.timingTicks();
        lastPress = t;
      } else if (hold !== 0 && dir === 0 && releaseAt < 0) {
        releaseAt = t;
      }
    }
    if (hold !== 0 && releaseAt >= 0 && t >= releaseAt) {
      // Letting go: the phone sends "stop here".
      hold = 0;
      releaseAt = -1;
      lastPress = t;
      plan.at(t, { k: BURST_INPUT_MOVE, a: -1, b: 0, c: 0, d: 0 });
    }

    const ev = plan.take(t);
    if (!ev) return null;
    // A stop is the figure's position on the tick it goes out, as the phone sends it.
    if (ev.k === BURST_INPUT_MOVE && ev.a === -1) return { ...ev, a: Math.round(s.x / FP) };
    return ev;
  }, init);
};
