/**
 * The Speed games' level tuning (the Speed overhaul, stage 3, 15 Nov 2026): Joe's two bots on real deals at every level,
 * graded by the server's own code (level-tune.ts's deal and grade path):
 *
 *  - elite: the kits' elite player (depth-engine-bands' ELITE: 140 ms reactions, the fastest think pace), the bot Joe's
 *    targets name: about 198 on Normal, 160 on Hard and 140 on Expert, Easy comfortable.
 *  - human: the same player held to human limits (Joe's rule: about 0.25 s to react, 0.15 s to move to the target, no
 *    superhuman accuracy): Expert must still reach about 140 under these limits.
 *
 * A tool, not a check (speed-levels-check pins the measured bands it reports).
 *
 *   bun scripts/speed-levels-tune.ts [game…] [--seeds=20] [--from=0] [--json]
 */
import { KITS } from "./puzzle-fairness/kits";
import { hashText, makeRng, type Skill } from "./puzzle-fairness/kit";
import { ELITE } from "./depth-engine-bands";
import { dealAt } from "./level-tune";
import { asPhoneSends, gradeSteps } from "./standard-lib";
import { puzzleTimeLimitMs } from "../src/lib/duel/registry";
import { levelsOf } from "../src/lib/levels/gameLevels";
import { puzzleLevel, type Level } from "../src/lib/levels/levels";
import type { ChainPuzzleData, NumberHuntPuzzleData, PuzzleData, PuzzleType } from "../src/lib/duel/types";
import type { Play, Rng, Step } from "./puzzle-fairness/kit";
import { ascendLayoutAt, encodeNumberTaps, encodeTapTimes, replayFlash, TAP_LOG_MAX, type NumberTap } from "../src/lib/duel/tapLog";
import { flashWindowMs, type ReactionPuzzleData } from "../src/lib/duel/types";
import { chainBoardIndex, chainCycleAt, chainReversedAt, chainRequiredAt, chainRules, chainTimeLimitMs, chainWindowMs, encodeChainAnswer, type ChainTap } from "../src/lib/duel/chain";
import { CHAIN_BLOCK, type ChainBreak } from "../src/lib/duel/types";

export const SPEED_LEVEL_GAMES = ["reaction", "numhunt", "chain", "whack", "tendrop", "clayshoot"] as const satisfies readonly PuzzleType[];

/** Joe's human limits: reactions about 250 ms, moves at least 150 ms, slips at the arcade humans' best rate (0.8 %, kit.ts). */
export const HUMAN_LIMITS: Skill = { level: "near", pace: 1.1, err: 0.008, reactionMs: 250, reactionSd: 25 };
export const TUNE_BOTS: readonly [string, Skill][] = [["elite", ELITE], ["human", HUMAN_LIMITS]];

/**
 * The level-aware players for Ascend and Don't Break the Chain (the puzzle-fairness kits model only today's board, so
 * they can't feel a level). Every action is a reaction, a move and a search, held to the bot's skill:
 *  - Ascend: a search over the discs still to tap (about 35 ms a disc for this player), plus a reorientation after each
 *    reshuffle (0.6 s) and counting down 10 % slower than up.
 *  - Chain: reading the next charm in the cycle and finding it among the board's 20 (0.32 s, 6 % more for a six-charm
 *    cycle), 0.35 s more on a new board and 25 % slower on a reversed run; a link slower than its window breaks the chain.
 * Slips: a wrong tap at the skill's error rate (one and a half times on a reversed run; the first reversed link of each
 * run catches out some players who keep going forwards).
 */
function spread(rng: Rng, ms: number): number {
  return ms * Math.exp(rng.normal(0, 0.18));
}
function actionMs(rng: Rng, skill: Skill, searchMs: number): number {
  const react = Math.max(skill.reactionMs * 0.8, rng.normal(skill.reactionMs, skill.reactionSd));
  const move = skill === ELITE ? 110 : 150;
  return react + move + spread(rng, searchMs * (skill === ELITE ? 0.8 : 1));
}

