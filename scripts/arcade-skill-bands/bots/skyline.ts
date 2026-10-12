/**
 * High Rise: drop the sliding block when it is over the tower. The drop is an
 * anticipated moment: the human watches the block (late, by the tracking lag),
 * judges when its left edge will line up with the top block from how it is
 * moving (a gust already blowing is seen; one that starts after they commit is
 * not), commits about a reaction time before that moment, and taps with the
 * level's timing jitter, wider as the slide speeds up. A new block is expected
 * (it always comes from the far side), so it only needs to be seen moving
 * before the drop is judged; if the first pass comes too soon after it
 * appears, the drop is rushed (wider jitter) or, when far too soon, left for
 * the return pass. Slips: now and then a drop goes well off its moment.
 */
import {
  SKYLINE_GUST_SPEED,
  SKYLINE_SPEED_START,
  SKYLINE_WORLD_RIGHT,
  skylineGustAt,
  skylineSpeed,
  type SkylineState,
} from "../../../src/lib/arcade/skyline";
import { driveTaps, type SkillBot } from "../bot";

const TICK_MS = 1000 / 60;

/** Predicted tick (fractional) on which the tap should land so the block sits at the tower's x. */
function alignTick(seen: SkylineState, from: number): number | null {
  const below = seen.blocks[seen.blocks.length - 1]!;
  const target = below.x;
  const v0 = skylineSpeed(seen.placed);
  const gust = skylineGustAt(seen, seen.tick) * SKYLINE_GUST_SPEED;
  let x = seen.x;
  let dir = seen.dir;
  for (let j = 1; j < 600; j++) {
    let nx = x + dir * v0 + gust;
    let ndir = dir;
    if (nx <= 0) {
      nx = 0;
      ndir = 1;
    } else if (nx + seen.w >= SKYLINE_WORLD_RIGHT) {
      nx = SKYLINE_WORLD_RIGHT - seen.w;
      ndir = -1;
    }
    if ((x - target) * (nx - target) <= 0 && nx !== x) {
      const frac = (target - x) / (nx - x);
      // The block is at nx after tick seen.tick + j; a tap on the following tick drops it there.
      const tapAt = seen.tick + j + frac;
      if (tapAt >= from) return tapAt;
    }
    x = nx;
    dir = ndir;
  }
  return null;
}

export const bot: SkillBot = ({ game, seed, human }) => {
  const lag = human.lagTicks();
  const commitLead = Math.round(human.p.reactionMs[0] / TICK_MS);
  const history: SkylineState[] = [];
  let spawnTick = 0;
  let placed = 0;
  let skipBefore = 0;
  let pending: number | null = null;
  const init = game.init(seed) as SkylineState;
  return driveTaps(game, (s: SkylineState, t) => {
    history.push(s);
    if (s.placed !== placed) {
      placed = s.placed;
      spawnTick = s.tick;
      skipBefore = 0;
      pending = null;
    }
    const seen = history[Math.max(0, history.length - 1 - lag)]!;
    if (pending === null && seen.placed === s.placed && seen.tick >= spawnTick) {
      const at = alignTick(seen, Math.max(t, skipBefore));
      if (at !== null && at - t <= commitLead) {
        // Seen moving for how long before committing; too short means a rushed (or skipped) drop.
        const watched = t - spawnTick;
        const scale = Math.sqrt(skylineSpeed(s.placed) / SKYLINE_SPEED_START);
        if (watched >= lag + commitLead / 2 || skipBefore > 0) {
          const rushed = watched < lag + commitLead;
          let err = human.timingMs(scale * (rushed ? 1.4 : 1)) / TICK_MS;
          if (human.slip(0.5)) err += (human.chance(0.5) ? 1 : -1) * human.int(4, 10);
          pending = Math.max(t, Math.round(at + err));
        } else skipBefore = at + 1;
      }
    }
    if (pending !== null && t >= pending) {
      pending = null;
      return true;
    }
    return false;
  }, init);
};
