/**
 * Player kits for the Speed group: Flash, Bang On, Ascend, Don't Break the
 * Chain, Eagle Eye, Double Take, Tally, Labyrinth and Matchmaker
 * (scripts/puzzle-fairness/kit.ts). Answers are built exactly as each Stage
 * sends them; every one is graded by gradeAnswer.
 *
 * Flash and Bang On grade every log as "correct" (the score comes from the
 * reactions), so their plays return one step: the whole tap log at the last tap.
 */
import { chainLongCycles, chainRequiredAt, chainReversedAt, chainBoardIndex, chainWindowMs, encodeChainAnswer, type ChainTap } from "../../src/lib/duel/chain";
import { encodeMazePath, mazeCorridorNeighbours } from "../../src/lib/duel/maze";
import { encodePairFlips, sameCard } from "../../src/lib/duel/pairmatch";
import { joinStages } from "../../src/lib/duel/stagedRounds";
import { markerState, targetCentre, watchLifeMs } from "../../src/lib/duel/stopWatch";
import {
  FLASH_FASTEST_MS,
  TAP_LOG_MAX,
  ascendLayoutAt,
  encodeNumberTaps,
  encodeTapTimes,
  replayBangOn,
  replayFlash,
  type NumberTap,
} from "../../src/lib/duel/tapLog";
import {
  CHAIN_BLOCK,
  CHAIN_LENGTH,
  CHAIN_REVERSE_AT,
  CHAIN_TIME_MS,
  PAIR_FLIP_BACK_MS,
  REACTION_FLASH_MS,
  STOPWATCH_GAP_MS,
  STOPWATCH_LEAD_IN_MS,
  type ChainBreak,
  type ChainPuzzleData,
  type CountUpPuzzleData,
  type MazePuzzleData,
  type NumberHuntPuzzleData,
  type PairPuzzleData,
  type PuzzleData,
  type ReactionPuzzleData,
  type SpotPuzzleData,
  type StopWatchPuzzleData,
  type StopWatchSpec,
  type SymbolScanPuzzleData,
} from "../../src/lib/duel/types";
import { countUpCounts, countUpStageTruth, spotScenes, usesCountRev2, usesSpotRev1 } from "../../src/lib/duel/attentionRev";
import { usesScanDepth } from "../../src/lib/duel/depth/eagleEye";
import { COUNTUP_COMPARE_GAP, COUNTUP_STAGE_COUNTS_REV2 } from "../../src/puzzles/countUp";
import { thinkMs, type Play, type PuzzleKit, type Rng, type Skill, type Step } from "./kit";

const sortedUnique = (times: number[]) => [...new Set(times.map((t) => Math.max(0, Math.round(t))))].sort((a, b) => a - b);

/* -------------------------------- Flash -------------------------------- */

/**
 * Reflex-tap pull of a decoy relative to a plain colour (Flash tapRev 3, 14 Oct
 * 2026): near-gold amber and a half-screen gold read as gold at a glance; a gold
 * frame or the word GOLD less so. Script-only modelling assumptions.
 */
const DECOY_PULL: Record<string, number> = { teal: 1, red: 1, blue: 1, amber: 2.2, half: 2, border: 1.5, word: 1.3 };

/** Drops taps the phone would not log (after every flash is settled, or past the cap). */
function flashLog(p: ReactionPuzzleData, taps: number[], limitMs: number): number[] {
  const log: number[] = [];
  for (const t of sortedUnique(taps)) {
    if (t > limitMs || log.length >= TAP_LOG_MAX) break;
    if (replayFlash(p, log, t).done) break;
    log.push(t);
  }
  return log;
}

