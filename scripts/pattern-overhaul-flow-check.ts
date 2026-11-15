/**
 * The Pattern overhaul for Chroma Lines (flow, 15 Nov 2026; docs/design/game-reviews/pattern.md, Joe's agreed spec):
 *
 *  1. New deals carry flowRev 3; checks pinning the stamps before (pinPrePatternNov15) deal flowRev 2.
 *  2. flowRev 3's drawing rule (flow.ts flowDrawStep with `cut`): a step onto another colour's line cuts that line back
 *     to the square before the crossing; dots are still refused; flowRev 2 refuses the step. A still tap on a dot no
 *     longer clears its line on flowRev 3 (flowTapClears).
 *  3. The server grades a board drawn by the rule: a line cut by another counts only once rejoined, and a cell shared
 *     by two lines never counts for both (verifyFlow, the server's half of the rule).
 *  4. Every answer recorded before the overhaul (flowRev 2 and the flowRev 3 deal) grades exactly as recorded
 *     (scripts/fixtures/pattern-overhaul-flow-legacy.json.gz, scripts/pattern-overhaul-flow-record.ts).
 *  5. The help says what changed (and keeps the old lines for the stamps before).
 *  6. The sprites exist, are WebP with alpha and within budget, and the board draws them (beads with their symbols,
 *     the wall and cell tiles; no glow filter); the live pills show Pairs and Filled.
 *  7. Sounds: the new slots exist, the stage fires them, and a join plays one sound (no generic `correct`).
 *  8. The answer reveal (Joe, 15 Nov 2026): the Solution and Yours columns each drawn full width (one at a time under
 *     the switch, never half size), the player's board with unjoined pairs ringed and empty squares dotted, each pair
 *     as a bead chip (on route / another way / not joined), the numbers from the stored grade, plain labels, no "×";
 *     on the new stamp and an older one. Demos recorded before flowRev 3 stay stopped.
 *
 *   bun scripts/pattern-overhaul-flow-check.ts
 */
import { readFileSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";

import { gradeAnswer } from "../src/lib/duel/generate.server";
import { encodeFlowPaths, flowCutBack, flowCutsDealt, flowCutsLines, flowDrawStep, flowTapClears, verifyFlow } from "../src/lib/duel/flow";
import { pinPrePatternNov15 } from "../src/lib/duel/patternNov15";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";
import { FLOW_SYMBOL_PATH } from "../src/components/puzzles/pattern/flowArt";
import type { FlowColour, PuzzleData } from "../src/lib/duel/types";
import { roomPuzzle } from "./puzzle-fairness/run";

let failures = 0;
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else {
    failures++;
    console.log(`  FAIL ${message}`);
  }
}
type Flow = Extract<PuzzleData, { type: "flow" }>;

/* ------------------------------------------------------------------ 1. the stamp */
const live = roomPuzzle("flow", 4242) as Flow;
check(live.flowRev === 3, `a new deal carries flowRev 3 (got ${String(live.flowRev)})`);
check(flowCutsLines(live), "flowRev 3 cuts lines");
check(!flowTapClears(live), "flowRev 3: a still tap on a dot leaves its line");
const before = pinPrePatternNov15(true);
let old: Flow;
try {
  old = roomPuzzle("flow", 4242) as Flow;
  check(old.flowRev === 2, `pinned, the deal is flowRev 2 (got ${String(old.flowRev)})`);
  check(!flowCutsDealt(), "pinned, the help reads the old rule");
} finally {
  pinPrePatternNov15(before);
}
check(!flowCutsLines(old), "flowRev 2 never cuts");
check(flowTapClears(old), "flowRev 2: a still tap on a dot clears its line");
check(JSON.stringify(old.pairs) === JSON.stringify(live.pairs) && JSON.stringify(old.walls) === JSON.stringify(live.walls), "the new stamp keeps the same board");