export function playAscend(h: NumberHuntPuzzleData, rng: Rng, skill: Skill, limitMs: number): Play {
  const taps: NumberTap[] = [];
  const steps: Step[] = [];
  const total = h.spots.length;
  let t = 400;
  let lastLayout = 0;
  for (let reached = 0; reached < total && t <= limitMs; ) {
    const layoutAt = ascendLayoutAt(h, t);
    const layoutIndex = h.layouts.indexOf(layoutAt);
    if (layoutIndex > lastLayout) {
      t += spread(rng, 600);
      lastLayout = layoutIndex;
    }
    const left = total - reached;
    t += actionMs(rng, skill, 35 * left * (h.descending ? 1.1 : 1));
    const layout = ascendLayoutAt(h, t);
    if (rng.chance(skill.err) && reached + 1 < total) {
      taps.push({ n: layout[Math.min(total - 1, reached + 1 + rng.below(3))]!.n, t: Math.round(t) });
      steps.push({ answer: encodeNumberTaps(taps), atMs: t });
      t += spread(rng, 300);
      continue;
    }
    taps.push({ n: layout[reached]!.n, t: Math.round(t) });
    reached += 1;
    steps.push({ answer: encodeNumberTaps(taps), atMs: t });
  }
  return { timed: true, steps };
}

export function playChain(c: ChainPuzzleData, rng: Rng, skill: Skill): Play {
  const taps: ChainTap[] = [];
  const used: number[][] = [];
  const steps: Step[] = [];
  const length = chainRules(c).length;
  const limit = chainTimeLimitMs(c);
  const finish = (reason: ChainBreak, at: number) => steps.push({ answer: encodeChainAnswer({ taps, reason }), atMs: at });
  let lastT: number | null = null;
  let t = 900;
  for (let links = 0; links < length; ) {
    const reversed = chainReversedAt(c, links);
    const firstReversed = reversed && !chainReversedAt(c, links - 1);
    const cycleLen = chainCycleAt(c, links).length;
    const newBoard = links > 0 && links % CHAIN_BLOCK === 0;
    const search = (320 * (cycleLen > 5 ? 1.06 : 1) + (newBoard ? 350 : 0)) * (reversed ? 1.25 : 1);
    const gap = links === 0 ? 0 : actionMs(rng, skill, search);
    const wrong = links > 0 && (rng.chance(skill.err * (reversed ? 1.5 : 1)) || (firstReversed && rng.chance(skill.err * 2)));
    const at = (lastT ?? t) + gap;
    if (lastT !== null && at - lastT > chainWindowMs(links + 1, c)) {
      finish("momentum", lastT + chainWindowMs(links + 1, c));
      return { timed: true, steps };
    }
    if (at > limit) break;
    const board = chainBoardIndex(links, c);
    const need = chainRequiredAt(c, links)!;
    const pool = (c.boards[board] ?? [])
      .map((n, i) => ({ n, i }))
      .filter(({ n, i }) => !(used[board] ?? []).includes(i) && (n.shape === need.shape && n.colour === need.colour) === !wrong)
      .map(({ i }) => i);
    const node = pool.length ? rng.pick(pool) : 0;
    taps.push({ node, t: Math.round(at) });
    if (wrong) {
      finish("wrong", at);
      return { timed: true, steps };
    }
    (used[board] ??= []).push(node);
    links += 1;
    lastT = at;
    if (links >= length) finish("complete", at);
    else steps.push({ answer: encodeChainAnswer({ taps, reason: "timer" }), atMs: at });
  }
  return { timed: true, steps };
}

/**
 * Flash under human limits: the kit's flash timing, but lures tapped at a human rate (go/no-go findings for skilled
 * adults under time pressure: a few per cent on a plain colour, more on a look-alike), 2 % on a plain decoy and 8 % on
 * a gold-like one scaled by how close it looks (the kit's pulls: amber and half-gold most). The kit's own rate (its
 * slip rate × the pull) is under 2 % even on a look-alike, better than people manage; the elite bot keeps it.
 */