const flash: PuzzleKit = {
  type: "reaction",
  // The Stage drafts the empty log on mount.
  nothing: () => encodeTapTimes([]),
  spam(p, rng, limitMs) {
    const r = p as ReactionPuzzleData;
    const constant = (lo: number, hi: number) => {
      const taps: number[] = [];
      for (let t = rng.int(100, 400); t < limitMs; t += rng.int(lo, hi)) taps.push(t);
      return encodeTapTimes(flashLog(r, taps, limitMs));
    };
    // Taps the moment anything coloured shows (decoys and gold alike).
    const everyColour = () => {
      const shows = [...r.flashes, ...r.decoys.map((d) => d.at)];
      return encodeTapTimes(flashLog(r, shows.map((t) => t + rng.int(150, 260)), limitMs));
    };
    return [
      { label: "tap-150-300ms", answer: constant(150, 300) },
      { label: "tap-every-1s", answer: constant(800, 1_200) },
      { label: "tap-every-colour", answer: everyColour() },
    ];
  },
  play(p, rng, skill, limitMs) {
    const r = p as ReactionPuzzleData;
    const taps: number[] = [];
    let segment = 0;
    for (const f of r.flashes) {
      // Mistakes: a reflex tap on a decoy, now and then a dark-screen tap, rarely a lapse.
      for (const d of r.decoys.filter((d) => d.at >= segment && d.at < f)) {
        // tapRev 3's gold-like decoys pull more reflex taps than a plain colour.
        if (rng.chance(Math.min(0.6, skill.err * (DECOY_PULL[d.color] ?? 1)))) taps.push(d.at + Math.max(120, rng.normal(skill.reactionMs, skill.reactionSd)));
      }
      if (rng.chance(skill.err * 0.3)) taps.push(segment + rng.int(300, 900));
      if (rng.chance(skill.err * 0.25)) {
        if (rng.chance(0.5)) taps.push(f + rng.int(600, 1_300)); // slow: distracted
        // else missed entirely
      } else {
        taps.push(f + Math.max(FLASH_FASTEST_MS + 15, rng.normal(skill.reactionMs, skill.reactionSd)));
      }
      segment = f + REACTION_FLASH_MS;
    }
    const log = flashLog(r, taps, limitMs);
    return { timed: true, steps: [{ answer: encodeTapTimes(log), atMs: log[log.length - 1] ?? 0 }] };
  },
};

/* -------------------------------- Bang On ------------------------------- */

/** Centre-line crossings of one watch, ms after it starts. */
function crossings(spec: StopWatchSpec): number[] {
  const life = watchLifeMs(spec);
  const out: number[] = [];
  let previous = 0;
  for (let e = 0; e < life; e++) {
    const s = markerState(spec, e);
    const offset = (s.pos - targetCentre(spec, e)) * s.dir;
    if (e > 0 && Math.sign(offset) !== Math.sign(previous) && offset !== 0) out.push(e);
    previous = offset;
  }
  return out;
}

/** Plays the watches in schedule order; `stopAt` gives ms into each watch (null = no tap). */
function bangOnLog(watches: StopWatchSpec[], stopAt: (spec: StopWatchSpec, index: number) => number | null, limitMs: number): number[] {
  const taps: number[] = [];
  let start = STOPWATCH_LEAD_IN_MS;
  watches.forEach((spec, i) => {
    const life = watchLifeMs(spec);
    const e = stopAt(spec, i);
    const at = e === null || e >= life ? start + life : start + Math.max(0, Math.round(e));
    if (e !== null && e < life && at <= limitMs) taps.push(at);
    start = at + STOPWATCH_GAP_MS;
  });
  return taps;
}

/**
 * Bang On tapRev 3 (14 Oct 2026): extra timing spread from blind spots on the
 * approach (+25 % per 0.1 of bar blacked out before the target), a diagonal face
 * (+15 %) and a longer sweep (timing error grows with the square root of the
 * interval). Script-only modelling assumptions; older watches return 1.
 */
function watchSpread(spec: StopWatchSpec): number {
  const before = (spec.blind ?? []).reduce((sum, [from, to]) => sum + Math.max(0, Math.min(to, spec.centre) - from), 0);
  const blind = 1 + 2.5 * before;
  const diagonal = spec.diagonal ? 1.15 : 1;
  // Only tapRev 3's longer sweeps run slower than 1,180 ms (40 % longer than their watch's usual sweep).
  const long = spec.sweepMs > 1_180 ? Math.sqrt(1.4) : 1;
  return blind * diagonal * long;
}

