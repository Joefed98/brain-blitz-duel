/**
 * Roofbound: a runner on the floor or ceiling; a tap flips it across (immune
 * while in the air). The human reads the corridor ahead on screen (300 px in
 * front of the runner); a hazard only counts once they have reacted to it
 * (a reaction time, lapses included, after it comes into view).
 * Over the stretch they have processed, they know which flip moments keep
 * them alive (computed exactly on the sim, standing in for experience: no
 * flip needed, or the window of ticks in which the next flip works). They aim
 * at the middle of the remaining window, commit about a reaction time before,
 * and tap with the level's timing jitter (wider when judged further ahead).
 * Crumbling tiles are just hazards with a fuse: the window covers stepping on
 * and flipping off in time. Gold stars: on first sight the player decides
 * whether to go for one; if a route over the known stretch takes it, they
 * plan for that, otherwise they let it go. Slips: a flip well off its moment.
 *
 * flipRev 7 (the expansion): the same player, on the course's own tick-by-tick x. Star
 * trails are planned like stars (decided on first sight, kept only while a route takes all
 * five; the window that takes them is narrow, so timing jitter costs trail stars). Double
 * flips are tried after a landing next to a hazard (more often the better the player, after
 * a short delay drawn per try) when a quick flip there keeps a route alive. Checkpoint saves
 * and speed zones need nothing extra: the sim handles them.
 */
import {
  FLIP_INPUT_TAP,
  FLIP_RUNNER_HALF_PX_V2,
  FLIP_RUN_TICKS,
  FLIP_WORLD_W,
  flipSpeed,
  type FlipState,
} from "../../../src/lib/arcade/flip";
import { driveEvents, type SkillBot } from "../bot";

const FP = 256;
/** The runner sits 90 px from the left of a 390-px corridor: 300 px of track are in view ahead. */
const VIEW_AHEAD = (FLIP_WORLD_W - 90) * FP;
const HALF = FLIP_RUNNER_HALF_PX_V2 * FP;
/** Chance of deciding to go for a star when it comes into view. */
const STAR_TRY: Record<string, number> = { average: 0.5, good: 0.7, great: 0.85, near: 0.95 };
/** Rev 7: chance of going for a star trail, and of trying a double flip after a landing near a hazard. */
const TRAIL_TRY: Record<string, number> = { average: 0.35, good: 0.6, great: 0.8, near: 0.95 };
const COMBO_TRY: Record<string, number> = { average: 0.1, good: 0.3, great: 0.55, near: 0.8 };
const FULL_TRAIL = 31;
const TAP = { k: FLIP_INPUT_TAP, a: 0, b: 0, c: 0, d: 0 };

