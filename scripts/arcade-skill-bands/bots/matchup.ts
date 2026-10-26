/**
 * Gemstone: a human scans the board for a swap, swipes it, watches it resolve
 * and scans again.
 *
 * Scanning: every legal swap on the board the player is looking at gets a
 * random place in the player's scan order (special gems catch the eye, so they
 * come up earlier). The first find takes an orientation time plus that place ×
 * a whole-board scan time, so a board with few moves takes longer, and both
 * shrink with skill (thinkTicks). Weaker players take the first match they see;
 * better ones keep looking a little longer and compare what they found, valued
 * in game terms (gems cleared now, specials made) with blurred judgement. Only
 * the swap's own clear is valued: nobody here plans cascades.
 *
 * Constant play: the board is read once it looks settled (the phone's
 * animation of the last step has finished). Better players more often start
 * on the board while a cascade is still falling; if a later cascade step
 * breaks the move they found, they usually notice and look again, otherwise
 * the swipe is wasted (it swaps back). After five seconds without a scoring
 * swap the game's hint appears and the player takes it, one reaction later.
 */
import { msToTicks } from "../human";
import {
  matchupAnimationDuration,
  matchupConstantPlay,
  matchupHintSwap,
  matchupIndex,
  matchupRowsOf,
  MATCHUP_TREASURE,
  matchupIsJackpot,
  MATCHUP_BOMB,
  MATCHUP_CROSS,
  MATCHUP_HINT_TICKS,
  MATCHUP_INPUT_SWAP,
  MATCHUP_ROWS,
  MATCHUP_SIZE,
  MATCHUP_STAR,
  MATCHUP_V3_SWAP_MS,
  type MatchupState,
} from "../../../src/lib/arcade/matchup";
import type { SkillLevel } from "../human";
import { driveEvents, Plan, type SkillBot } from "../bot";

/** Orientation before the first find, and a whole-board scan, for an average player (ms). */
const ORIENT_MS = 500;
const SCAN_MS = 4500;
/** How much further (fraction of a whole-board scan) a player keeps looking after the first find. */
const EXTRA_SCAN: Record<SkillLevel, number> = { weak: 0, average: 0.02, good: 0.06, great: 0.1, near: 0.14, elite: 0.16, perfect: 0.2 };
/** Chance of reading the board while a cascade is still falling instead of waiting for it to settle. */
const PLAY_THROUGH: Record<SkillLevel, number> = { weak: 0, average: 0.15, good: 0.35, great: 0.6, near: 0.8, elite: 0.88, perfect: 1 };
/** Players who know the game favour moves low on the board (they shake more loose); weight per level. */
const LOW_BIAS: Record<SkillLevel, number> = { weak: 0, average: 0, good: 0.3, great: 0.6, near: 0.8, elite: 0.9, perfect: 1 };
/** Chance of following a swap straight up with a second move spotted in the same look. */
const FOLLOW_UP: Record<SkillLevel, number> = { weak: 0, average: 0.1, good: 0.3, great: 0.5, near: 0.7, elite: 0.78, perfect: 1 };
/** Swipe: from decision to the swap landing on the board, ms. */
const SWIPE_MS = 140;
/**
 * matchupRev 9: how much a player weighs the features they can see in a swap's own clear (goal gems,
 * ice under it, gems cleared below the treasure gem) against plain clearing; weaker players mostly just match.
 */
const FEATURE_EYE: Record<SkillLevel, number> = { weak: 0, average: 0.15, good: 0.45, great: 0.8, near: 1.2, elite: 1.3, perfect: 1.4 };
/**
 * Competence fix (ctx.fixes, Oct 2026), matchupRev 9: the treasure gem (a gold medallion, 12 feature points
 * when it reaches the bottom) is the board's biggest prize, and a player chasing it looks at its column first,
 * so a move that clears gems under it is found early in the scan. The v1 bot scanned the board in a random
 * order and collected about 0.3 of up to 8 treasures a run even at near-perfect. The chance a scan starts there.
 */