const bangOn: PuzzleKit = {
  type: "stopwatch",
  nothing: () => encodeTapTimes([]),
  spam(p, rng, limitMs) {
    const w = (p as StopWatchPuzzleData).watches;
    // Constant tapping: the first tap inside each live watch stops it.
    const constant: number[] = [];
    for (let t = rng.int(100, 400); t < limitMs && constant.length < TAP_LOG_MAX; t += rng.int(150, 300)) {
      if (!replayBangOn(w, constant, t).current) break;
      constant.push(t);
    }
    return [
      { label: "tap-at-start", answer: encodeTapTimes(bangOnLog(w, () => rng.int(120, 250), limitMs)) },
      { label: "tap-random-time", answer: encodeTapTimes(bangOnLog(w, (s) => rng.below(watchLifeMs(s)), limitMs)) },
      { label: "tap-150-300ms", answer: encodeTapTimes(constant) },
    ];
  },
  play(p, rng, skill, limitMs) {
    const w = (p as StopWatchPuzzleData).watches;
    // Human stop timing: sd 25 (near) to 60 ms (average), wider while the marker is hidden.
    const sd = skill.reactionSd + 5;
    const log = bangOnLog(
      w,
      (spec) => {
        const cross = crossings(spec);
        if (cross.length === 0) return null;
        if (rng.chance(skill.err * 0.3)) return null; // froze: never tapped
        // Mistake: waits a pass to be sure (costs time) or mistimes badly.
        const late = rng.chance(skill.err) ? 1 : 0;
        const aim = cross[Math.min(late, cross.length - 1)]!;
        const spread = (spec.hidden ? 1.4 : 1) * watchSpread(spec) * (rng.chance(skill.err * 0.5) ? 4 : 1) * sd;
        return Math.max(0, Math.min(watchLifeMs(spec) - 1, Math.round(rng.normal(aim, spread))));
      },
      limitMs,
    );
    return { timed: true, steps: [{ answer: encodeTapTimes(log), atMs: log[log.length - 1] ?? 0 }] };
  },
};

/* -------------------------------- Ascend -------------------------------- */

const ascend: PuzzleKit = {
  type: "numhunt",
  // The Stage only drafts once a disc is tapped.
  nothing: () => "",
  spam(p, rng, limitMs) {
    const h = p as NumberHuntPuzzleData;
    const random: NumberTap[] = [];
    const sweep: NumberTap[] = [];
    let t = rng.int(300, 700);
    for (let i = 0; t < limitMs && i < TAP_LOG_MAX; i++, t += rng.int(220, 400)) {
      random.push({ n: rng.pick(ascendLayoutAt(h, t)).n, t });
    }
    // Sweeps the screen top to bottom, left to right, over and over.
    t = rng.int(300, 700);
    for (let i = 0; t < limitMs && i < TAP_LOG_MAX; i++, t += rng.int(200, 350)) {
      const order = [...ascendLayoutAt(h, t)].sort((a, b) => a.y - b.y || a.x - b.x);
      sweep.push({ n: order[i % order.length]!.n, t });
    }
    return [
      { label: "tap-random", answer: encodeNumberTaps(random) },
      { label: "sweep-screen", answer: encodeNumberTaps(sweep) },
    ];
  },
  play(p, rng, skill) {
    const h = p as NumberHuntPuzzleData;
    const taps: NumberTap[] = [];
    const steps: Step[] = [];
    // BASE 1.4 s per disc: find the next number among 24 scattered discs and tap it.
    let t = 0;
    const total = h.spots.length;
    for (let reached = 0; reached < total; ) {
      t += thinkMs(rng, 1.4, skill);
      const layout = ascendLayoutAt(h, t);
      if (rng.chance(skill.err) && reached + 1 < total) {
        // Mis-read: taps a later number, then looks again.
        const wrong = Math.min(total - 1, reached + 1 + rng.below(3));
        taps.push({ n: layout[wrong]!.n, t });
        steps.push({ answer: encodeNumberTaps(taps), atMs: t });
        t += thinkMs(rng, 0.6, skill);
        continue;
      }
      taps.push({ n: ascendLayoutAt(h, t)[reached]!.n, t });
      reached += 1;
      steps.push({ answer: encodeNumberTaps(taps), atMs: t });
    }
    return { timed: true, steps };
  },
};

/* --------------------------------- Chain -------------------------------- */

function chainNodes(c: ChainPuzzleData, links: number, used: number[][], match: boolean): number[] {
  const board = chainBoardIndex(links, c);
  const need = chainRequiredAt(c, links)!;
  const nodes = c.boards[board] ?? [];
  return nodes
    .map((n, i) => ({ n, i }))
    .filter(({ n, i }) => !(used[board] ?? []).includes(i) && (n.shape === need.shape && n.colour === need.colour) === match)
    .map(({ i }) => i);
}