const LURE_PCT: Record<string, number> = { teal: 2, red: 2, blue: 2, amber: 10, half: 9, border: 7, word: 6 };
export function playFlashHuman(r: ReactionPuzzleData, rng: Rng, skill: Skill, limitMs: number): Play {
  const taps: number[] = [];
  let segment = 0;
  for (const f of r.flashes) {
    for (const d of r.decoys.filter((d) => d.at >= segment && d.at < f)) {
      if (rng.chance((LURE_PCT[d.color] ?? 2) / 100)) taps.push(d.at + Math.max(120, rng.normal(skill.reactionMs, skill.reactionSd)));
    }
    if (rng.chance(skill.err * 0.25)) {
      if (rng.chance(0.5)) taps.push(f + rng.int(600, 1_300));
    } else {
      taps.push(f + Math.max(115, rng.normal(skill.reactionMs, skill.reactionSd)));
    }
    segment = f + flashWindowMs(r);
  }
  const log: number[] = [];
  for (const t of [...new Set(taps.map(Math.round))].sort((a, b) => a - b)) {
    if (t > limitMs || log.length >= TAP_LOG_MAX) break;
    if (replayFlash(r, log, t).done) break;
    log.push(t);
  }
  return { timed: true, steps: [{ answer: encodeTapTimes(log), atMs: log[log.length - 1] ?? 0 }] };
}

/** The player for a game: the level-aware ones above, else the game's kit (the engine games' sims carry their level). */
function play(puzzle: PuzzleData, rng: Rng, skill: Skill, limit: number): Play {
  if (puzzle.type === "reaction" && skill === HUMAN_LIMITS) return playFlashHuman(puzzle, rng, skill, limit);
  if (puzzle.type === "numhunt") return playAscend(puzzle, rng, skill, limit);
  if (puzzle.type === "chain") return playChain(puzzle, rng, skill);
  return KITS[puzzle.type]!.play(puzzle, rng, skill, limit);
}

export interface SpeedTuneRow {
  game: string;
  level: Level;
  dealt: Level;
  bot: string;
  average: number;
  median: number;
  /** The best tenth's lowest score (Expert's "humanly possible" rule reads it for the human player). */
  top10: number;
  finishRate: number;
  runs: number;
  clockMs: number;
}

export function tuneSpeed(type: PuzzleType, level: Level, seeds = 20, from = 0, bots: readonly [string, Skill][] = TUNE_BOTS): SpeedTuneRow[] {
  const out: SpeedTuneRow[] = [];
  for (const [bot, skill] of bots) {
    const scores: number[] = [];
    let finished = 0;
    let dealt: Level = "normal";
    let clockMs = 0;
    for (let n = from; n < from + seeds; n++) {
      const puzzle = dealAt(type, level, n);
      dealt = puzzleLevel(puzzle);
      const limit = puzzleTimeLimitMs(puzzle);
      clockMs = Math.max(clockMs, limit);
      const played = play(puzzle, makeRng(hashText(`speed-levels:${type}:${level}:${n}:${bot}`)), skill, limit);
      const run = gradeSteps(puzzle, asPhoneSends(puzzle, played.steps), played.timed);
      scores.push(run.score);
      if (run.isCorrect) finished++;
    }
    const sorted = [...scores].sort((a, b) => a - b);
    out.push({
      game: type,
      level,
      dealt,
      bot,
      average: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10,
      median: sorted[Math.floor((sorted.length - 1) / 2)]!,
      top10: sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.9))]!,
      finishRate: finished / scores.length,
      runs: scores.length,
      clockMs,
    });
  }
  return out;
}

if (import.meta.main) {
  const args = process.argv.slice(2);
  const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
  const games = (args.filter((a) => !a.startsWith("--")) as PuzzleType[]).filter(Boolean);
  const seeds = Number(opt("seeds") ?? 20);
  const from = Number(opt("from") ?? 0);
  const rows: SpeedTuneRow[] = [];
  for (const game of games.length ? games : SPEED_LEVEL_GAMES) {
    for (const level of levelsOf(game)) {
      for (const r of tuneSpeed(game, level, seeds, from)) {
        rows.push(r);
        if (!args.includes("--json"))
          console.log(`${r.game.padEnd(10)} ${r.level.padEnd(7)} ${r.bot.padEnd(6)} avg ${r.average.toFixed(1).padStart(6)}  median ${String(r.median).padStart(3)}  top 10 % ${String(r.top10).padStart(3)}  finished ${(r.finishRate * 100).toFixed(0).padStart(3)}%  clock ${r.clockMs / 1000} s${r.dealt !== r.level ? `  (dealt ${r.dealt})` : ""}`);
      }
    }
  }
  if (args.includes("--json")) console.log(JSON.stringify(rows));
}
