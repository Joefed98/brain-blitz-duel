/**
 * Wavefront: the finger drags the ship (top speed per level) to stand under a
 * chosen target and lets the auto-fire do the work. The player picks a column
 * of the formation (near the ship, and lower rows first as the formation comes
 * down), with a lead for its march that is judged with the player's blur; the
 * field is seen late (tracking lag). A saucer or a falling power-up is chased
 * when the player decides to, one reaction after it appears, with the saucer
 * lead judged roughly. Every red bolt and diving ship is a new event: it is
 * dodged no sooner than a reaction after it appears, by moving to the nearest
 * spot it will not cross. After wave 5 the boss is the target.
 */
import { ARCADE_INPUT_DRAG } from "../../../src/lib/arcade/engine";
import {
  wavDiverCentre,
  wavForm,
  wavShapeBox,
  WAV_BOSS_W,
  wavBossW,
  wavCannonX,
  wavCoreOpen,
  WAV_CELL,
  WAV_COLS,
  WAV_DIVE_TICKS,
  WAV_ROWS,
  WAV_SHIP_H,
  WAV_SHIP_W,
  wavShipY,
  wavBoltSpeedFp,
  WAV_WORLD_W,
  type WavState,
} from "../../../src/lib/arcade/wavefront";
import { driveEvents, type SkillBot } from "../bot";

/** Finger top speed, px a tick (the world is 390 wide, so world px are phone px). */
const FINGER: Record<string, number> = { average: 26, good: 32, great: 38, near: 44 };
/** Chance of going for a saucer, and for its power-up drop. */
const SAUCER: Record<string, number> = { average: 0.4, good: 0.6, great: 0.8, near: 0.9 };
const DROP: Record<string, number> = { average: 0.5, good: 0.7, great: 0.85, near: 0.95 };
/** wavRev 9: chance of aiming at a boss's open core, and at a cannon still firing, when deciding. */
const CORE: Record<string, number> = { average: 0.15, good: 0.4, great: 0.7, near: 0.9 };
const CANNON: Record<string, number> = { average: 0.1, good: 0.3, great: 0.55, near: 0.8 };
/** How far ahead (ticks) a player keeps track of incoming bolts when choosing where to stand. */
const LOOKAHEAD: Record<string, number> = { average: 30, good: 38, great: 44, near: 50 };

/** The ship's bolt speed, px a tick (set per run: 10 in wavRev 6's taller world). */
let BOLT_SPEED = 8;
/** The ship's line, set per run from the game's own world (wavRev 6's taller world). */
let WAV_SHIP_Y = 0;
let BOLT_Y0 = 0;
let SHIP_TOP = 0;
const MIN_X = 24;
const MAX_X = WAV_WORLD_W - 24;
const SAUCER_Y = 62;

interface Red {
  x: number;
  y: number;
  noticeAt: number;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  WAV_SHIP_Y = wavShipY(game.init(seed));
  BOLT_SPEED = wavBoltSpeedFp(game.init(seed)) / 256;
  BOLT_Y0 = WAV_SHIP_Y - 14 - 12;
  SHIP_TOP = WAV_SHIP_Y - WAV_SHIP_H / 2;
  const level = human.level;
  const speed = FINGER[level]!;
  const history: WavState[] = [];
  const lag = human.lagTicks();
  const init = game.init(seed) as WavState;
  let finger = init.shipX;
  let sent = init.aimX;

  /** Reds being tracked (matched frame to frame by x, falling). */
  let reds: Red[] = [];
  /** Divers: noticed tick per formation cell for the current dive. */
  const diverSeen = new Map<string, number>();
  /** Target column and when to look again. */
  let col = -1;
  let colErr = 0;
  let rethinkAt = 0;
  /** Saucer / drop decisions. */
  let saucerKey = "";
  let saucerGo = false;
  let saucerAt = 0;
  let saucerErr = 0;
  let dropKey = "";
  let dropGo = false;
  let dropAt = 0;
  let bossErr = 0;
  let bossAt = -1;
  /** wavRev 9: what the player aims at on a boss (0/1 a cannon, 2 the core, 3 the hull), -1 undecided. */
  let bossMode = -1;