const chain: PuzzleKit = {
  type: "chain",
  nothing: () => encodeChainAnswer({ taps: [], reason: "timer" }),
  spam(p, rng, limitMs) {
    const c = p as ChainPuzzleData;
    const end = Math.min(limitMs, CHAIN_TIME_MS);
    // Random node every ~0.4 s: the first wrong one breaks the chain.
    const random: ChainTap[] = [];
    for (let t = rng.int(300, 700); t < end && random.length <= CHAIN_LENGTH; t += rng.int(300, 500)) {
      random.push({ node: rng.below(c.boards[0]!.length), t });
    }
    // Tapping nodes in screen order on each board.
    const sweep: ChainTap[] = [];
    for (let i = 0; i < c.boards[0]!.length && i * 300 < end; i++) sweep.push({ node: i, t: 400 + i * 300 });
    const encode = (taps: ChainTap[]): string => {
      // The replay decides when it broke; the phone stops at the break.
      for (let k = 1; k <= taps.length; k++) {
        const used: number[][] = [];
        let links = 0;
        let broke = false;
        for (const tap of taps.slice(0, k)) {
          const ok = chainNodes(c, links, used, true).includes(tap.node);
          if (!ok) { broke = true; break; }
          (used[chainBoardIndex(links, c)] ??= []).push(tap.node);
          links += 1;
        }
        if (broke) return encodeChainAnswer({ taps: taps.slice(0, k), reason: "wrong" });
      }
      return encodeChainAnswer({ taps, reason: "timer" });
    };
    return [
      { label: "tap-random", answer: encode(random) },
      { label: "tap-in-order", answer: encode(sweep) },
    ];
  },
  play(p, rng, skill) {
    const c = p as ChainPuzzleData;
    const taps: ChainTap[] = [];
    const used: number[][] = [];
    const steps: Step[] = [];
    // chainCycleRev 1 (14 Oct 2026): five charms to read instead of three (+6 % per link), and the reversed
    // board from link 20: +25 % per link there, and on its first link a chance of tapping the forward charm.
    const long = chainLongCycles(c);
    // BASE 0.85 s per link (1.1 s on a new board): read the rule chip, find the matching shape+colour among 20 nodes, tap.
    let t = thinkMs(rng, 1.5, skill); // first look at the board and the rule
    let lastT: number | null = null;
    const finish = (reason: ChainBreak, at: number) => steps.push({ answer: encodeChainAnswer({ taps, reason }), atMs: at });
    for (let links = 0; links < CHAIN_LENGTH; ) {
      const reversed = chainReversedAt(c, links);
      const factor = (long ? 1.06 : 1) * (reversed ? 1.25 : 1);
      let gap = links === 0 ? 0 : thinkMs(rng, (links % CHAIN_BLOCK === 0 ? 1.1 : 0.85) * factor, skill);
      const mistake = links > 0 && rng.chance(skill.err * (reversed ? 1.5 : 1));
      // Most mistakes are a hesitation (lost the rule for a moment); some are a wrong tap. The first
      // reversed link catches out some players who keep going forwards.
      const forgot = long && links === CHAIN_REVERSE_AT && rng.chance(Math.min(0.5, skill.err * 1.5));
      const wrongTap = forgot || (mistake && rng.chance(0.2));
      if (mistake && !wrongTap) gap += thinkMs(rng, 0.8, skill);
      const at: number = (lastT ?? t) + gap;
      if (lastT !== null && at - lastT > chainWindowMs(links + 1, c)) {
        finish("momentum", lastT + chainWindowMs(links + 1, c));
        return { timed: true, steps };
      }
      if (at > CHAIN_TIME_MS) break;
      const pool = chainNodes(c, links, used, !wrongTap);
      const node = pool.length ? rng.pick(pool) : 0;
      taps.push({ node, t: Math.round(at) });
      if (wrongTap) {
        finish("wrong", at);
        return { timed: true, steps };
      }
      (used[chainBoardIndex(links, c)] ??= []).push(node);
      links += 1;
      lastT = at;
      if (links >= CHAIN_LENGTH) finish("complete", at);
      else steps.push({ answer: encodeChainAnswer({ taps, reason: "timer" }), atMs: at });
    }
    return { timed: true, steps };
  },
};

/* ------------------------------- Eagle Eye ------------------------------ */

