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
 *
 * wavRev 10 (the 200 expansion; every branch below reads `seen.x10`, so older stamps play exactly as before): the
 * bosses' weak points are aimed at by level (CORE, CANNON) on the gunship's or the mothership's own width, leading
 * the boss through its turns as the fixes do; without the fixes a player who counts the bolts in flight moves on
 * from a column they will empty (MOVE_ON; the fixes' COUNT_BOLTS does it with them), and saucers, worth skill points
 * on wavRev 10, are chased at every level the tables say (the elite's near-only saucer policy is wavRev 8's).
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

  WAV_SHIP_H,
  WAV_SHIP_W,
  wavShipY,
  wavBoltSpeedFp,
  WAV_ARMOUR_CODE,
  WAV_WORLD_W,
  type WavState,
} from "../../../src/lib/arcade/wavefront";
import type { SkillLevel } from "../human";
import { driveEvents, type SkillBot } from "../bot";

/** Finger top speed, px a tick (the world is 390 wide, so world px are phone px). */
const FINGER: Record<SkillLevel, number> = { weak: 20, average: 26, good: 32, great: 38, near: 44, elite: 47, perfect: 47 };
/** Chance of going for a saucer, and for its power-up drop. */
const SAUCER: Record<SkillLevel, number> = { weak: 0.2, average: 0.4, good: 0.6, great: 0.8, near: 0.9, elite: 1, perfect: 1 };
const DROP: Record<SkillLevel, number> = { weak: 0.3, average: 0.5, good: 0.7, great: 0.85, near: 0.95, elite: 1, perfect: 1 };
/** How far ahead (ticks) a player keeps track of incoming bolts when choosing where to stand. */
const LOOKAHEAD: Record<SkillLevel, number> = { weak: 22, average: 30, good: 38, great: 44, near: 50, elite: 53, perfect: 53 };

/** Fixes: chance per choice that the player counts the bolts already on their way (no third bolt at a column's last ship). */
const COUNT_BOLTS: Record<SkillLevel, number> = { weak: 0, average: 0.1, good: 0.3, great: 0.55, near: 0.8, elite: 0.9, perfect: 1 };
/** Fixes: chance per boss read that the player leads the boss through its turn at a wall. */
const BOUNCE_READ: Record<SkillLevel, number> = { weak: 0, average: 0.2, good: 0.4, great: 0.6, near: 0.8, elite: 0.9, perfect: 1 };
/** Fixes: levels that take a saucer only when it passes within SAUCER_NEAR px of the ship (elite policy). */
const CHEAP_SAUCER: Record<SkillLevel, boolean> = { weak: false, average: false, good: false, great: false, near: false, elite: true, perfect: true };
const SAUCER_NEAR = 60;
/** wavRev 10: chance of aiming at a boss's open core, and at a cannon still firing, when deciding. */
const CORE: Record<SkillLevel, number> = { weak: 0.05, average: 0.15, good: 0.4, great: 0.7, near: 0.9, elite: 1, perfect: 1 };
const CANNON: Record<SkillLevel, number> = { weak: 0.05, average: 0.1, good: 0.3, great: 0.55, near: 0.8, elite: 1, perfect: 1 };
/** wavRev 10 without the fixes: chance that, choosing a column, the player counts the bolts already in flight. */
const MOVE_ON: Record<SkillLevel, number> = { weak: 0.05, average: 0.15, good: 0.35, great: 0.6, near: 0.8, elite: 1, perfect: 1 };
const BOSS_MIN_X = 12;
const BOSS_MAX_X = WAV_WORLD_W - 12 - WAV_BOSS_W;

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

