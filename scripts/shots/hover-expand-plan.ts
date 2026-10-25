/**
 * The scripted run behind the Hover hoverRev 8 review screenshots (scripts/shots/hover-expand-shots.ts):
 * the flawless skill-band player on a seed, from the tick the page hands over control (no tap
 * before it), and the ticks where each new feature is in view. Prints JSON: { taps, shots }.
 *
 *   bun scripts/shots/hover-expand-plan.ts [seed] [quietUntil]
 */
import type { ArcadeGame } from "../../src/lib/arcade/engine";
import { hoverGameFor, HOVER_DISC_X, HOVER_PILLAR_W, HOVER_REV_EXPAND, pillarX, type HoverState } from "../../src/lib/arcade/hover";
import { bot } from "../arcade-skill-bands/bots/hover";
import { PerfectHuman } from "../hover-expand-record";

export function hoverShotPlan(seed = 1, quietUntil = 0) {
  const base = hoverGameFor(HOVER_REV_EXPAND);
  // The page's run has had no tap up to `quietUntil`: the planner flies the same course from there.
  const game: ArcadeGame<HoverState> = { ...base, step: (s, tap) => base.step(s, s.tick + 1 <= quietUntil ? false : tap) };
  const taps = (bot({ game, seed, rev: HOVER_REV_EXPAND, human: new PerfectHuman(seed) }).taps ?? []).filter((t) => t > quietUntil);
  const set = new Set(taps);
  let s = game.init(seed) as HoverState;
  const shots: Record<string, number> = {};
  while (!game.isOver(s)) {
    const prev = s;
    s = game.step(s, set.has(s.tick + 1)) as HoverState;
    const ahead = s.pillars[s.gates];
    // Threading a tight gate: the saucer in the middle of the barrier.
    if (!shots.tight && ahead?.tightTop !== undefined && (s.tightOn ?? -1) === s.gates && pillarX(ahead, s.distance) + HOVER_PILLAR_W / 2 <= HOVER_DISC_X) shots.tight = s.tick;
    // A complete chain half swept.
    if (!shots.chain && (s.chainHits?.length ?? 0) > (prev.chainHits?.length ?? 0)) {
      const c = s.chainHits!.at(-1)! >> 3;
      const chain = s.chains![c]!;
      if (s.chainHits!.filter((h) => h >> 3 === c).length === 2 && chain.stars.length >= 5) shots.chain = s.tick + 2;
    }
    if (!shots.held && (s.pickupsTaken?.length ?? 0) > (prev.pickupsTaken?.length ?? 0)) {
      shots.held = s.tick + 30;
      shots.bubble = Math.max(quietUntil + 1, s.tick - 45);
    }
  }
  const final = { score: game.score(s), tight: s.tight, chains: s.chainsDone, crashed: s.crashed };
  // The shield breaking: the same run with no tap once the shield is held, so the saucer drops into
  // whatever is below it (a barrier or the floor) with the shield up.
  let breakTaps: number[] | null = null;
  if (shots.held) {
    breakTaps = taps.filter((t) => t <= shots.held!);
    const cut = new Set(breakTaps);
    let c = game.init(seed) as HoverState;
    while (!game.isOver(c) && !c.shieldBreaks) c = game.step(c, cut.has(c.tick + 1)) as HoverState;
    if (c.shieldBreaks) shots.break = c.tick + 6;
  }
  return { taps, breakTaps, shots, final };
}

if (import.meta.main) console.log(JSON.stringify(hoverShotPlan(Number(process.argv[2] ?? 1), Number(process.argv[3] ?? 0))));
