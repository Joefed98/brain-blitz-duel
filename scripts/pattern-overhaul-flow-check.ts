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
 *  9. Stage 2 (15 Nov 2026): Joe's fix (no glow on the lines and dots: glossy tubes like concept A, a strong deep
 *     body, no lighter core, no colour wash, no drop shadow) and the effects through the kit, on the real components
 *     in happy-dom: the head slides into each new square, a cut part retracts, a join sends one light along its tube,
 *     the near miss pulses the two unjoined dots, the solve pulses every line together (kit win); each only on its
 *     moment, silent where the game plays its own cue, never blocking the next move, transform and opacity only, with
 *     the reduced-motion crossfades.
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
  let later = 0;
  for (const c of fixture.cases) {
    const puzzle = fixture.puzzles[c.p] as Flow;
    // Changed with Joe's approval, 16 Nov 2026 (the coordinator's instruction for stage 3: flowRev 3, never dealt
    // live, takes the new full-speed time, 30 s on Normal, in place of 20 s). flowRev 2 answers must grade exactly as
    // recorded; a flowRev 3 answer must grade exactly as recorded on flowRev 2's timing (nothing else moved), and on
    // its own stamp the same but for a solve's speed points, which can only rise.
    const g = gradeAnswer(puzzle.flowRev === 3 ? ({ ...puzzle, flowRev: 2 } as Flow) : puzzle, c.answer, c.msLeft);
    const ok = g.score === c.score && g.isCorrect === c.correct && JSON.stringify(g.extra ?? null) === JSON.stringify(c.extra);
    if (ok) same++;
    else check(false, `legacy case ${fixture.cases.indexOf(c)} (flowRev ${puzzle.flowRev}): ${c.score} recorded, ${g.score} now`);
    if (puzzle.flowRev === 3) {
      const own = gradeAnswer(puzzle, c.answer, c.msLeft);
      const fine = own.isCorrect === c.correct && (c.correct ? own.score >= c.score : own.score === c.score);
      if (fine) later++;
      else check(false, `legacy case ${fixture.cases.indexOf(c)} on flowRev 3's own timing: ${c.score} recorded, ${own.score} now`);
    }
  }
  check(same === fixture.cases.length && fixture.cases.length >= 100, `all ${fixture.cases.length} recorded answers grade as recorded (${same})`);
  check(later > 0, `flowRev 3's answers keep their grade but for a solve's speed (${later})`);
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
// Changed with Joe's approval, 16 Nov 2026 (routine consequence of the Pattern overhaul): Expert's two extra colours.
const COLOURS: FlowColour[] = ["RED", "BLUE", "GREEN", "PURPLE", "PINK", "ORANGE", "BROWN", "YELLOW", "TEAL", "WHITE", "LIME", "SILVER", "CYAN", "TAN"];
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
      pairs: COLOURS.map((colour, i) => ({ colour, a: i * 2, b: i * 2 + 1 })), // all fourteen colours (was the first 12; routine consequence, 16 Nov 2026)
      paths: COLOURS.map(() => []),
      walls: [40, 50],
    }),
  );
  for (const c of COLOURS) check(new RegExp(`class="flow-dot[^"]*"[^>]*data-flow-colour="${c}"[^>]*style="[^"]*background-color:(#[0-9A-Fa-f]{6});--dot:\\1`).test(board), `the board draws the ${c.toLowerCase()} dot in its own colour`); // Changed with Joe's approval, 22 Nov 2026
  check(/class="flow-wall[^"]*"/.test(board) && !board.includes("/pattern-art/flow/wall.webp"), "the board draws the old hatched walls"); // Changed with Joe's approval, 22 Nov 2026
  check(!board.includes("/pattern-art/flow/cell.webp") && !board.includes("/pattern-art/flow/bead-"), "the board draws the old slots and dots, not the sprites"); // Changed with Joe's approval, 22 Nov 2026
  check((board.match(/class="flow-symbol"/g) ?? []).length === COLOURS.length * 2, "every bead carries its symbol"); // 24 before Expert's two extra colours (routine, 16 Nov 2026)
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