/* ------------------------------------------------------------------ 2. the drawing rule */
// A 9 x 9 board: red joins 0 → 4 along the top row; blue starts at 18 and draws up through 9 into 2 (red's middle).
const pairs = [
  { colour: "RED" as FlowColour, a: 0, b: 4 },
  { colour: "BLUE" as FlowColour, a: 18, b: 22 },
];
const red = [0, 1, 2, 3, 4];
const start = [red, [18, 19, 20, 11]];
{
  const cutStep = flowDrawStep(start, 1, 2, pairs, [], null, true);
  check(!cutStep.rejected && cutStep.moved, "flowRev 3: a step onto another line is taken");
  check(cutStep.cut === 0, "flowRev 3: the step reports the line it cut");
  check(JSON.stringify(cutStep.paths[0]) === JSON.stringify([0, 1]), `flowRev 3: the crossed line is cut back to the square before the crossing (got ${JSON.stringify(cutStep.paths[0])})`);
  check(JSON.stringify(cutStep.paths[1]) === JSON.stringify([18, 19, 20, 11, 2]), "flowRev 3: the drawing line carries on through the crossing");
  check(start[0] === red && red.length === 5, "the step never mutates the paths it was given");
  const refused = flowDrawStep(start, 1, 2, pairs, [], null, false);
  check(refused.rejected && !refused.moved && refused.paths === start && refused.cut === null, "flowRev 2: a step onto another line is refused, nothing changes");
  // Next to the dot: nothing but the dot would be left, so the line is cleared.
  const nearDot = flowDrawStep([red, [18, 9]], 1, 1 + 0, pairs, [], null, true);
  check(nearDot.rejected, "a step that is not a neighbour is still refused with cut on");
  const atFirst = flowDrawStep([red, [18, 9, 10]], 1, 1, pairs, [], null, true);
  check(atFirst.cut === 0 && atFirst.paths[0]!.length === 0, "a line cut at its first square after the dot is cleared");
  const dot = flowDrawStep([red, [18, 9, 10, 11, 12, 13]], 1, 4, pairs, [], null, true);
  check(dot.rejected && dot.cut === null, "flowRev 3: another colour's dot is still refused");
  check(JSON.stringify(flowCutBack([5, 6, 7, 8], 7)) === "[5,6]" && flowCutBack([5, 6], 6).length === 0, "flowCutBack keeps the squares before the crossing");
  // The server grades the board by the same rule: red cut, then blue joined, red no longer counts until rejoined.
  const verdict = verifyFlow(pairs, cutStep.paths, []);
  check(!verdict.joined[0], "after the cut, the cut line is not joined");
  // A shared cell (a hand-made answer no flowRev 3 phone can send) never counts for both lines.
  const shared = verifyFlow(pairs, [red, [18, 19, 20, 11, 2, 3, 12, 13, 22]], []);
  check(shared.joined.filter(Boolean).length === 1, "two lines through one cell: only one of them counts");
}

/* ------------------------------------------------------------------ 3. a real board drawn by the rule, graded by the server */
{
  const solution = live.solution ?? [];
  check(solution.length === live.pairs.length, "the deal stores its solution (server side)");
  let paths: number[][] = live.pairs.map(() => []);
  const drawRoute = (index: number, route: number[]) => {
    let from: number | null = route[0]!;
    for (const cell of route.slice(1)) {
      const step = flowDrawStep(paths, index, cell, live.pairs, live.walls ?? [], from, true);
      if (step.moved) {
        paths = step.paths;
        from = null;
      }
    }
  };
  // Every pair along its solution route, each drag starting on its first dot.
  live.pairs.forEach((_, i) => drawRoute(i, solution[i]!));
  const g = gradeAnswer(live, encodeFlowPaths(paths), 30_000);
  check(g.isCorrect, "drawing every solution route by the rule solves the board on the server");
  const cutBoard = paths.map((p, i) => (i === 1 ? p.slice(0, Math.max(0, p.length - 2)) : p));
  const g2 = gradeAnswer(live, encodeFlowPaths(cutBoard), 0);
  check(!g2.isCorrect && g2.score < g.score, "a board with a line cut back is graded unfinished");
}