export const bot: SkillBot = ({ game, seed, human, fixes }) => {
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
  let bossBounce = false;
  let countBolts = false;
  let bossAt = -1;
  /** wavRev 10: what the player aims at on a boss (0/1 a cannon, 2 the core, 3 the hull), -1 undecided. */
  let bossMode = -1;
  /** wavRev 10 without the fixes: whether the player is counting bolts in flight (MOVE_ON), and when they next decide. */
  let moveOn = false;
  let moveOnAt = 0;

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
        // Elite and flawless (fixes): a saucer is one ship's worth; go for it only when it passes close by, so no
        // shot at the formation or the boss is lost to the chase.
        const reach = fixes && CHEAP_SAUCER[level] && !seen.x10 ? Math.min(speed * flight, SAUCER_NEAR) : speed * flight;
        if (aim > MIN_X - 10 && aim < MAX_X + 10 && Math.abs(aim - finger) < reach) {
          want = aim;
          chasing = true;
        }
      }
    }
    if (!chasing && seen.boss) {
      if (bossAt < 0) bossAt = t + human.reactTicks();
      if (t >= bossAt) {
        if ((t & 63) === 0 || bossErr === 0) {
          bossErr = human.normal();
          if (fixes) bossBounce = human.chance(BOUNCE_READ[level]);
        }
        const flight = (BOLT_Y0 - 84 - 48) / BOLT_SPEED;
        const w = seen.x10 ? wavBossW(seen.boss) : WAV_BOSS_W;
        let offset = w / 2;
        let spread = w * 0.15;
        let weak = false;
        if (seen.x10) {
          // wavRev 10: weak points. Decide every half second: the core when it will be open as the bolt lands, else a cannon.
          const guns = seen.boss.guns ?? [0, 0];
          if ((t & 31) === 0 || bossMode < 0) {
            const open = wavCoreOpen(seen.boss, Math.round(t + flight + lag * (1 + human.normal() * 0.3)));
            bossMode = open && human.chance(CORE[level]) ? 2 : guns.some((g) => g > 0) && human.chance(CANNON[level]) ? (guns[0]! > 0 && (guns[1]! <= 0 || human.chance(0.5)) ? 0 : 1) : 3;
          }
          if (bossMode === 2) {
            spread = human.p.aimSdPx * 0.8;
            weak = true;
          } else if ((bossMode === 0 || bossMode === 1) && guns[bossMode]! > 0) {
            offset = wavCannonX(seen.boss, bossMode);
            spread = human.p.aimSdPx * 0.8;
            weak = true;
          }
        }
        const centre = seen.boss.x + offset + seen.boss.dir * lag;
        want = centre + seen.boss.dir * flight * (1 + human.p.judgement * bossErr) + bossErr * spread;
        if (fixes && seen.x10) {
          // wavRev 10 with the fixes: the same lead through the boss's turns, on this boss's width and weak point.
          const ahead = (flight + lag) * (1 + human.p.judgement * bossErr);
          let x = seen.boss.x + seen.boss.dir * ahead;
          const maxX = WAV_WORLD_W - 12 - w;
          if (bossBounce) {
            if (x < BOSS_MIN_X) x = 2 * BOSS_MIN_X - x;
            if (x > maxX) x = 2 * maxX - x;
          }
          want = x + offset + bossErr * human.p.aimSdPx * (weak ? 0.8 : 2.1);
        } else if (fixes) {
          // Fixes: where the boss will be when the bolt arrives, through its turn at a wall for a player who reads it;
          // the aim's spread is the player's own (v1: 15 % of the boss's width at every level).
          const ahead = (flight + lag) * (1 + human.p.judgement * bossErr);
          let x = seen.boss.x + seen.boss.dir * ahead;
          if (bossBounce) {
            if (x < BOSS_MIN_X) x = 2 * BOSS_MIN_X - x;
            if (x > BOSS_MAX_X) x = 2 * BOSS_MAX_X - x;
          }
          want = x + WAV_BOSS_W / 2 + bossErr * human.p.aimSdPx * 2.1;
        }
        chasing = true;
      }
    }
    if (!chasing && !seen.boss) {
      // Columns that still hold a shape the bolts can reach: grid columns, or (wavRev 4
      // shapes) each x a ship sits at, its lowest ship first. `cell` is that ship's slot.
      let live: { c: number; x: number; low: number; cell: number }[] = [];
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
      // Fixes: a column whose ships the bolts already flying will finish is spent (for a player who counts them).
      if (fixes && countBolts) {
        const spent = (l: { c: number; x: number }) => {
          let need = 0;
          seen.shapes.forEach((code, i) => {
            if (code === 0) return;
            const bx = wavShapeBox(seen, i).x + WAV_CELL / 2;
            if (Math.abs(bx - l.x) < 1) need += code === WAV_ARMOUR_CODE ? 99 : 1;
          });
          const flying = seen.bolts.filter((b) => !b.p && Math.abs(b.x / 256 - l.x) < WAV_CELL / 2 - 2).length;
          return flying >= need;
        };
        for (let k = live.length - 1; k >= 0; k--) if (live.length > 1 && spent(live[k]!)) live.splice(k, 1);
      }
      if (seen.x10 && !fixes && live.length > 1) {
        // wavRev 10 without the fixes: a column whose ships are all already covered by bolts in flight is spent.
        if (t >= moveOnAt) {
          moveOn = human.chance(MOVE_ON[level]);
          moveOnAt = t + human.thinkTicks(700);
        }
        if (moveOn) {
          const formNow = wavForm(seen);
          const spent = (l: { c: number; x: number }) => {
            let ships = 0;
            seen.shapes.forEach((code, i) => {
              if (code !== 0 && (formNow ? formNow[i]![0] === l.c : i % WAV_COLS === l.c)) ships++;
            });
            const up = seen.bolts.filter((b) => !b.sd && Math.abs(b.x / 256 - l.x) < WAV_CELL / 2 + 2).length;
            return up >= ships;
          };
          const fresh = live.filter((l) => !spent(l));
          if (fresh.length) live = fresh;
        }
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
          if (fixes) countBolts = human.chance(COUNT_BOLTS[level]);
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

