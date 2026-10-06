import { generateChain } from "../src/lib/duel/chain.server";
import { chainBoardIndex, chainCycleAt, chainRequiredAt, chainRuleStep, chainWindowMs, decodeChainAnswer, encodeChainAnswer, replayChain, type ChainTap } from "../src/lib/duel/chain";
import { gradeSubmission } from "../src/lib/duel/grade";
import { CHAIN_BLOCK, CHAIN_BOARDS, CHAIN_CYCLE, CHAIN_FASTER_AT, CHAIN_LENGTH, CHAIN_TIME_MS, CHAIN_BOARD_H_PX, CHAIN_BOARD_W_PX, CHAIN_NODE_GAP_PX, CHAIN_NODE_PX, type ChainPuzzleData, type ChainRuleItem } from "../src/lib/duel/types";
import { withSeededRandom } from "../src/lib/duel/random";

function check(ok: boolean, label: string) { if (!ok) throw new Error(label); }
const same = (a: ChainRuleItem, b: ChainRuleItem) => a.shape === b.shape && a.colour === b.colour;
function solve(puzzle: ChainPuzzleData): ChainTap[] {
  const taps: ChainTap[] = [];
  const used: number[][] = [];
  for (let link = 0; link < CHAIN_LENGTH; link++) {
    const board = chainBoardIndex(link);
    const need = chainRequiredAt(puzzle, link);
    if (!need) throw new Error("Missing required symbol");
    const node = puzzle.boards[board]?.findIndex((face, i) => same(face, need) && !(used[board] ?? []).includes(i)) ?? -1;
    check(node >= 0, `Missing node at link ${link + 1}`);
    (used[board] ??= []).push(node);
    taps.push({ node, t: (link + 1) * 1000 });
  }
  return taps;
}

for (let seed = 0; seed < 200; seed++) {
  const puzzle = generateChain(seed);
  check(JSON.stringify(puzzle) === JSON.stringify(generateChain(seed)), "Seed regeneration differs");
  check(JSON.stringify(withSeededRandom(seed, () => generateChain())) === JSON.stringify(withSeededRandom(seed, () => generateChain())), "Fixed intro generation differs");
  check(puzzle.cycles?.length === CHAIN_BOARDS, "Missing board cycles");
  for (let board = 0; board < CHAIN_BOARDS; board++) {
    const cycle = chainCycleAt(puzzle, board * CHAIN_BLOCK);
    const nodes = puzzle.boards[board];
    if (!nodes) throw new Error("Missing board");
    check(cycle.length === CHAIN_CYCLE && new Set(cycle.map((c) => c.shape)).size === 3 && new Set(cycle.map((c) => c.colour)).size === 3, "Invalid cycle");
    check(chainRuleStep(puzzle, board * CHAIN_BLOCK) === 0, "New cycle doesn't restart");
    const previous = puzzle.cycles?.[board - 1];
    if (previous) {
      check(!cycle.every((c) => previous.some((p) => same(c, p))), "Symbol set unchanged");
      check(!cycle.every((c, i) => c.shape === previous[i]?.shape), "Order unchanged");
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
  check(replay.links === 30 && replay.reason === "complete", "Replay failed");
  const graded = gradeSubmission(puzzle, answer, CHAIN_TIME_MS - 30000);
  check(graded.score === 150 && graded.isCorrect, "Server score failed");
  for (const links of [0, 1, 12, 25, 26, 29, 30]) {
    const partial = gradeSubmission(puzzle, encodeChainAnswer({ taps: taps.slice(0, links), reason: "timer" }), CHAIN_TIME_MS - links * 1000);
    check(partial.score === links * 5 && partial.isCorrect === (links === 30), `Partial server score failed at ${links}`);
  }
  check(replayChain(puzzle, { taps: taps.slice(0, 25), reason: "complete" }).reason !== "complete", "Client completion claim accepted at 25");
  check(chainBoardIndex(25) === 5 && puzzle.boards.length === 6, "Sixth board missing");
  for (const link of [5, 10, 15, 20, 25]) {
    const need = chainRequiredAt(puzzle, link);
    const wrong = puzzle.boards[chainBoardIndex(link)]?.findIndex((n) => need && !same(n, need)) ?? -1;
    const broken = replayChain(puzzle, { taps: [...taps.slice(0, link), { node: wrong, t: (link + 1) * 1000 }], reason: "wrong" });
    check(broken.links === link && broken.reason === "wrong", "Boundary decoy accepted");
  }
  for (const link of [10, 11, 18, 19, 25, 26, 30]) {
    const tap = taps[link - 1];
    const previous = taps[link - 2];
    if (!tap || !previous) throw new Error("Missing timed tap");
    const prefix = taps.slice(0, link - 1);
    check(replayChain(puzzle, { taps: [...prefix, { ...tap, t: previous.t + chainWindowMs(link) }], reason: "timer" }).links === link, "Window edge rejected");
    const late = replayChain(puzzle, { taps: [...prefix, { ...tap, t: previous.t + chainWindowMs(link) + 1 }], reason: "timer" });
    check(late.links === link - 1 && late.reason === "momentum", "Late tap accepted");
  }
  // Legacy single-cycle stored boards must retain global cycle phase.
  const legacy: ChainPuzzleData = { type: "chain", cycle: puzzle.cycle, boards: Array.from({ length: CHAIN_BOARDS }, (_, board) => Array.from({ length: CHAIN_BLOCK }, (_, i) => {
    const face = puzzle.cycle[(board * CHAIN_BLOCK + i) % CHAIN_CYCLE];
    if (!face) throw new Error("Missing legacy face");
    return { ...face, x: i * 15, y: 50 };
  })) };
  check(replayChain(legacy, { taps: solve(legacy), reason: "complete" }).links === 30, "Legacy cycle fallback changed");
}
check(CHAIN_LENGTH === 30 && CHAIN_BLOCK === 5 && CHAIN_BOARDS === 6 && CHAIN_TIME_MS === 45000, "Chain configuration incorrect");
check(JSON.stringify(CHAIN_FASTER_AT) === "[10,18,26]", "FASTER prompts incorrect");
check([10,11,18,19,25,26,30].map(chainWindowMs).join() === "3000,2500,2500,2000,2000,2000,2000", "Momentum changed");
console.log("Chain: 200/200 seeded regeneration, six changing cycles, current decoys, scatter, full/partial server grades, boundary taps, momentum and legacy cycle fallback checks passed.");