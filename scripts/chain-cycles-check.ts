import { generateChain, generateChainV2 } from "../src/lib/duel/chain.server";
import { withPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";
import { CHAIN_CYCLE_REV_CREDIT, chainLongCycles, chainReversedAt, chainRules, chainScore, chainDemoCompatible, chainBoardIndex, chainCycleAt, chainRequiredAt, chainRuleStep, chainWindowMs, decodeChainAnswer, encodeChainAnswer, replayChain, type ChainTap } from "../src/lib/duel/chain";
import { gradeSubmission } from "../src/lib/duel/grade";
import { CHAIN_BLOCK, CHAIN_BOARDS, CHAIN_CYCLE, CHAIN_CYCLE_LONG, CHAIN_REVERSE_AT, CHAIN_REVERSE_LINKS, CHAIN_FASTER_AT, CHAIN_LENGTH, CHAIN_TIME_MS, CHAIN_BOARD_H_PX, CHAIN_BOARD_W_PX, CHAIN_NODE_GAP_PX, CHAIN_NODE_PX, type ChainPuzzleData, type ChainRuleItem } from "../src/lib/duel/types";
import { withSeededRandom } from "../src/lib/duel/random";

function check(ok: boolean, label: string) { if (!ok) throw new Error(label); }
const same = (a: ChainRuleItem, b: ChainRuleItem) => a.shape === b.shape && a.colour === b.colour;
function solve(puzzle: ChainPuzzleData): ChainTap[] {
  const taps: ChainTap[] = [];
  const used: number[][] = [];
  for (let link = 0; link < chainRules(puzzle).length; link++) {
    const board = chainBoardIndex(link, puzzle);
    const need = chainRequiredAt(puzzle, link);
    if (!need) throw new Error("Missing required symbol");
    const node = puzzle.boards[board]?.findIndex((face, i) => same(face, need) && !(used[board] ?? []).includes(i)) ?? -1;
    check(node >= 0, `Missing node at link ${link + 1}`);
    (used[board] ??= []).push(node);
    taps.push({ node, t: (link + 1) * 1000 });
  }
  return taps;
}

// Rooms deal five-symbol cycles since 14 Oct 2026 (chainCycleRev 1); the three-symbol generator stays checked for stored rounds.
for (const [generate, long] of [[generateChainV2, false], [generateChain, true]] as const)
for (let seed = 0; seed < 200; seed++) {
  const puzzle = generate(seed);
  check(chainLongCycles(puzzle) === long, "Wrong cycle stamp");
  check(JSON.stringify(puzzle) === JSON.stringify(generate(seed)), "Seed regeneration differs");
  check(JSON.stringify(withSeededRandom(seed, () => generate())) === JSON.stringify(withSeededRandom(seed, () => generate())), "Fixed intro generation differs");
  check(puzzle.cycles?.length === CHAIN_BOARDS, "Missing board cycles");
  for (let board = 0; board < CHAIN_BOARDS; board++) {
    const cycle = chainCycleAt(puzzle, board * CHAIN_BLOCK);
    const nodes = puzzle.boards[board];
    if (!nodes) throw new Error("Missing board");
    if (long) {
      // Five different charms, no shape or colour more than twice, neighbours (cyclically) share neither.
      check(cycle.length === CHAIN_CYCLE_LONG && new Set(cycle.map((c) => `${c.shape}${c.colour}`)).size === CHAIN_CYCLE_LONG, "Invalid five-symbol cycle");
      for (const c of cycle) check(cycle.filter((d) => d.shape === c.shape).length <= 2 && cycle.filter((d) => d.colour === c.colour).length <= 2, "Five-symbol cycle repeats too much");
      cycle.forEach((c, i) => { const n = cycle[(i + 1) % cycle.length]!; check(c.shape !== n.shape && c.colour !== n.colour, "Neighbouring charms alike"); });
      // Every rule charm is needed exactly once on its board, forwards or (board 5) backwards.
      const needs = Array.from({ length: CHAIN_BLOCK }, (_, i) => chainRequiredAt(puzzle, board * CHAIN_BLOCK + i)!);
      const reversed = board * CHAIN_BLOCK === CHAIN_REVERSE_AT;
      check(needs.every((n, i) => same(n, cycle[reversed ? CHAIN_CYCLE_LONG - 1 - i : i]!)), "Cycle order wrong");
      check(chainReversedAt(puzzle, board * CHAIN_BLOCK) === reversed, "Reversed board misplaced");
    } else check(cycle.length === CHAIN_CYCLE && new Set(cycle.map((c) => c.shape)).size === 3 && new Set(cycle.map((c) => c.colour)).size === 3, "Invalid cycle");
    check(chainRuleStep(puzzle, board * CHAIN_BLOCK) === 0, "New cycle doesn't restart");
    const previous = puzzle.cycles?.[board - 1];
    if (previous) {
      check(!cycle.every((c) => previous.some((p) => same(c, p))), "Symbol set unchanged");
      if (long) check(!same(cycle[0]!, previous[0]!), "First charm unchanged");
      else check(!cycle.every((c, i) => c.shape === previous[i]?.shape), "Order unchanged");
    }
    for (const need of cycle) {
      check(nodes.some((n) => n.shape === need.shape && n.colour !== need.colour), "Missing shape decoy");
      check(nodes.some((n) => n.colour === need.colour && n.shape !== need.shape), "Missing colour decoy");
      const expected = Array.from({ length: CHAIN_BLOCK }, (_, i) => chainRequiredAt(puzzle, board * CHAIN_BLOCK + i)).filter((n) => n && same(n, need)).length;
      check(nodes.filter((n) => same(n, need)).length === expected, "Wrong valid-node count");
    }
    for (const node of nodes.filter((n) => !cycle.some((c) => same(c, n)))) {
      check(cycle.some((c) => c.shape === node.shape || c.colour === node.colour), "Decoy isn't a look-alike");
    }
    for (let a = 0; a < nodes.length; a++) for (let b = a + 1; b < nodes.length; b++) {
      const left = nodes[a], right = nodes[b];
      if (!left || !right) throw new Error("Missing node");
      check(Math.hypot((left.x - right.x) / 100 * CHAIN_BOARD_W_PX, (left.y - right.y) / 100 * CHAIN_BOARD_H_PX) >= CHAIN_NODE_PX + CHAIN_NODE_GAP_PX - 0.01, "Nodes overlap");
    }
  }
  const taps = solve(puzzle);
  const answer = encodeChainAnswer({ taps, reason: "complete" });
  const replay = replayChain(JSON.parse(JSON.stringify(puzzle)), decodeChainAnswer(answer));
  check(replay.links === 40 && replay.reason === "complete", "Replay failed");
  const graded = gradeSubmission(puzzle, answer, CHAIN_TIME_MS - 40000);
  check(graded.score === 142 && graded.isCorrect, "Server score failed");
  for (const links of [0, 1, 12, 13, 25, 26, 27, 29, 30, 39, 40]) {
    const partial = gradeSubmission(puzzle, encodeChainAnswer({ taps: taps.slice(0, links), reason: "timer" }), CHAIN_TIME_MS - links * 1000);
    check(partial.score === chainScore(links, CHAIN_TIME_MS - links * 1000, puzzle) && partial.isCorrect === (links === 40), `Partial server score failed at ${links}`);
  }
  check(replayChain(puzzle, { taps: taps.slice(0, 25), reason: "complete" }).reason !== "complete", "Client completion claim accepted at 25");
  check(chainBoardIndex(35, puzzle) === 7 && puzzle.boards.length === 8, "Eighth board missing");
  for (const link of [5, 10, 15, 20, 25, 30, 35]) {
    const need = chainRequiredAt(puzzle, link);
    const wrong = puzzle.boards[chainBoardIndex(link)]?.findIndex((n) => need && !same(n, need)) ?? -1;
    const broken = replayChain(puzzle, { taps: [...taps.slice(0, link), { node: wrong, t: (link + 1) * 1000 }], reason: "wrong" });
    check(broken.links === link && broken.reason === "wrong", "Boundary decoy accepted");
  }
  for (const link of [13, 14, 26, 27, 30, 40]) {
    const tap = taps[link - 1];
    const previous = taps[link - 2];
    if (!tap || !previous) throw new Error("Missing timed tap");
    const prefix = taps.slice(0, link - 1);
    check(replayChain(puzzle, { taps: [...prefix, { ...tap, t: previous.t + chainWindowMs(link) }], reason: "timer" }).links === link, "Window edge rejected");
    const late = replayChain(puzzle, { taps: [...prefix, { ...tap, t: previous.t + chainWindowMs(link) + 1 }], reason: "timer" });
    check(late.links === link - 1 && late.reason === "momentum", "Late tap accepted");
  }
  if (long) {
    // The reversed board: tapping the board's first charm (forwards) at link 21 breaks the chain.
    const cycle = chainCycleAt(puzzle, CHAIN_REVERSE_AT);
    const forward = puzzle.boards[chainBoardIndex(CHAIN_REVERSE_AT)]!.findIndex((n) => same(n, cycle[0]!));
    const t = taps[CHAIN_REVERSE_AT]!.t;
    check(replayChain(puzzle, { taps: [...taps.slice(0, CHAIN_REVERSE_AT), { node: forward, t }], reason: "timer" }).reason === "wrong", "Forward tap accepted on the reversed board");
    check(!chainReversedAt(puzzle, CHAIN_REVERSE_AT - 1) && !chainReversedAt(puzzle, CHAIN_REVERSE_AT + CHAIN_REVERSE_LINKS), "Reversal runs beyond five links");
    check(chainDemoCompatible(puzzle), "New demo rejected");
    continue;
  }
  check(!chainDemoCompatible(puzzle), "Three-symbol demo still accepted");
  // Legacy single-cycle stored boards must retain global cycle phase.
  const legacy: ChainPuzzleData = { type: "chain", cycle: puzzle.cycle, boards: Array.from({ length: 6 }, (_, board) => Array.from({ length: CHAIN_BLOCK }, (_, i) => {
    const face = puzzle.cycle[(board * CHAIN_BLOCK + i) % CHAIN_CYCLE];
    if (!face) throw new Error("Missing legacy face");
    return { ...face, x: i * 15, y: 50 };
  })) };
  const oldTaps = solve(legacy);
  check(replayChain(legacy, { taps: oldTaps, reason: "complete" }).links === 30, "Legacy cycle fallback changed");
  const thirty: ChainPuzzleData = { ...puzzle, rulesVersion: undefined, boards: puzzle.boards.slice(0, 6), cycles: puzzle.cycles?.slice(0, 6) };
  for (const old of [legacy, thirty]) {
    const oldTaps = solve(old);
    for (let links = 0; links <= 30; links++) {
      const oldGrade = gradeSubmission(old, encodeChainAnswer({ taps: oldTaps.slice(0, links), reason: "timer" }), 45000 - links * 1000);
      check(oldGrade.score === links * 5 && oldGrade.isCorrect === (links === 30), "Old 30-link grading changed");
    }
    check(chainWindowMs(11, old) === 2500 && chainWindowMs(19, old) === 2000, "Old momentum changed");
    for (const link of [11, 19, 30]) {
      const previous = oldTaps[link - 2], next = oldTaps[link - 1];
      if (!previous || !next) throw new Error("Missing old tap");
      const atEdge = { ...next, t: previous.t + chainWindowMs(link, old) };
      check(replayChain(old, { taps: [...oldTaps.slice(0, link - 1), atEdge], reason: "timer" }).links === link, "Old edge rejected");
      check(replayChain(old, { taps: [...oldTaps.slice(0, link - 1), { ...atEdge, t: atEdge.t + 1 }], reason: "timer" }).reason === "momentum", "Old lapse accepted");
    }
    check(!chainDemoCompatible(old), "Old demo still accepted");
  }
  const first = taps[0];
  if (!first) throw new Error("Missing first tap");
  check(replayChain(puzzle, { taps: [{ ...first, t: 44000 }], reason: "timer" }).links === 1, "First tap incorrectly timed");
  const last = taps.at(-1);
  if (!last) throw new Error("Missing final tap");
  const finalAtDeadline = { ...last, t: 45001 };
  check(replayChain(puzzle, { taps: [...taps.slice(0, 39), finalAtDeadline], reason: "complete" }).links === 39, "Late completion accepted");

}
check(CHAIN_LENGTH === 40 && CHAIN_BLOCK === 5 && CHAIN_BOARDS === 8 && CHAIN_TIME_MS === 45000, "Chain configuration incorrect");
check(JSON.stringify(CHAIN_FASTER_AT) === "[10,20,30]", "FASTER prompts incorrect");
check([1,13,14,26,27,40].map((link) => chainWindowMs(link)).join() === "3000,3000,2500,2500,2000,2000", "Momentum changed");
for (let links = 0; links < 40; links++) check(chainScore(links, 45000) === Math.floor(3.5 * links), "Unfinished formula changed");
for (let ms = 0; ms <= 45000; ms++) check(chainScore(40, ms) === 140 + Math.round(10 * Math.min(1, ms / 22500)), "Finish bonus mismatch (speed par)");
check(chainScore(40, 50000) === 150 && chainScore(40, -10) === 140, "Score bounds failed");
// chainCycleRev 1 (puzzle score rev 1): floor(110 × (links ÷ 39)^0.45) unfinished, 0 for none, 110 one short, a finish still 120+.
const longPuzzle = generateChain(1);
check(CHAIN_CYCLE_REV_CREDIT.length === 40 && CHAIN_CYCLE_REV_CREDIT.every((v, n) => v === Math.floor(110 * Math.pow(n / 39, 0.45)) && (n === 0 || v > CHAIN_CYCLE_REV_CREDIT[n - 1]!)), "Five-symbol credit table");
withPuzzleScoreRev(1, () => {
  for (let links = 0; links < 40; links++) check(chainScore(links, 45000, longPuzzle) === CHAIN_CYCLE_REV_CREDIT[links], "Five-symbol unfinished credit");
  check(chainScore(40, 0, longPuzzle) === 120 && chainScore(40, 45000, longPuzzle) === 150, "Five-symbol finish");
  const v2 = generateChainV2(1);
  for (let links = 0; links < 40; links++) check(chainScore(links, 45000, v2) === Math.floor((110 * links) / 39), "Three-symbol rev-1 credit changed");
});
console.log("Chain: 200/200 seeded regeneration per generator (three- and five-symbol), the reversed board from link 20, five-symbol credit, eight changing cycles, current decoys, scatter, full/partial server grades, boundary taps, momentum and legacy 30-link full/partial grading, old momentum, demo invalidation and 45,001 finish-bonus checks passed.");