const eagleEye: PuzzleKit = {
  type: "symscan",
  nothing: () => joinStages(["", "", ""]),
  spam(p, rng) {
    const s = p as SymbolScanPuzzleData;
    const enc = (sel: number[][]) => joinStages(sel.map((x) => [...x].sort((a, b) => a - b).join(",")));
    return [
      { label: "tap-all", answer: enc(s.stages.map((st) => st.cells.map((_, i) => i))) },
      { label: "tap-random-half", answer: enc(s.stages.map((st) => st.cells.map((_, i) => i).filter(() => rng.chance(0.5)))) },
      { label: "tap-random-quarter", answer: enc(s.stages.map((st) => st.cells.map((_, i) => i).filter(() => rng.chance(0.25)))) },
    ];
  },
  play(p, rng, skill) {
    const s = p as SymbolScanPuzzleData;
    const sel: number[][] = [[], [], []];
    const steps: Step[] = [];
    // scanRev 2 (depth/eagleEye.ts): the answer adds the taps taken back as a fourth part.
    let undone = 0;
    const depth = usesScanDepth(s);
    const enc = () => joinStages(sel.map((x) => [...x].sort((a, b) => a - b).join(","))) + (depth ? `|${undone}` : "");
    // BASE 0.85 s per target arrow found and tapped; 0.6 s to confirm a grid.
    let t = 0;
    s.stages.forEach((stage, si) => {
      const targets = rng.shuffle(s.targets?.[si] ?? []);
      const others = stage.cells.map((_, i) => i).filter((i) => !targets.includes(i));
      // scanRev 1 grid 3: two target facings to hold in mind, so reading and each find take longer.
      const two = stage.alsoTarget !== undefined;
      t += thinkMs(rng, two ? 1.2 : 0.8, skill); // read the target arrow(s)
      for (const target of targets) {
        if (rng.chance(skill.err) && others.length) {
          // Mis-tap a similar arrow; nearly always noticed and untapped before Submit.
          const wrong = rng.pick(others);
          t += thinkMs(rng, 0.6, skill);
          sel[si]!.push(wrong);
          steps.push({ answer: enc(), atMs: t });
          if (rng.chance(0.9)) {
            t += thinkMs(rng, 0.7, skill);
            sel[si] = sel[si]!.filter((x) => x !== wrong);
            undone++;
            steps.push({ answer: enc(), atMs: t });
          }
        }
        t += thinkMs(rng, two ? 1.05 : 0.85, skill);
        sel[si]!.push(target);
        steps.push({ answer: enc(), atMs: t });
      }
      t += thinkMs(rng, 0.6, skill); // check and press Submit
      steps.push({ answer: enc(), atMs: t });
    });
    return { steps };
  },
};

/* ------------------------------ Double Take ----------------------------- */

/** spotRev 1: two pictures, answers "cells|cells". */
function doubleTakeTwo(d: SpotPuzzleData, rng: Rng, skill: Skill): Play {
  const scenes = spotScenes(d);
  const taps: number[][] = scenes.map(() => []);
  const steps: Step[] = [];
  const enc = () => taps.map((x) => x.join(",")).join("|");
  let t = 0;
  scenes.forEach((scene, si) => {
    // BASE 3 s per difference in the sweet shop (as before); 3.5 s in the rock pool, whose
    // fish and seahorses turn as often as they change colour (subtler changes).
    const base = scene.theme === "reef" ? 3.5 : 3;
    if (si > 0) t += thinkMs(rng, 1.2, skill); // the next picture slides in
    const diffs = rng.shuffle((d.differences ?? []).filter((x) => (x.scene ?? 0) === si));
    const cells = new Set(diffs.flatMap((x) => x.cells));
    const others = scene.top.map((s) => s.cell).filter((c) => !cells.has(c));
    // spotRev 2: the hidden seventh difference, if it is in this picture, is spotted with a chance that grows with
    // skill (none for a careless player), at 4 s more search, and only counts if tapped before the sixth.
    const bonus = d.bonus && (d.bonus.scene ?? 0) === si ? d.bonus : null;
    const spotHidden = bonus !== null && rng.chance(Math.max(0, Math.min(0.8, 0.85 - 6 * skill.err - 0.6 * skill.pace)));
    const hiddenAt = spotHidden ? rng.below(Math.max(1, diffs.length - 1)) : -1;
    diffs.forEach((diff, di) => {
      if (rng.chance(skill.err) && others.length) {
        t += thinkMs(rng, 2, skill);
        const wrong = rng.pick(others.filter((c) => !bonus?.cells.includes(c)));
        if (!taps[si]!.includes(wrong)) taps[si]!.push(wrong);
        steps.push({ answer: enc(), atMs: t });
      }
      t += thinkMs(rng, base, skill);
      taps[si]!.push(rng.pick(diff.cells));
      steps.push({ answer: enc(), atMs: t });
      if (di === hiddenAt && bonus) {
        t += thinkMs(rng, 4, skill);
        taps[si]!.push(bonus.cells[0]!);
        steps.push({ answer: enc(), atMs: t });
      }
    });
  });
  return { steps };
}