/* ------------------------------------------------------------------ 4. legacy answers grade exactly as recorded */
{
  const fixture = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/pattern-overhaul-flow-legacy.json.gz")).toString()) as {
    puzzles: PuzzleData[];
    cases: { p: number; answer: string; msLeft: number; score: number; correct: boolean; extra: unknown }[];
  };
  const stamps = new Set(fixture.puzzles.map((p) => (p as Flow).flowRev));
  check(stamps.has(2) && stamps.has(3), "the fixture holds flowRev 2 and flowRev 3 boards");
  let same = 0;
  for (const c of fixture.cases) {
    const g = gradeAnswer(fixture.puzzles[c.p]!, c.answer, c.msLeft);
    const ok = g.score === c.score && g.isCorrect === c.correct && JSON.stringify(g.extra ?? null) === JSON.stringify(c.extra);
    if (ok) same++;
    else check(false, `legacy case ${fixture.cases.indexOf(c)} (flowRev ${(fixture.puzzles[c.p] as Flow).flowRev}): ${c.score} recorded, ${g.score} now`);
  }
  check(same === fixture.cases.length && fixture.cases.length >= 100, `all ${fixture.cases.length} recorded answers grade as recorded (${same})`);
}

/* ------------------------------------------------------------------ 5. help */
{
  const text = (lines: { action: string; detail: string }[]) => lines.map((l) => `${l.action} ${l.detail}`).join(" ");
  const now = text(PUZZLE_INSTRUCTIONS.flow.how);
  check(/cut/i.test(now), "the help says drawing over a line cuts it back");
  check(/tap leaves it/i.test(now), "the help says a tap leaves a line as it is");
  check(!/tap a dot to clear/i.test(now), "the help no longer says a tap clears a line");
  check(/symbol/i.test(now), "the help mentions the beads' symbols");
  check(PUZZLE_INSTRUCTIONS.flow.how.filter((l) => !(l as { helpOnly?: boolean }).helpOnly).length <= 4, "at most four intro HOW lines");
  const prior = pinPrePatternNov15(true);
  try {
    const then = text(PUZZLE_INSTRUCTIONS.flow.how);
    check(/can’t cross/.test(then) && /tap a dot to clear/.test(then), "pinned to the stamps before, the help keeps the old rule");
  } finally {
    pinPrePatternNov15(prior);
  }
  const intro = readFileSync("src/puzzles/flow.tsx", "utf8");
  check(/drawing over another line\s+cuts it back/.test(intro), "the intro example's text says lines are cut");
}

/* ------------------------------------------------------------------ 6. the art */
const COLOURS: FlowColour[] = ["RED", "BLUE", "GREEN", "PURPLE", "PINK", "ORANGE", "BROWN", "YELLOW", "TEAL", "WHITE", "LIME", "SILVER"];
{
  let total = 0;
  const sprites = [...COLOURS.map((c) => `bead-${c.toLowerCase()}`), "wall", "cell"];
  for (const name of sprites) {
    const file = `public/pattern-art/flow/${name}.webp`;
    let bytes: Buffer;
    try {
      bytes = readFileSync(file);
    } catch {
      check(false, `${file} exists`);
      continue;
    }
    total += statSync(file).size;
    const webp = bytes.subarray(0, 4).toString() === "RIFF" && bytes.subarray(8, 12).toString() === "WEBP";
    check(webp, `${name}: a WebP`);
    const chunk = bytes.subarray(12, 16).toString();
    // Alpha: an extended WebP with the alpha flag, or a lossless one whose header says alpha is used.
    const alpha = chunk === "VP8X" ? (bytes[20]! & 0x10) !== 0 : chunk === "VP8L" ? ((bytes.readUInt32LE(21) >>> 28) & 1) === 1 : false;
    check(alpha, `${name}: has an alpha channel (${chunk})`);
    check(bytes.length <= 25_000, `${name}: ${bytes.length} bytes, within 25 KB`);
  }
  check(total <= 400_000, `the game's sprites total ${total} bytes, within 400 KB`);
  // Each symbol is distinct, and the close colours have different shapes.
  check(new Set(Object.values(FLOW_SYMBOL_PATH)).size === COLOURS.length && COLOURS.every((c) => !!FLOW_SYMBOL_PATH[c]), "every colour has its own symbol");

  const { flowPuzzle, FlowBoard } = await import("../src/puzzles/flow");
  const board = renderToStaticMarkup(
    createElement(FlowBoard, {
      pairs: COLOURS.map((colour, i) => ({ colour, a: i * 2, b: i * 2 + 1 })).slice(0, 12),
      paths: COLOURS.map(() => []),
      walls: [40, 50],
    }),
  );
  for (const c of COLOURS) check(board.includes(`/pattern-art/flow/bead-${c.toLowerCase()}.webp`), `the board draws the ${c.toLowerCase()} bead`);
  check(board.includes("/pattern-art/flow/wall.webp"), "the board draws the wall tile");
  check(board.includes("/pattern-art/flow/cell.webp"), "the board draws the cell tile");
  check((board.match(/class="flow-symbol"/g) ?? []).length === 24, "every bead carries its symbol");
  check(!/feGaussianBlur|flow-halo/.test(board), "no glow filter on the board");
  const tubes = renderToStaticMarkup(
    createElement(FlowBoard, { pairs: pairs, paths: [red, []], walls: [] }),
  );
  check(!/feGaussianBlur/.test(tubes), "no glow on the lines");

  const stageSrc = readFileSync("src/puzzles/flow.tsx", "utf8");
  check(/id: "pairs", label: "Pairs"/.test(stageSrc) && /id: "filled", label: "Filled"/.test(stageSrc), "the live pills show Pairs and Filled");

}