export const bot: SkillBot = ({ game, seed, human }) => {
  const level = human.level;
  const lag = human.lagTicks();
  const commitLead = Math.round(human.p.reactionMs[0] / (1000 / 60));
  const init = game.init(seed) as FlipState;
  /** Per segment / star: the tick its reaction completes (known to the player from then). */
  const segReady: number[] = [];
  const starReady: number[] = [];
  const starWant: boolean[] = [];
  let pending: number | null = null;
  /** Current plan: absolute tap window [a, b], or null when no flip is needed. */
  let window: [number, number] | null = null;
  let dirty = true;
  /** When the plan's known stretch runs short, it is looked at again. */
  let replanAt = 0;
  let lastFlipT = 0;
  const v7 = init.v7 ?? null;
  const trails = v7?.trails ?? [];
  const trailReady: number[] = [];
  const trailWant: boolean[] = [];
  /** Rev 7: the tick a double flip is tried at, after a landing. */
  let comboAt: number | null = null;
  const stepX = (tick: number) => (v7 ? v7.xs[tick]! - v7.xs[tick - 1]! : flipSpeed(tick));

  /**
   * Exact feasibility over the known stretch: from state s (tick t-1), layer k holds the
   * states after k more ticks. Returns whether no tap is needed, and the first window of
   * tap ticks for the next flip that keeps a route alive (and takes the wanted star).
   */
  const solve = (
    s: FlipState,
    t: number,
    H: number,
    star: number,
    trail = -1,
  ): { idle: boolean; win: [number, number] | null; alive: boolean } => {
    const goal = (st: FlipState) =>
      (star < 0 || ((st.got ?? 0) & (1 << star)) !== 0) && (trail < 0 || (st.trailGot?.[trail] ?? 0) === FULL_TRAIL);
    type Node = { s: FlipState; kids: [number, number] };
    const layers: Node[][] = [[{ s, kids: [-1, -1] }]];
    for (let k = 0; k < H; k++) {
      const next: Node[] = [];
      const idx = new Map<string, number>();
      for (const node of layers[k]!) {
        if (node.s.ended === 1) continue;
        for (const tap of [0, 1]) {
          if (tap && node.s.flipT !== 0) continue;
          const ns = game.step(node.s, tap ? { ...TAP, t: t + k } : null) as FlipState;
          // Rev 7: a checkpoint's save is a crash too (the player never plans one).
          if (ns.ended === 2 || (ns.saves ?? 0) > (s.saves ?? 0)) continue;
          const c = ns.cracks ?? [];
          const key = `${ns.side}:${ns.flipT}:${c.at(-2)}:${c.at(-1)}:${star >= 0 ? (ns.got ?? 0) & (1 << star) : 0}:${ns.ended}` +
            (v7 ? `:${ns.arcN}:${trail >= 0 ? ns.trailGot![trail] : 0}:${ns.inv}:${ns.save}` : "");
          let at = idx.get(key);
          if (at === undefined) {
            at = next.length;
            idx.set(key, at);
            next.push({ s: ns, kids: [-1, -1] });
          }
          node.kids[tap] = at;
        }
      }
      layers.push(next);
      if (!next.length) break;
    }
    // Alive back-propagation (a finished run counts as alive).
    const alive: boolean[][] = layers.map((l) => l.map(() => false));
    for (let k = layers.length - 1; k >= 0; k--) {
      layers[k]!.forEach((node, i) => {
        const ok =
          node.s.ended === 1 ||
          (k === layers.length - 1 &&
            layers.length === H + 1 &&
            goal(node.s));
        alive[k]![i] = ok || node.kids.some((c) => c >= 0 && alive[k + 1]![c]!);
      });
    }
    // Walk the no-tap chain.
    // Windows of good flip ticks along the no-tap chain; the player goes for the widest
    // (the most comfortable), not a hair-trigger one.
    let ci = 0;
    let win: [number, number] | null = null;
    let cur: [number, number] | null = null;
    for (let k = 0; k < layers.length - 1 && ci >= 0; k++) {
      const node = layers[k]![ci]!;
      const tk = node.kids[1];
      if (tk >= 0 && alive[k + 1]![tk]!) {
        if (cur && cur[1] === t + k - 1) cur[1] = t + k;
        else cur = [t + k, t + k];
        if (!win || cur[1] - cur[0] > win[1] - win[0]) win = [cur[0], cur[1]];
      }
      ci = node.kids[0];
    }
    // Idle: the no-tap chain itself stays alive to the end of the known stretch.
    let idle = true;
    ci = 0;
    for (let k = 0; k < layers.length - 1; k++) {
      if (layers[k]![ci]!.s.ended === 1) break;
      const n = layers[k]![ci]!.kids[0];
      if (n < 0 || !alive[k + 1]![n]) {
        idle = false;
        break;
      }
      ci = n;
    }
    return { idle, win, alive: alive[0]![0] ?? false };
  };

  return driveEvents(
    game,
    (s: FlipState, t) => {
      // New things coming into view: each is processed a reaction after it appears on screen.
      // The later parts of a recognised pattern (an overhang pair, offset spikes) are expected:
      // they only need the tracking lag once the pattern's first part has been processed.
      const edge = s.x + VIEW_AHEAD;
      for (let i = segReady.length; i < s.segs.length && s.segs[i]!.x0 <= edge; i++) {
        const seg = s.segs[i]!;
        const prev = i > 0 ? s.segs[i - 1]! : null;
        const sameGroup = prev !== null && prev.group === seg.group && seg.group !== 0;
        segReady.push(sameGroup ? Math.max(segReady[i - 1]!, t + lag) : t + human.reactTicks());
        dirty = true;
      }
      const stars = s.stars ?? [];
      for (let i = starReady.length; i < stars.length && stars[i]!.x <= edge; i++) {
        starReady.push(t + human.reactTicks());
        starWant.push(human.chance(STAR_TRY[level]!));
      }
      for (let i = trailReady.length; i < trails.length && trails[i]!.launch <= edge; i++) {
        trailReady.push(t + human.reactTicks());
        trailWant.push(human.chance(TRAIL_TRY[level]!));
      }
      for (let i = 0; i < segReady.length; i++) if (segReady[i] === t) dirty = true;
      if (v7 && s.flipT === 0 && lastFlipT > 0 && human.chance(COMBO_TRY[level]!)) comboAt = t + human.int(1, 6);
      if ((s.flipT === 0 && lastFlipT > 0) || t >= replanAt) dirty = true;
      lastFlipT = s.flipT;

      if (dirty && pending === null) {
        dirty = false;
        // Known stretch: up to the first hazard not yet processed (or the edge of view).
        let known = edge;
        for (let i = s.cursor; i < s.segs.length; i++) {
          if (i >= segReady.length || segReady[i]! > t) {
            known = Math.min(known, s.segs[i]!.x0 - FP);
            break;
          }
        }
        // Ticks until the runner's front reaches the end of the known stretch.
        let H = 0;
        let x = s.x;
        while (
          H < 120 &&
          s.tick + H < FLIP_RUN_TICKS &&
          x + stepX(s.tick + H + 1) + HALF < known
        ) {
          H++;
          x += stepX(s.tick + H);
        }
        // The next wanted star (processed, ahead, not taken) inside the known stretch.
        let star = -1;
        for (let i = 0; i < stars.length; i++) {
          if ((s.got ?? 0) & (1 << i) || !starWant[i] || (starReady[i] ?? Infinity) > t) continue;
          if (stars[i]!.x + HALF < s.x) continue;
          if (stars[i]!.x <= known) star = i;
          break;
        }
        // Rev 7: the next wanted trail (processed, not passed, its stars inside the known stretch).
        let trail = -1;
        for (let i = 0; i < trails.length; i++) {
          if (!trailWant[i] || (trailReady[i] ?? Infinity) > t || s.tick > trails[i]!.t1) continue;
          if ((s.trailGot?.[i] ?? 0) === FULL_TRAIL) continue;
          if (trails[i]!.x[4]! + HALF <= known) trail = i;
          break;
        }
        replanAt = t + Math.max(4, Math.floor(H / 3));
        let plan = solve(s, t, H, star, trail);
        if (trail >= 0 && !plan.idle && !plan.win) {
          trailWant[trail] = false;
          plan = solve(s, t, H, star);
        }
        if (star >= 0 && !plan.idle && !plan.win) {
          starWant[star] = false;
          plan = solve(s, t, H, -1);
        }
        window = plan.idle ? null : plan.win;
        if (!plan.idle && !plan.win) window = null;
      }

      // Rev 7 double flip: a quick flip after landing, if one here counts and keeps a route alive.
      if (v7 && comboAt !== null && t >= comboAt) {
        const at = comboAt;
        comboAt = null;
        if (pending === null && s.flipT === 0 && t <= at + 1) {
          const next = game.step(s, { ...TAP, t }) as FlipState;
          if (next.ended !== 2 && (next.combos ?? 0) > (s.combos ?? 0)) {
            let H = 0;
            let x = next.x;
            while (H < 60 && next.tick + H < FLIP_RUN_TICKS && x + stepX(next.tick + H + 1) + HALF < s.x + VIEW_AHEAD) {
              H++;
              x += stepX(next.tick + H);
            }
            if (solve(next, t + 1, H, -1).alive) {
              window = null;
              dirty = true;
              return TAP;
            }
          }
        }
      }
      if (pending === null && window && s.flipT === 0) {
        const a = Math.max(window[0], t);
        const b = window[1];
        if (b < t) {
          window = null;
          dirty = true;
        } else {
          const aim = (a + b) / 2;
          if (aim - t <= commitLead) {
            const ahead = aim - t;
            let err = human.timingMs(1 + ahead / 60) / (1000 / 60);
            if (human.slip(0.5)) err += (human.chance(0.5) ? 1 : -1) * human.int(5, 12);
            pending = Math.max(t, Math.round(aim + err));
            window = null;
          }
        }
      }
      if (pending !== null && t >= pending) {
        if (s.flipT !== 0) return null;
        pending = null;
        dirty = true;
        return TAP;
      }
      return null;
    },
    init,
  );
};