const doubleTake: PuzzleKit = {
  type: "spotdiff",
  // No draft: the taps go up just before the buzzer.
  nothing: () => "",
  spam(p, rng, limitMs) {
    const d = p as SpotPuzzleData;
    const cells = d.top.length;
    if (usesSpotRev1(d)) {
      // ~3 taps a second: the whole of picture 1 (which finds all six and moves on), then picture 2.
      const order = (n: number) => rng.shuffle(Array.from({ length: n }, (_, i) => i));
      const fit = Math.floor(limitMs / 330);
      const first = order(cells);
      const second = order(cells).slice(0, Math.max(0, fit - cells));
      const half = () => Array.from({ length: cells }, (_, i) => i).filter(() => rng.chance(0.5)).join(",");
      return [
        { label: "tap-all-random-order", answer: `${first.join(",")}|${second.join(",")}` },
        { label: "tap-all-in-order", answer: `${[...first].sort((a, b) => a - b).join(",")}|${[...second].sort((a, b) => a - b).join(",")}` },
        { label: "tap-random-half", answer: `${half()}|${half()}` },
        { label: "skip-then-tap-all", answer: `|${order(cells).join(",")}` },
      ];
    }
    // ~3 taps a second across the grid; the server never charges a wrong tap.
    const fit = Math.min(cells, Math.floor(limitMs / 330));
    const all = rng.shuffle(Array.from({ length: cells }, (_, i) => i)).slice(0, fit);
    const rows = Array.from({ length: cells }, (_, i) => i).slice(0, fit);
    return [
      { label: "tap-all-random-order", answer: all.join(",") },
      { label: "tap-all-in-order", answer: rows.join(",") },
      { label: "tap-random-half", answer: Array.from({ length: cells }, (_, i) => i).filter(() => rng.chance(0.5)).join(",") },
    ];
  },
  play(p, rng, skill) {
    const d = p as SpotPuzzleData;
    if (usesSpotRev1(d)) return doubleTakeTwo(d, rng, skill);
    const diffs = rng.shuffle(d.differences ?? []);
    const differenceCells = new Set(diffs.flatMap((x) => x.cells));
    const others = d.top.map((s) => s.cell).filter((c) => !differenceCells.has(c));
    const taps: number[] = [];
    const steps: Step[] = [];
    // BASE 3 s per difference: compare two 8×6 grids of shapes to find the next change.
    let t = 0;
    for (const diff of diffs) {
      if (rng.chance(skill.err) && others.length) {
        // Thinks a cell differs: a wrong tap (buzz), then keeps looking.
        t += thinkMs(rng, 2, skill);
        const wrong = rng.pick(others);
        if (!taps.includes(wrong)) taps.push(wrong);
        steps.push({ answer: taps.join(","), atMs: t });
      }
      t += thinkMs(rng, 3, skill);
      taps.push(rng.pick(diff.cells));
      steps.push({ answer: taps.join(","), atMs: t });
    }
    return { steps };
  },
};

/* --------------------------------- Tally -------------------------------- */