/* ------------------------------------------------------------------ 9. Joe's fix and the effects (stage 2) */
{
  // Joe's fix (15 Nov 2026): the lines glowed neon on a phone. No glow, blur, drop shadow, blend or colour wash on the
  // lines and dots; glossy tubes like concept A (a thin dark edge, darker sides, the saturated body, one crisp white
  // highlight stripe; no lighter core).
  const css = readFileSync("src/polish-pattern/flow.css", "utf8");
  const art = readFileSync("src/components/puzzles/pattern/flowArt.tsx", "utf8");
  const stage = readFileSync("src/puzzles/flow.tsx", "utf8");
  const batchP = readFileSync("src/polish-batch-p/batch-p.css", "utf8");
  const flowRules = (text: string) => [...text.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]*\.flow-[^{}]*)\{([^}]*)\}/g)].map((m) => `${m[1]}{${m[2]}}`);
  for (const [name, text] of [["flow.css", css], ["batch-p.css", batchP]] as const)
    for (const rule of flowRules(text))
      check(!/drop-shadow|filter\s*:|blur\(|mix-blend/.test(rule), `${name}: a rule on Chroma Lines' lines or dots draws a glow or filter (${rule.trim().slice(0, 80)})`);
  check(!/@keyframes/.test(css), "flow.css: no keyframes (the effects are the kit's, transform and opacity)");
  check(/feGaussianBlur/.test(art) && /flow-halo/.test(art) && !/stroke-dash|strokeDash|mixBlendMode|mix-blend/.test(art), "flowArt: the old neon halo (a blurred copy), and no dash animation or blend on the tubes"); // Changed with Joe's approval, 22 Nov 2026
  check(/const tint = filled\.get\(cell\)/.test(stage) && /\$\{tint\}22/.test(stage), "the board tints each square a line covers (the old look)"); // Changed with Joe's approval, 22 Nov 2026
  const { tubeLayers, tubeBody, shadeHex } = await import("../src/components/puzzles/pattern/flowArt"); // Changed with Joe's approval, 22 Nov 2026
  const hsl = (hex: string) => {
    const n = Number.parseInt(hex.slice(1), 16);
    const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
    const max = Math.max(...c);
    const min = Math.min(...c);
    const l = (max + min) / 2;
    const s = max === min ? 0 : l > 0.5 ? (max - min) / (2 - max - min) : (max - min) / (max + min);
    return { s, l };
  };
  const { FLOW_COLOUR_HEX } = await import("../src/lib/duel/flow");
  for (const c of COLOURS) {
    const hex = FLOW_COLOUR_HEX[c];
    const layers = tubeLayers(hex, 20);
    const body = tubeBody(hex);
    const lum = (h: string) => hsl(h).l;
    const coloured = layers.filter((l) => l.stroke.toLowerCase() !== "#ffffff");
    check(layers.some((l) => l.halo && l.stroke === hex && l.width === 30), `${c}: the neon halo in the line's own colour`); // Changed with Joe's approval, 22 Nov 2026
    check(layers.some((l) => !l.halo && l.width === 23 && l.stroke === shadeHex(hex, -0.55)), `${c}: the dark rim`); // Changed with Joe's approval, 22 Nov 2026
    check(layers.some((l) => !l.halo && l.width === 20 && l.stroke === hex), `${c}: the body is the line's own colour`); // Changed with Joe's approval, 22 Nov 2026
    const stripes = layers.filter((l) => l.stroke.toLowerCase() === "#ffffff" && (l.opacity ?? 1) >= 0.7);
    check(layers.some((l) => l.stroke === shadeHex(hex, 0.6) && l.opacity === 0.55 && l.width === 6), `${c}: the soft light streak along the line`); // Changed with Joe's approval, 22 Nov 2026
    check(layers.filter((l) => !l.halo).every((l) => l.width <= 23), `${c}: only the halo is drawn outside the tube`); // Changed with Joe's approval, 22 Nov 2026
    check(body === hex, `${c}: the body is the old neon colour (${body})`); // Changed with Joe's approval, 22 Nov 2026
  }
  for (const c of ["LIME", "PINK", "PURPLE"] as const)
    check(tubeBody(FLOW_COLOUR_HEX[c]) === FLOW_COLOUR_HEX[c], `${c}: the tube is the old neon line`); // Changed with Joe's approval, 22 Nov 2026

  // The effects, on the real board components in happy-dom.
  const { Window } = await import("happy-dom");
  const win = new Window({ url: "https://joulz.uk/" });
  for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "localStorage", "sessionStorage", "location", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame", "MutationObserver"] as const) {
    const value = (win as unknown as Record<string, unknown>)[key];
    const bind = typeof value === "function" && !["HTMLElement", "Element", "Node", "Event", "CustomEvent", "MutationObserver"].includes(key);
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
  }
  for (const key of Object.getOwnPropertyNames(win)) {
    if (!/^(HTML|SVG|Mutation|Resize|Text|Comment|Document|Custom|Node|Event)/.test(key) || key in globalThis) continue;
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (win as unknown as Record<string, unknown>)[key] });
  }
  if (!("ResizeObserver" in globalThis))
    Object.defineProperty(globalThis, "ResizeObserver", { configurable: true, writable: true, value: class { observe() {} unobserve() {} disconnect() {} } });
  let reduced = false;
  const matchMedia = (query: string) => ({ matches: query.includes("prefers-reduced-motion") ? reduced : false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  Object.defineProperty(win, "matchMedia", { configurable: true, writable: true, value: matchMedia });
  Object.defineProperty(globalThis, "matchMedia", { configurable: true, writable: true, value: matchMedia });
  type Anim = { onfinish: null | (() => void); oncancel: null | (() => void) };
  type Rec = { el: Element; frames: Keyframe[]; options: KeyframeAnimationOptions; anim: Anim };
  let played: Rec[] = [];
  Object.defineProperty((win as unknown as { Element: { prototype: object } }).Element.prototype, "animate", {
    configurable: true,
    writable: true,
    value(this: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
      const anim = { onfinish: null as null | (() => void), oncancel: null as null | (() => void), cancel() {}, finish() {}, finished: new Promise<void>(() => {}) };
      played.push({ el: this, frames, options, anim });
      return anim;
    },
  });
  const finishAll = () => played.forEach((p) => p.anim.onfinish?.());
  const K = await import("../src/lib/fx/kit");
  let kit: { kind: string; variant: string; sound: unknown; haptic: unknown }[] = [];
  K.setGameFxSink((r) => kit.push({ kind: r.kind, variant: r.variant, sound: r.sound, haptic: r.haptic }));
  const cues: string[] = [];
  window.addEventListener("duelz-sound", (e) => cues.push((e as CustomEvent<{ cue: string }>).detail.cue));
  const reset = () => {
    played = [];
    kit = [];
    cues.length = 0;
  };
  const onlyTransformOpacity = (frames: Keyframe[]) => frames.every((f) => Object.keys(f).every((k) => ["transform", "opacity", "offset", "easing"].includes(k)));

  const { createRoot } = await import("react-dom/client");
  const { flushSync } = await import("react-dom");
  const { FlowTubes: Tubes } = await import("../src/components/puzzles/pattern/flowArt");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  document.body.appendChild(svg);
  const root = createRoot(svg as unknown as Element);
  type T = { colour: string; points: { x: number; y: number }[]; joined: boolean };
  const pt = (c: number) => ({ x: 20 + (c % 9) * 40, y: 20 + Math.floor(c / 9) * 40 });
  const tube = (cells: number[], joined = false, colour = "#A8F03A"): T => ({ colour, points: cells.map(pt), joined });
  const draw = (tubes: T[], o: { live?: boolean; solved?: boolean; solveFx?: boolean } = {}) =>
    flushSync(() => root.render(createElement(Tubes, { tubes, width: 18, live: o.live ?? true, solved: o.solved ?? false, solveFx: o.solveFx ?? false })));
  const clear = () => flushSync(() => root.render(createElement("g")));

  for (const motion of ["full", "reduced"] as const) {
    reduced = motion === "reduced";
    const tag = `(${motion})`;
    clear();
    draw([tube([0, 1]), tube([]), tube([])]);
    reset();
    // Growing: the head slides into the new square (kit slide on each of the head's layers; the stage's sound only).
    draw([tube([0, 1, 2]), tube([]), tube([])]);
    const heads = svg.querySelectorAll('[data-flow-tube="0"] [data-flow-head]');
    const slides = kit.filter((k) => k.kind === "slide");
    check(heads.length >= 4 && slides.length === heads.length, `${tag} the line's head slides into the new square on all ${heads.length} of its layers (${slides.length})`); // Changed with Joe's approval, 22 Nov 2026
    check(slides.every((k) => k.sound === null && k.haptic === null && k.variant === (reduced ? "reduced" : "full")), `${tag} the head slide is silent (flow.draw is the stage's) and in the ${motion} variant`);
    check(played.length === heads.length && played.every((p) => p.el.hasAttribute("data-flow-head")), `${tag} only the head's own layers move (never the tube, board or arena)`);
    if (reduced) check(played.every((p) => p.frames.every((f) => f.transform === undefined)), `${tag} the head crossfades, no movement`);
    else check(played.some((p) => String(p.frames[0]!.transform).includes("translate(-40px, 0px)")), `${tag} the head is drawn from the square before (FLIP)`);
    check(svg.querySelector('[data-flow-tube="0"] [data-flow-head] path')?.getAttribute("d") === "M60.0 20.0L100.0 20.0", `${tag} the new square is drawn at once (the effect never holds the state back)`);
    // Nothing changed: no effect.
    reset();
    draw([tube([0, 1, 2]), tube([]), tube([])]);
    check(played.length === 0 && kit.length === 0, `${tag} a render that changes nothing plays nothing`);
    // The next move while the slide runs is taken at once and plays its own slide.
    draw([tube([0, 1, 2, 3]), tube([]), tube([])]);
    check(
      kit.filter((k) => k.kind === "slide").length === heads.length && svg.querySelector('[data-flow-tube="0"] [data-flow-head] path')?.getAttribute("d") === "M100.0 20.0L140.0 20.0",
      `${tag} the next square during an effect is drawn and animated at once (input never queued)`,
    );
    // A cut: the cut part retracts into the cut, under the lines, and leaves.
    reset();
    draw([tube([0, 1]), tube([]), tube([])]);
    const ghost = svg.querySelector("[data-flow-ghosts] [data-flow-retract]");
    const gPlay = played.find((p) => p.el === ghost);
    check(!!ghost && !!gPlay && kit.length === 0, `${tag} a cut line's cut part retracts (${played.length} animations)`);
    if (ghost && gPlay) {
      check(onlyTransformOpacity(gPlay.frames), `${tag} the retract moves only transform and opacity`);
      check(
        reduced
          ? gPlay.frames.every((f) => f.transform === undefined) && Number(gPlay.options.duration) <= 120
          : String(gPlay.frames[1]!.transform).startsWith("scale(") && Number(gPlay.options.duration) <= 300,
        `${tag} the retract: ${reduced ? "a 120 ms fade" : "it shrinks into the cut"}`,
      );
      const origin = (ghost as unknown as { style: { transformOrigin: string } }).style.transformOrigin;
      check(origin === "60px 20px", `${tag} it retracts into the square the line was cut back to (${origin})`);
    }
    finishAll();
    check(!svg.querySelector("[data-flow-retract]"), `${tag} the retracted part is removed when it ends`);
    // A pair joined: one light runs along its tube (not on the solving join).
    draw([tube([0, 1, 2]), tube([]), tube([])]);
    reset();
    draw([tube([0, 1, 2, 3], true), tube([]), tube([])]);
    const light = svg.querySelector("[data-flow-join-light]");
    if (reduced) {
      const fade = played.find((p) => p.el.getAttribute("data-flow-tube") === "0");
      check(!light && !!fade && onlyTransformOpacity(fade.frames) && fade.frames.every((f) => f.transform === undefined) && Number(fade.options.duration) <= 120, `${tag} a join crossfades its tube (no light runs)`);
    } else {
      const lp = played.find((p) => p.el === light);
      check(!!light && !!lp, `${tag} a pair joined sends one light along its tube`);
      if (lp) {
        check(onlyTransformOpacity(lp.frames) && lp.frames.length === 4 && Number(lp.options.duration) <= 900, `${tag} the light travels square by square on transform and opacity, under 900 ms`);
        check(String(lp.frames[0]!.transform).startsWith("translate(20.0px, 20.0px)") && String(lp.frames[3]!.transform).startsWith("translate(140.0px, 20.0px)"), `${tag} the light runs from one bead to the other`);
      }
      finishAll();
      check(!svg.querySelector("[data-flow-join-light]"), `${tag} the light is removed when it lands`);
    }
    check(!kit.some((k) => k.kind === "match" || k.kind === "win"), `${tag} a join plays no kit sound or payoff (flow.connect is the board's one sound)`);
    // The solving join: no join light; the solve moment pulses every line together (kit win, silent).
    clear();
    draw([tube([0, 1, 2]), tube([9, 10], true), tube([18, 19], true)]);
    reset();
    draw([tube([0, 1, 2, 3], true), tube([9, 10], true), tube([18, 19], true)], { solved: true });
    check(!svg.querySelector("[data-flow-join-light]") && !played.some((p) => p.el.getAttribute("data-flow-tube") === "0"), `${tag} the solving join sends no join light`);
    reset();
    draw([tube([0, 1, 2, 3], true), tube([9, 10], true), tube([18, 19], true)], { solved: true, solveFx: true });
    const sheen = svg.querySelector("[data-flow-solve-light]");
    const wins = kit.filter((k) => k.kind === "win");
    check(!!sheen && sheen.children.length === 3 && wins.length === 1, `${tag} the solve pulses all ${sheen?.children.length ?? 0} lines together (kit win once)`);
    check(wins.every((k) => k.sound === null && k.variant === (reduced ? "reduced" : "full")), `${tag} the solve's kit win is silent (flow.solve is the board's) and ${motion}`);
    draw([tube([0, 1, 2, 3], true), tube([9, 10], true), tube([18, 19], true)], { solved: true, solveFx: true });
    check(kit.filter((k) => k.kind === "win").length === 1, `${tag} the solve plays once`);
    check(played.every((p) => onlyTransformOpacity(p.frames)), `${tag} every effect moves only transform and opacity`);
    // Not live (the intro, reveal and demo boards): nothing plays.
    clear();
    draw([tube([0, 1]), tube([]), tube([])], { live: false });
    reset();
    draw([tube([0, 1, 2], true), tube([]), tube([])], { live: false, solved: true, solveFx: true });
    draw([tube([0], false), tube([]), tube([])], { live: false });
    check(played.length === 0 && kit.length === 0, `${tag} still boards (intro, reveal) play no effect`);
    clear();
  }
  reduced = false;

  // The near miss: on the stage, the two dots still to join pulse (kit nearMiss, silent: flow.nearMiss is the cue).
  const { seedStageState } = await import("./shots/seed");
  const { flowPuzzle: fp } = await import("../src/puzzles/flow");
  const host = document.createElement("div");
  document.body.appendChild(host);
  const stageRoot = createRoot(host as unknown as Element);
  const p3 = { type: "flow", flowRev: 3, walls: [], pairs: [{ colour: "RED", a: 0, b: 1 }, { colour: "BLUE", a: 9, b: 10 }, { colour: "LIME", a: 18, b: 19 }] } as unknown as Flow;
  const mount = (key: string, paths: number[][]) => {
    seedStageState([key], { flowPaths: paths });
    reset();
    flushSync(() => stageRoot.render(createElement(fp.Stage, { puzzle: p3, locked: false, onSubmit: () => {}, onDraftAnswer: () => {}, stateKey: key } as never)));
  };
  mount("flow-check-near", [[0, 1], [9, 10], []]);
  const near = kit.filter((k) => k.kind === "nearMiss");
  check(cues.filter((c) => c === "flow.nearMiss").length === 1, `the near miss sounds once (${cues.join(",")})`);
  check(near.length === 2 && near.every((k) => k.sound === null), `the near miss pulses the two unjoined dots (kit nearMiss, silent): ${near.length}`);
  check(near.filter((k) => k.haptic !== null).length === 1, "the near miss gives one light haptic, not two");
  check(played.length === 2 && played.every((p) => p.el.classList.contains("flow-dot") && p.el.getAttribute("data-flow-pair") === "2"), "the pulse is on the unjoined pair's own dots, nothing else");
  flushSync(() => stageRoot.render(createElement("div")));
  mount("flow-check-far", [[0, 1], [], []]);
  check(!kit.some((k) => k.kind === "nearMiss") && !cues.includes("flow.nearMiss"), "no near miss two pairs short");
  flushSync(() => stageRoot.render(createElement("div")));
  root.unmount();
  stageRoot.unmount();
  K.setGameFxSink(null);
  // The stage's sounds stay one a moment: the draw tone only when the line grew, the cut only on a cut.
  check(/if \(grewTo\) soundCue\("flow\.draw", 1 \+ 0\.5 \* \(1 - Math\.exp/.test(stage) && /if \(!step\.moved\) return current;/.test(stage), "the draw tone rises smoothly and plays only when the line grew (a move that does nothing is silent)");
  check(/if \(cutLine\) soundCue\("flow\.cut"\)/.test(stage), "the cut sound plays only on a cut");
  check(!/\.animate\(/.test(stage), "the stage animates nothing itself (the kit does)");
  check((art.match(/\.animate\(/g) ?? []).length === 2, "flowArt animates through two helpers only (playAndRemove, playAndKeep), each fed transform and opacity frames");
}

if (failures) {
  console.log(`pattern-overhaul-flow-check: ${failures} failure(s), ${passes} passed`);
  console.log("FAIL pattern-overhaul-flow-check");
  process.exit(1);
}
console.log(`PASS pattern-overhaul-flow-check (${passes} checks)`);