const TREASURE_HUNT: Record<SkillLevel, number> = { weak: 0, average: 0.1, good: 0.3, great: 0.55, near: 0.8, elite: 0.9, perfect: 1 };
/**
 * When no single swap clears a gem under the treasure (it often sticks a row or two above the bottom), a
 * strong player sets one up: a swap that leaves a line under it for the next move. The chance, per such
 * scan, that the player works one out (two-move planning on the treasure's column only).
 */
const TREASURE_SETUP: Record<SkillLevel, number> = { weak: 0, average: 0, good: 0.1, great: 0.3, near: 0.6, elite: 0.75, perfect: 1 };
/** How much a set-up swap is worth to the player, in gems: about what the treasure is worth against plain clearing. */
const SETUP_VALUE = 8;

type Move = [number, number, number, number];
const special = (k: number) => k === MATCHUP_BOMB || k === MATCHUP_CROSS || k === MATCHUP_STAR || matchupIsJackpot(k);

function allSwaps(rows = MATCHUP_ROWS): Move[] {
  const out: Move[] = [];
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < MATCHUP_SIZE; c++) {
      if (c + 1 < MATCHUP_SIZE) out.push([r, c, r, c + 1]);
      if (r + 1 < rows) out.push([r, c, r + 1, c]);
    }
  return out;
}