/* ------------------------------------------------------------------ 7. sounds */
{
  const manifest = SOUND_MANIFEST as unknown as Record<string, { url: string | null; frequency: number; channel: string }>;
  for (const slot of ["flow.draw", "flow.cut", "flow.nearMiss", "flow.connect", "flow.solve"]) check(!!manifest[slot], `manifest slot ${slot}`);
  for (const slot of ["flow.draw", "flow.cut", "flow.nearMiss"]) check(manifest[slot]!.frequency === 0 && manifest[slot]!.channel === "effects", `${slot}: an effects slot with no placeholder beep`);
  const stage = readFileSync("src/puzzles/flow.tsx", "utf8");
  check(/soundCue\("flow\.draw", /.test(stage), "the stage plays flow.draw as the line grows (pitched by its length)");
  check(/soundCue\("flow\.cut"\)/.test(stage), "the stage plays flow.cut when a line is cut");
  check(/soundCue\("flow\.nearMiss"\)/.test(stage), "the stage plays flow.nearMiss once on a near miss");
  check(!/playCorrect/.test(stage), "a join and the solve play no extra generic correct (one sound a moment)");
  const lines = readFileSync("docs/sound-cues/pattern-elevenlabs.md", "utf8");
  const section = lines.slice(lines.indexOf("<!-- chroma:start -->"), lines.indexOf("<!-- chroma:end -->"));
  for (const slot of ["flow.draw", "flow.cut", "flow.connect", "flow.nearMiss", "flow.solve"]) check(section.includes(`\`${slot}\``), `an ElevenLabs line for ${slot}`);
}

/* ------------------------------------------------------------------ 8. the answer reveal */
{
  const { flowPuzzle, flowRevealView } = await import("../src/puzzles/flow");
  const Reveal = flowPuzzle.Reveal!;
  const render = (p: Flow, answer: string, correct: boolean, extra: unknown, msLeft?: number) =>
    renderToStaticMarkup(createElement(Reveal, { puzzle: p, myAnswer: answer, myCorrect: correct, myReactionAvgMs: null, myMsRemaining: msLeft, timeLimitMs: 75_000, myExtra: extra } as never));
  const count = (html: string, attr: string) => (html.match(new RegExp(attr, "g")) ?? []).length;
  const prior = pinPrePatternNov15(true);
  let older: Flow;
  try {
    older = roomPuzzle("flow", 777) as Flow;
  } finally {
    pinPrePatternNov15(prior);
  }
  for (const p of [live, older, roomPuzzle("flow", 778) as Flow]) {
    const era = `flowRev ${p.flowRev}`;
    const sol = p.solution!;
    // Solved, as the server graded it.
    const solvedAnswer = encodeFlowPaths(sol);
    const gs = gradeAnswer(p, solvedAnswer, 30_000);
    const done = render(p, solvedAnswer, gs.isCorrect, gs.extra, 30_000);
    check(gs.isCorrect, `${era}: the solution grades as solved`);
    check(/data-flow-solution/.test(done) && /data-flow-yours/.test(done), `${era}: Solution and Yours columns`);
    check(/>Solution</.test(done) && />Yours</.test(done), `${era}: the switch's plain labels`);
    check(!/data-yours-only/.test(done), `${era}: no data-yours-only (the Solution board is never shrunk by it)`);
    check(/You: every pair joined in 45\.0 s/.test(done), `${era}: the solved line`);
    check(new RegExp(`Pairs[\\s\\S]*?${p.pairs.length}/${p.pairs.length}`).test(done), `${era}: Pairs pill from the stored grade`);
    const redraws = (gs.extra as { redraws?: number } | undefined)?.redraws;
    check(typeof redraws === "number" ? /Redraws/.test(done) : !/Redraws/.test(done), `${era}: Redraws pill only when the grade stores a count`);
    const withRedraws = render(p, solvedAnswer, true, { ...(gs.extra as object), redraws: 2 }, 30_000);
    check(/Redraws[\s\S]*?>2</.test(withRedraws), `${era}: a stored redraw count shows in its pill`);
    check(/Time left[\s\S]*?30 s/.test(done), `${era}: Time left pill`);
    check(count(done, "data-flow-missed") === 0 && count(done, "data-flow-empty") === 0, `${era}: a solved board has no highlights`);
    check(count(done, 'data-state="route"') === p.pairs.length, `${era}: every pair chip on route`);
    check(!/×/.test(done), `${era}: no stray × (solved)`);
    // Unfinished: two pairs left off; the stored grade's numbers are shown, and the misses are marked.
    const left = sol.map((path, i) => (i < 2 ? [] : path));
    const answer = encodeFlowPaths(left);
    const gu = gradeAnswer(p, answer, 0);
    const extra = gu.extra as { pairsJoined: number; filled: number };
    const part = render(p, answer, gu.isCorrect, gu.extra);
    check(!gu.isCorrect, `${era}: two pairs left off is unfinished`);
    check(count(part, "data-flow-missed") === 4, `${era}: both dots of each unjoined pair are ringed (${count(part, "data-flow-missed")})`);
    const emptyWant = sol[0]!.length - 2 + sol[1]!.length - 2;
    check(count(part, "data-flow-empty") === emptyWant, `${era}: every square left empty is marked (${count(part, "data-flow-empty")} of ${emptyWant})`);
    check(count(part, 'data-state="open"') === 2, `${era}: two pair chips not joined`);
    check(part.includes(`You: ${extra.pairsJoined} of ${p.pairs.length} pairs, ${extra.filled} of ${81 - (p.walls ?? []).length} squares`), `${era}: the unfinished line from the stored grade`);
    check(part.includes(`${extra.pairsJoined}/${p.pairs.length}`) && part.includes(`${extra.filled}/${81 - (p.walls ?? []).length}`), `${era}: pills read the stored pairs and filled`);
    check(/Red ring: pair not joined/.test(part) && /Red dot: square left empty/.test(part), `${era}: the key explains the highlights`);
    check(!/×/.test(part), `${era}: no stray × (unfinished)`);
    // A round stored without those numbers still reads its answer.
    const bare = flowRevealView(p, answer, null);
    check(bare.pairsJoined === extra.pairsJoined && bare.filled === extra.filled, `${era}: with no stored numbers, the answer gives the same counts`);
    // The stored numbers win over the phone's reading.
    check(flowRevealView(p, answer, { pairsJoined: 3, filled: 9 }).pairsJoined === 3, `${era}: the stored grade's numbers are the ones shown`);
  }
  const noAnswer = render(live, "", false, null);
  check(/You: no lines drawn/.test(noAnswer), "no answer: \"You: no lines drawn\"");
  const css = readFileSync("src/polish-pattern/flow.css", "utf8");
  check(/\.flow-reveal-board \{\s*width: min\(100%/.test(css) && !/flow-reveal-board[^}]*\/ 2\)/.test(css), "each reveal board is sized to the full column, never half width");
  const demos = readFileSync("src/lib/duel/introDemo.functions.ts", "utf8");
  check(/data\.type === "flow"[^\n]*flowRev \?\? 0\) < 3\) return null/.test(demos), "demos recorded before flowRev 3 stay stopped");
}

if (failures) {
  console.log(`pattern-overhaul-flow-check: ${failures} failure(s), ${passes} passed`);
  console.log("FAIL pattern-overhaul-flow-check");
  process.exit(1);
}
console.log(`PASS pattern-overhaul-flow-check (${passes} checks)`);