const tally: PuzzleKit = {
  type: "countup",
  nothing: (p) => joinStages((p as CountUpPuzzleData).stages.map(() => ""), (p as CountUpPuzzleData).stages.length),
  spam(p, rng) {
    // Guesses without counting: each tray's middle count, or a random count in range.
    // countRev 2: 3–15, 5–17, 7–19 and the comparison 1–13; older rounds: about 8 / 10 / 12 ± 3.
    const c = p as CountUpPuzzleData;
    const n = c.stages.length;
    const ranges: [number, number][] = usesCountRev2(c)
      ? [...COUNTUP_STAGE_COUNTS_REV2, COUNTUP_COMPARE_GAP]
      : [[5, 11], [7, 13], [9, 15]];
    const mid = ranges.slice(0, n).map(([lo, hi]) => Math.round((lo + hi) / 2));
    const random = (i: number) => rng.int(ranges[i]![0], ranges[i]![1]);
    return [
      { label: "guess-typical", answer: joinStages(mid.map(String), n) },
      { label: "guess-random", answer: joinStages(mid.map((_, i) => String(random(i))), n) },
    ];
  },
  play(p, rng, skill) {
    const c = p as CountUpPuzzleData;
    const n = c.stages.length;
    const counts = c.stages.map(countUpStageTruth);
    const answers = c.stages.map(() => "");
    const steps: Step[] = [];
    let t = 0;
    counts.forEach((truth, i) => {
      const stage = c.stages[i]!;
      // BASE 2 s to read the question and scan, plus 0.55 s per matching shape counted, plus 1.2 s to type and submit.
      // A comparison tray counts both colours and takes 1 s more to subtract.
      const counted = stage.shapes.filter((x) => countUpCounts(stage, x)).length;
      t += thinkMs(rng, 2 + 0.55 * counted + 1.2 + (stage.compare ? 1 : 0), skill, 0.25);
      // Miscount: ±1 mostly, ±2 sometimes; bigger fields are harder.
      const off = rng.chance(Math.min(0.85, skill.err * (1.5 + 0.5 * i))) ? (rng.chance(0.7) ? 1 : 2) * (rng.chance(0.5) ? 1 : -1) : 0;
      answers[i] = String(Math.max(0, truth + off));
      steps.push({ answer: joinStages(answers, n), atMs: t });
    });
    return { steps };
  },
};

/* ------------------------------- Labyrinth ------------------------------ */

/** Cells a side branch reaches from `from` (entered from `parent`), depth-first to a dead end or `max`. */
function branchWalk(m: MazePuzzleData, from: number, parent: number, max: number, rng: Rng): number[] {
  const walk: number[] = [];
  let cell = from;
  let prev = parent;
  while (walk.length < max) {
    walk.push(cell);
    const next = mazeCorridorNeighbours(m.cells, cell).filter((n) => n !== prev);
    if (next.length === 0) break;
    prev = cell;
    cell = rng.pick(next);
  }
  return walk;
}

const labyrinth: PuzzleKit = {
  type: "maze",
  // The Stage's path starts as [start].
  nothing: (p) => encodeMazePath([(p as MazePuzzleData).start]),
  spam(p, rng, limitMs) {
    const m = p as MazePuzzleData;
    // Finger scribbling: ~6 cells a second, every touch a random neighbour (retrace undoes).
    const moves = Math.floor((limitMs / 1000) * 6);
    const scribble = (bias: boolean) => {
      const path = [m.start];
      for (let i = 0; i < moves; i++) {
        const last = path[path.length - 1]!;
        if (last === m.exit) break;
        const options = mazeCorridorNeighbours(m.cells, last);
        const fresh = options.filter((n) => n !== path[path.length - 2]);
        // Biased: keeps going forward until a dead end, then backs up (a blind depth-first scribble).
        const cell = bias && fresh.length ? rng.pick(fresh) : rng.pick(options);
        if (path.length > 1 && cell === path[path.length - 2]) path.pop();
        else path.push(cell);
      }
      return encodeMazePath(path);
    };
    const dfs = () => {
      const path = [m.start];
      const seen = new Set([m.start]);
      for (let i = 0; i < moves; i++) {
        const last = path[path.length - 1]!;
        if (last === m.exit) break;
        const fresh = mazeCorridorNeighbours(m.cells, last).filter((n) => !seen.has(n));
        if (fresh.length) {
          const cell = rng.pick(fresh);
          seen.add(cell);
          path.push(cell);
        } else if (path.length > 1) path.pop();
      }
      return encodeMazePath(path);
    };
    return [
      { label: "random-scribble", answer: scribble(false) },
      { label: "forward-scribble", answer: scribble(true) },
      { label: "blind-dfs-6cps", answer: dfs() },
    ];
  },
  play(p, rng, skill) {
    const m = p as MazePuzzleData;
    const route = m.solution ?? [];
    const path = [m.start];
    const steps: Step[] = [];
    // BASE 0.4 s per route cell (tracing a 19×19 maze while reading ahead), 0.25 s per cell in a wrong
    // branch and back; 2 s to look the maze over first.
    let t = thinkMs(rng, 2, skill);
    for (let i = 1; i < route.length; i++) {
      const here = route[i - 1]!;
      const side = mazeCorridorNeighbours(m.cells, here).filter((n) => n !== route[i] && n !== route[i - 2]);
      if (side.length && rng.chance(skill.err)) {
        // Wrong turn at a junction: follows it until it is clearly a dead end, then retraces.
        const walk = branchWalk(m, rng.pick(side), here, rng.int(3, 12), rng);
        for (const cell of walk) {
          t += thinkMs(rng, 0.25, skill);
          path.push(cell);
          steps.push({ answer: encodeMazePath(path), atMs: t });
        }
        for (let k = 0; k < walk.length; k++) {
          t += thinkMs(rng, 0.2, skill);
          path.pop();
          steps.push({ answer: encodeMazePath(path), atMs: t });
        }
      }
      t += thinkMs(rng, 0.4, skill);
      path.push(route[i]!);
      steps.push({ answer: encodeMazePath(path), atMs: t });
    }
    return { steps };
  },
};