  return driveEvents(game, (s: WavState, t) => {
    history.push(s);
    const seen = history[Math.max(0, history.length - 1 - lag)]!;

    // Track red bolts: new ones are noticed one reaction after they appear.
    const nextReds: Red[] = [];
    for (const r of s.reds) {
      const x = r.x / 256;
      const y = r.y / 256;
      const old = reds.find((o) => o.x === x && o.y < y && !nextReds.includes(o));
      nextReds.push({ x, y, noticeAt: old ? old.noticeAt : t + human.reactTicks() });
    }
    reds = nextReds;
    const redSpeed = s.redSpeed / 256;

    // ---- What the player wants to shoot (or catch). ----
    let want = finger;
    let chasing = false;
    // Drop (piercing power-up): falls straight down from where the saucer died.
    if (s.drop && s.drop.wait <= 0) {
      const key = `${s.drop.x}`;
      if (key !== dropKey) {
        dropKey = key;
        dropGo = human.chance(DROP[level]!);
        dropAt = t + human.reactTicks();
      }
      if (dropGo && t >= dropAt) {
        want = s.drop.x / 256 + human.aim(1);
        chasing = true;
      }
    }
    if (!chasing && seen.saucerDir !== 0) {
      const key = `${seen.saucerDir}:${Math.trunc(seen.tick / 600)}`;
      if (key !== saucerKey) {
        saucerKey = key;
        saucerGo = human.chance(SAUCER[level]!);
        saucerAt = t + human.reactTicks();
        saucerErr = human.normal();
      }
      if (saucerGo && t >= saucerAt) {
        // Lead it: where it will be when a bolt fired now gets up there (the lead is judged roughly).
        const flight = (BOLT_Y0 - SAUCER_Y) / BOLT_SPEED;
        const lead = seen.saucerDir * 2 * flight * (1 + human.p.judgement * saucerErr);
        const sx = seen.saucerX / 256 + seen.saucerDir * 2 * lag;
        const aim = sx + lead;
        // Worth it only while it can still be caught up with.
        if (aim > MIN_X - 10 && aim < MAX_X + 10 && Math.abs(aim - finger) < speed * flight) {
          want = aim;
          chasing = true;
        }
      }
    }
    if (!chasing && seen.boss) {
      if (bossAt < 0) bossAt = t + human.reactTicks();
      if (t >= bossAt) {
        if ((t & 63) === 0 || bossErr === 0) bossErr = human.normal();
        const flight = (BOLT_Y0 - 84 - 48) / BOLT_SPEED;
        const w = seen.x9 ? wavBossW(seen.boss) : WAV_BOSS_W;
        let offset = w / 2;
        let spread = w * 0.15;
        if (seen.x9) {
          // wavRev 9: weak points. Decide every half second: the core when it will be open as the bolt lands, else a cannon.
          const guns = seen.boss.guns ?? [0, 0];
          if ((t & 31) === 0 || bossMode < 0) {
            const open = wavCoreOpen(seen.boss, Math.round(t + flight + lag * (1 + human.normal() * 0.3)));
            bossMode = open && human.chance(CORE[level]!) ? 2 : guns.some((g) => g > 0) && human.chance(CANNON[level]!) ? (guns[0]! > 0 && (guns[1]! <= 0 || human.chance(0.5)) ? 0 : 1) : 3;
          }
          if (bossMode === 2) spread = human.p.aimSdPx * 0.8;
          else if ((bossMode === 0 || bossMode === 1) && guns[bossMode]! > 0) {
            offset = wavCannonX(seen.boss, bossMode);
            spread = human.p.aimSdPx * 0.8;
          }
        }
        const centre = seen.boss.x + offset + seen.boss.dir * lag;
        want = centre + seen.boss.dir * flight * (1 + human.p.judgement * bossErr) + bossErr * spread;
        chasing = true;
      }
    }
    if (!chasing && !seen.boss) {
      // Columns that still hold a shape the bolts can reach: grid columns, or (wavRev 4
      // shapes) each x a ship sits at, its lowest ship first. `cell` is that ship's slot.
      const live: { c: number; x: number; low: number; cell: number }[] = [];
      const form = wavForm(seen);
      if (form) {
        const byX = new Map<number, number>();
        seen.shapes.forEach((code, i) => {
          if (code === 0) return;
          const best = byX.get(form[i]![0]);
          if (best === undefined || form[i]![1] > form[best]![1]) byX.set(form[i]![0], i);
        });
        for (const [ox, cell] of [...byX].sort((a, b) => a[0] - b[0]))
          live.push({ c: ox, x: wavShapeBox(seen, cell).x + WAV_CELL / 2, low: form[cell]![1] / 36, cell });
      } else
        for (let c = 0; c < WAV_COLS; c++) {
          let low = -1;
          for (let r = Math.trunc(seen.shapes.length / WAV_COLS) - 1; r >= 0; r--) {
            const code = seen.shapes[r * WAV_COLS + c] ?? 0;
            if (code !== 0) {
              low = r;
              break;
            }
          }
          if (low >= 0) live.push({ c, x: wavShapeBox(seen, low * WAV_COLS + c).x + WAV_CELL / 2, low, cell: low * WAV_COLS + c });
        }
      const colLive = live.some((l) => l.c === col);
      if ((!colLive && col >= 0) || t >= rethinkAt) {
        if (!colLive && col >= 0 && t < rethinkAt) {
          // The column just emptied: notice it, then choose again.
          rethinkAt = t + human.reactTicks();
          col = -2;
        } else if (live.length > 0) {
          // Near columns first; the lowest shapes matter more as the formation comes down.
          const depth = seen.fy / 300;
          const values = live.map((l) => -Math.abs(l.x - finger) / 60 + l.low * depth);
          col = live[human.pick(values)]!.c;
          colErr = human.normal();
          rethinkAt = t + human.thinkTicks(900);
        }
      }
      const target = live.find((l) => l.c === col);
      if (target) {
        // March lead: one 8-px step every stepIn ticks, over the bolt's flight.
        const step = Math.max(6, seen.waveBase - Math.trunc(seen.waveKills / 3));
        const entering = (seen.enter ?? 0) > 0;
        const flight = (BOLT_Y0 - (wavShapeBox(seen, target.cell).y + WAV_CELL)) / BOLT_SPEED;
        const lead = entering ? 0 : ((seen.dir * 8) / step) * (flight + lag) * (1 + human.p.judgement * colErr);
        want = target.x + lead + colErr * human.p.aimSdPx;
      }
      // Divers in the air are targets too when they come past low and close.
      for (const d of seen.divers ?? []) {
        if (d.t > WAV_DIVE_TICKS || seen.shapes[d.cell] === 0) continue;
        const c = wavDiverCentre(d);
        if (c.y > 300 && c.y < 470 && Math.abs(c.x - finger) < 60) want = c.x;
      }
    }
    if (human.slip(0.01)) want += human.normal() * 40;

    // ---- Dodge: stand where no noticed bolt or diver will cross the ship soon. ----
    const horizon = LOOKAHEAD[level]!;
    const half = WAV_SHIP_W / 2 + 2;
    const margin = 6 + human.p.aimSdPx;
    /** Each threat: where it crosses the ship's line, how wide, and the ticks it spends there. */
    const threats: { x: number; w: number; t: number; out: number }[] = [];
    for (const r of reds) {
      if (t < r.noticeAt) continue;
      const tIn = (SHIP_TOP - (r.y + 12)) / redSpeed;
      const tOut = (WAV_SHIP_Y + WAV_SHIP_H / 2 - r.y) / redSpeed;
      if (tOut < -1 || tIn > horizon) continue;
      threats.push({ x: r.x, w: half + margin, t: tIn, out: tOut + 2 });
    }
    for (const d of s.divers ?? []) {
      if (s.shapes[d.cell] === 0) continue;
      const key = `${d.cell}:${d.x0}:${d.y0}`;
      if (!diverSeen.has(key)) diverSeen.set(key, t + human.reactTicks());
      if (t < diverSeen.get(key)!) continue;
      // Where it is (seen late) and roughly where it is heading.
      const old = history[Math.max(0, history.length - 1 - lag - 6)]!;
      const od = (old.divers ?? []).find((o) => o.cell === d.cell);
      const c = wavDiverCentre(d);
      const vx = od ? (d.x - od.x) / 256 / 6 : 0;
      const vy = od ? (d.y - od.y) / 256 / 6 : 4;
      if (c.y > WAV_SHIP_Y + WAV_SHIP_H || vy <= 0) continue;
      // It overlaps the ship's line while its centre is within (ship + diver) / 2 of the ship's y.
      const band = (WAV_SHIP_H + WAV_CELL) / 2;
      const tIn = (WAV_SHIP_Y - band - c.y) / Math.max(1, vy);
      const tOut = (WAV_SHIP_Y + band - c.y) / Math.max(1, vy);
      if (tIn > horizon + 10 || tOut < -1) continue;
      const xIn = c.x + vx * Math.max(0, tIn);
      const xOut = c.x + vx * Math.max(0, tOut);
      threats.push({ x: (xIn + xOut) / 2, w: (WAV_SHIP_W + WAV_CELL) / 2 + margin + Math.abs(xOut - xIn) / 2, t: tIn, out: tOut + 2 });
    }
    const safeAt = (x: number) => {
      const travel = (xx: number) => Math.abs(xx - finger) / speed;
      for (const th of threats) {
        // Standing in its path when it arrives, or crossing its path just as it arrives.
        if (Math.abs(th.x - x) < th.w) return false;
        const lo = Math.min(finger, x);
        const hi = Math.max(finger, x);
        if (th.x + th.w > lo && th.x - th.w < hi) {
          // The ship is inside its band between these two moments on the way across.
          const a = travel(Math.max(lo, Math.min(hi, th.x - th.w)));
          const b = travel(Math.max(lo, Math.min(hi, th.x + th.w)));
          if (Math.max(a, b) >= th.t - 1 && Math.min(a, b) <= th.out) return false;
        }
      }
      return true;
    };
    let target = Math.max(MIN_X, Math.min(MAX_X, want));
    if (!safeAt(target)) {
      let best = finger;
      let bestD = Infinity;
      for (let dx = 0; dx <= 200; dx += 6) {
        for (const sgn of [-1, 1]) {
          const x = target + sgn * dx;
          if (x < MIN_X || x > MAX_X) continue;
          if (safeAt(x) && dx < bestD) {
            bestD = dx;
            best = x;
          }
        }
        if (bestD < Infinity) break;
      }
      target = best;
    }

    finger += Math.max(-speed, Math.min(speed, target - finger));
    const a = Math.max(0, Math.min(WAV_WORLD_W, Math.round(finger)));
    if (a === sent) return null;
    sent = a;
    return { k: ARCADE_INPUT_DRAG, a, b: 0, c: 0, d: 0 };
  }, init);
};