export const bot: SkillBot = ({ game, seed, human, fixes }) => {
  const level = human.level;
  const plan = new Plan();
  const init = game.init(seed) as MatchupState;
  const constant = matchupConstantPlay(init);
  const ROWS = matchupRowsOf(init.cells);
  const SWAPS = allSwaps(ROWS);
  const eyeFor = init.goals ? FEATURE_EYE[level]! : 0;
  /** matchupRev 9: what a swap's own clear does for the goals, the ice and the treasure gem, as the player sees it. */
  const featureValue = (s: MatchupState, cleared: readonly number[]): number => {
    if (!eyeFor) return 0;
    const treasure = s.cells.indexOf(MATCHUP_TREASURE);
    let v = 0;
    for (const i of cleared) {
      const kind = s.cells[i] ?? -1;
      if (kind >= 0 && kind < 6 && (s.goalLeft?.[kind] ?? 0) > 0) v += 0.8;
      if (s.ice?.[i]) v += 2.5;
      if (treasure >= 0 && i % MATCHUP_SIZE === treasure % MATCHUP_SIZE && i > treasure) v += 4;
    }
    return eyeFor * v;
  };
  /** Tick the phone finishes animating the latest step. */
  let animEnd = 0;
  let serial = init.resolveSerial ?? 0;
  let swaps = init.swaps;
  let phase: "wait" | "scan" | "swipe" = "wait";
  let scanFrom = human.reactTicks() + human.thinkTicks(400);
  let decideAt = 0;
  let snapshot: number[] = [];
  let chosen: Move | null = null;
  let backup: Move | null = null;
  let useBackup = false;
  let throughCascade = false;
  let waiting = false;

  const valid = (s: MatchupState, m: Move) => game.step(s, { t: s.tick + 1, k: MATCHUP_INPUT_SWAP, a: m[0], b: m[1], c: m[2], d: m[3] }).swaps > s.swaps;

  /** The board as last seen at rest; cells that differ from it are still animating. */
  let view = [...init.cells];

  const startScan = (s: MatchupState, t: number, settled: boolean) => {
    snapshot = [...s.cells];
    const found: { m: Move; u: number; value: number }[] = [];
    const treasureAt = s.goals ? s.cells.indexOf(MATCHUP_TREASURE) : -1;
    const hunt = Boolean(fixes) && treasureAt >= 0 && human.chance(TREASURE_HUNT[level]!);
    const under = (cleared: readonly number[]) => cleared.some((i) => i % MATCHUP_SIZE === treasureAt % MATCHUP_SIZE && i > treasureAt);
    for (const m of SWAPS) {
      const after = game.step(s, { t: s.tick + 1, k: MATCHUP_INPUT_SWAP, a: m[0], b: m[1], c: m[2], d: m[3] }) as MatchupState;
      if (after.swaps === s.swaps) continue;
      // Reading through a cascade: gems still moving cannot be part of a move the player sees.
      if (!settled && [matchupIndex(m[0], m[1]), matchupIndex(m[2], m[3]), ...after.lastCleared].some((i) => s.cells[i] !== view[i])) continue;
      const step0 = after.lastAnimation[0];
      // Gems cleared now and specials made; players who know the game favour moves low on the board.
      const low = Math.max(m[0], m[2]) / (ROWS - 1);
      const value = after.lastCleared.length + 5 * (step0?.created.length ?? 0) + 2 * LOW_BIAS[level]! * low + featureValue(s, step0?.cleared ?? []);
      const eye = special(s.cells[matchupIndex(m[0], m[1])]!) || special(s.cells[matchupIndex(m[2], m[3])]!);
      const look = hunt && under(step0?.cleared ?? []) ? 0.25 : 1;
      found.push({ m, u: human.u() * (eye ? 0.5 : 1) * look, value });
    }
    if (found.length === 0) {
      scanFrom = t + human.reactTicks();
      return;
    }
    if (hunt && treasureAt < (ROWS - 1) * MATCHUP_SIZE && human.chance(TREASURE_SETUP[level]!)) {
      // No swap clears under the treasure now: look for one that sets up the next swap to.
      const stuck = !found.some((f) => {
        const a = game.step(s, { t: s.tick + 1, k: MATCHUP_INPUT_SWAP, a: f.m[0], b: f.m[1], c: f.m[2], d: f.m[3] }) as MatchupState;
        return under(a.lastAnimation[0]?.cleared ?? []);
      });
      if (stuck) {
        const col = treasureAt % MATCHUP_SIZE;
        const row = Math.floor(treasureAt / MATCHUP_SIZE);
        const near = SWAPS.filter((m) => Math.min(m[0], m[2]) > row && Math.abs(m[1] - col) <= 2 && Math.abs(m[3] - col) <= 2);
        for (const f of found) {
          const a1 = game.step(s, { t: s.tick + 1, k: MATCHUP_INPUT_SWAP, a: f.m[0], b: f.m[1], c: f.m[2], d: f.m[3] }) as MatchupState;
          const t1 = a1.cells.indexOf(MATCHUP_TREASURE);
          if (t1 !== treasureAt) continue;
          const ready = { ...a1, tick: Math.max(a1.tick, (a1.busyUntil ?? 0) - 1) } as MatchupState;
          const sets = near.some((m) => {
            const a2 = game.step(ready, { t: ready.tick + 1, k: MATCHUP_INPUT_SWAP, a: m[0], b: m[1], c: m[2], d: m[3] }) as MatchupState;
            return a2.swaps > ready.swaps && under(a2.lastAnimation[0]?.cleared ?? []);
          });
          if (sets) {
            f.value += SETUP_VALUE;
            f.u *= 0.25;
          }
        }
      }
    }
    found.sort((a, b) => a.u - b.u);
    const full = human.thinkTicks(SCAN_MS);
    const stopAt = found[0]!.u + EXTRA_SCAN[level]!;
    const seen = found.filter((f) => f.u <= stopAt);
    const k = human.pick(seen.map((f) => f.value));
    chosen = seen[k]!.m;
    // A second move spotted on the way is remembered for straight after this one.
    const rest = seen.filter((_, i) => i !== k);
    backup = rest.length ? rest[human.pick(rest.map((f) => f.value))]!.m : null;
    decideAt = t + human.thinkTicks(ORIENT_MS) + Math.round(Math.min(1, stopAt) * full);
    // The hint shows after five seconds without a scoring swap; a player still looking takes it.
    const hintSeen = s.lastScoreTick + MATCHUP_HINT_TICKS + human.reactTicks();
    if (decideAt > hintSeen) {
      decideAt = Math.max(t + 1, hintSeen);
      chosen = null;
    }
    phase = "scan";
  };

  const { events } = driveEvents(game, (s: MatchupState, t) => {
    // Follow what the phone shows: each resolution step animates for its own duration.
    const sNow = s.resolveSerial ?? 0;
    if (s.swaps !== swaps || sNow !== serial) {
      const fromSwap = s.swaps !== swaps;
      animEnd = s.tick + Math.ceil((((fromSwap ? MATCHUP_V3_SWAP_MS : 0) + matchupAnimationDuration(s.lastAnimation, s)) * 60) / 1000);
      if (fromSwap) {
        // The player's own swap: watch it land, then (maybe) read through the cascade.
        throughCascade = constant && human.chance(PLAY_THROUGH[level]!);
        useBackup = constant && backup !== null && human.chance(FOLLOW_UP[level]!);
        if (useBackup) throughCascade = true;
        phase = "wait";
        // Reading through: look at the rest of the board once the swap tween is over.
        // (their own swap is no surprise, so no reaction), else once it has finished falling.
        scanFrom = throughCascade ? s.tick + msToTicks(MATCHUP_V3_SWAP_MS) : animEnd + human.reactTicks();
      }
      swaps = s.swaps;
      serial = sNow;
    }
    const settled = !(s.pendingTick ?? 0) && s.tick >= animEnd;
    if (settled) view = s.cells;
    if (phase === "wait" && useBackup && t >= scanFrom) {
      // Follow up with the remembered move if the gems it needs have not moved.
      useBackup = false;
      const b = backup!;
      backup = null;
      const cells = [matchupIndex(b[0], b[1]), matchupIndex(b[2], b[3])];
      if (cells.every((i) => s.cells[i] === snapshot[i]) && valid(s, b)) {
        chosen = b;
        decideAt = t;
        phase = "scan";
      }
    }
    if (phase === "wait") {
      if (t >= scanFrom && !settled && !throughCascade) waiting = true;
      else if (waiting && settled) {
        // Noticing the board has come to rest takes a reaction.
        waiting = false;
        scanFrom = t + human.reactTicks();
      } else if (t >= scanFrom && (settled || throughCascade)) startScan(s, t, settled);
    }
    if (phase === "scan" && t >= decideAt) {
      let move = chosen ?? (() => {
        const h = matchupHintSwap(s);
        return h ? ([h.row1, h.col1, h.row2, h.col2] as Move) : null;
      })();
      if (move && !valid(s, move)) {
        const changed = s.cells.some((v, i) => v !== snapshot[i]);
        if (changed && !human.slip(3)) {
          // The board moved under the plan: look again.
          phase = "wait";
          scanFrom = t + human.reactTicks();
          return null;
        }
      }
      if (!move) {
        phase = "wait";
        scanFrom = t + human.reactTicks();
        return null;
      }
      if (human.slip(0.4)) {
        // A fumbled swipe: the right gem, the wrong direction.
        const [r, c] = move;
        const dirs: Move[] = [[r, c, r - 1, c], [r, c, r + 1, c], [r, c, r, c - 1], [r, c, r, c + 1]];
        const ok = dirs.filter((d) => d[2] >= 0 && d[2] < ROWS && d[3] >= 0 && d[3] < MATCHUP_SIZE);
        move = ok[human.int(0, ok.length - 1)]!;
      }
      plan.at(t + msToTicks(SWIPE_MS * human.power(3)), { k: MATCHUP_INPUT_SWAP, a: move[0], b: move[1], c: move[2], d: move[3] });
      phase = "swipe";
    }
    const ev = plan.take(t);
    if (ev && phase === "swipe") {
      // An invalid swipe swaps back; the player sees it and looks again.
      phase = "wait";
      scanFrom = t + msToTicks(300) + human.reactTicks();
    }
    return ev;
  }, init);
  return { events };
};