/* ------------------------------- Matchmaker ----------------------------- */

const matchmaker: PuzzleKit = {
  type: "pairmatch",
  nothing: () => encodePairFlips([]),
  spam(p, rng, limitMs) {
    const cards = (p as PairPuzzleData).cards;
    // A blind try (two flips plus the 600 ms flip-back) takes ~1.2 s.
    const tries = Math.floor(limitMs / 1_200);
    const run = (choose: (open: number[], k: number) => [number, number]) => {
      const matched = new Set<number>();
      const flips: number[] = [];
      for (let k = 0; k < tries && matched.size < cards.length; k++) {
        const open = cards.map((_, i) => i).filter((i) => !matched.has(i));
        const [a, b] = choose(open, k);
        flips.push(a, b);
        if (sameCard(cards[a], cards[b])) matched.add(a).add(b);
      }
      return encodePairFlips(flips);
    };
    let cursor = 0;
    return [
      {
        label: "random-pairs",
        answer: run((open) => {
          const [a, b] = rng.shuffle(open);
          return [a!, b!];
        }),
      },
      {
        // Sweeps the board in reading order, two cards at a time, wrapping round.
        label: "sweep-in-order",
        answer: run((open) => {
          const a = open[cursor % open.length]!;
          const b = open[(cursor + 1) % open.length]!;
          cursor += 2;
          return [a, b];
        }),
      },
    ];
  },
  play(p, rng, skill) {
    const cards = (p as PairPuzzleData).cards;
    // Chance of remembering a card once seen: 50 % average, 75 % good, 88 % great, 96 % near.
    const memory = Math.max(0.3, 1 - 2.5 * skill.err);
    const known = new Set<number>();
    const matched = new Set<number>();
    const flips: number[] = [];
    const steps: Step[] = [];
    // BASE 0.8 s per flip: look over the board, recall, tap.
    let t = 0;
    const see = (i: number) => {
      if (rng.chance(memory)) known.add(i);
    };
    const flip = (i: number) => {
      t += thinkMs(rng, 0.8, skill);
      flips.push(i);
      steps.push({ answer: encodePairFlips(flips), atMs: t });
    };
    const unknown = (except: number) =>
      cards.map((_, i) => i).filter((i) => !matched.has(i) && !known.has(i) && i !== except);
    const anyOpen = (except: number) => cards.map((_, i) => i).filter((i) => !matched.has(i) && i !== except);
    const twinOf = (i: number) => [...known].find((k) => k !== i && !matched.has(k) && sameCard(cards[k], cards[i]));
    while (matched.size < cards.length && flips.length < 2_000) {
      // A known pair first.
      let a: number | undefined;
      let b: number | undefined;
      for (const k of known) {
        const twin = matched.has(k) ? undefined : twinOf(k);
        if (twin !== undefined) { a = k; b = twin; break; }
      }
      if (a === undefined) {
        const pool = unknown(-1);
        a = rng.pick(pool.length ? pool : anyOpen(-1));
      }
      flip(a);
      if (b === undefined) {
        const twin = twinOf(a);
        if (twin !== undefined) b = twin;
        else {
          const pool = unknown(a);
          b = rng.pick(pool.length ? pool : anyOpen(a));
        }
      }
      // Mis-recall: reaches for the wrong remembered spot.
      if (rng.chance(skill.err * 0.5)) {
        const pool = anyOpen(a);
        b = rng.pick(pool);
      }
      flip(b);
      if (sameCard(cards[a], cards[b])) {
        matched.add(a).add(b);
        known.delete(a);
        known.delete(b);
      } else {
        see(a);
        see(b);
        t += PAIR_FLIP_BACK_MS;
      }
    }
    return { steps };
  },
};

export const KITS_SPEED: PuzzleKit[] = [flash, bangOn, ascend, chain, eagleEye, doubleTake, tally, labyrinth, matchmaker];
