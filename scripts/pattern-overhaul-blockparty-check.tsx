/**
 * pattern-overhaul-blockparty-check: Tessellate in the Pattern overhaul (15 Nov 2026; patternNov15.ts, blockRev 4).
 *
 * 1. Older stamps grade exactly as before: every answer in scripts/fixtures/pattern-overhaul-blockparty-legacy.json.gz
 *    (blockRev 3 and 2 boards, recorded before the grading change by pattern-overhaul-blockparty-record.ts) regrades
 *    to the same score, verdict and parts.
 * 2. New deals carry blockRev 4; the answer's `!n` illegal-drop entry round-trips and every placements reader skips it.
 * 3. blockRev 4's rule: moving a placed piece costs nothing (a solve with a piece moved scores as a clean solve, where
 *    blockRev 3 took a share off); each illegal drop takes one piece's share of the bonus; guessing never pays.
 * 4. The help and intro say what changed (a double tap only flips, Undo gives the move back, clean drops; no "anchor").
 * 5. The sprites exist, are WebP with alpha and within budget, and the stage, tray, board and reveal draw them; the
 *    stage on blockRev 4 has Undo and Reset (older stamps don't), holds a turn for the double-tap window, sounds the
 *    pick-up and the illegal drop.
 * 7. The answer reveal: two fit-target boards (Solution, Yours), sprites, red outlines on pieces off every solution
 *    spot and dashed marks on empty squares (unfinished only), and pills whose numbers are the stored grade's, on the
 *    new stamp, an older stamp and a round with no stored extra; no stray "×"; nothing under Solution but the board.
 * 6. The new sound slots exist in the manifest and each has its ElevenLabs line.
 * 9. Stage 2 (Joe's fixes and the effects, happy-dom): the studs are plain domes (no collar or cap in the source),
 *    the tray draws its own glossy render of the blocks; each effect goes through the effects kit, silent, on the
 *    piece's own element, on its moment only: a turn (spin + the kit's tap, blockparty.turn), a pick-up (the kit's
 *    pickUp on the piece under the finger, blockparty.pickup), a drop (the kit's drop on the placed piece and a
 *    one-shot flash on exactly its squares, blockparty.place), an illegal drop (the kit's slide home and wrong,
 *    blockparty.illegal, no place sound), a tray piece let go off the board (slides home, no sound), Undo (no drop
 *    effect), the solve (the shine across the board, each piece pulsing as it passes) and the reveal's result (the
 *    kit's win on a solve only); the next move is taken during an effect; reduced motion gives the kit's crossfades
 *    and cuts the flash and the sweep to a still glow; no other animation in the game's files but transform/opacity.
 */
import { readFileSync, statSync } from "node:fs";
import { gunzipSync } from "node:zlib";
import { renderToStaticMarkup } from "react-dom/server";

import { gradeAnswer } from "../src/lib/duel/generate.server";
import { pinPrePatternNov15, usesPatternNov15 } from "../src/lib/duel/patternNov15";
import {
  blockIllegalDrops,
  decodePlacements,
  encodeBlockAnswer,
  encodePlacements,
  verifyPlacements,
  blockGeometry,
} from "../src/lib/duel/blockParty";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";
import { BLOCK_SPRITE_COLOURS } from "../src/components/puzzles/pattern/blockPartyArt";
import { BlockBoard, BlockPartyPuzzle } from "../src/components/puzzles/BlockPartyPuzzle";
import { blockPartyPuzzle } from "../src/puzzles/blockParty";
import type { PuzzleData } from "../src/lib/duel/types";
import { blockCases, otherSpot, sent } from "./pattern-overhaul-blockparty-lib";
import { roomPuzzle } from "./puzzle-fairness/run";
import { challengeById, evaluateChallenge } from "../src/lib/duel/practiceChallenges";
import { STAR_SCORE } from "../src/lib/practice/progressRules";
import { BLOCKPARTY_NOV15_PRESENTATION, puzzlePresentation } from "../src/components/puzzles/wordInput";

type Block = Extract<PuzzleData, { type: "blockparty" }>;
const failures: string[] = [];
let passed = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passed++;
  else failures.push(message);
};

/* 1. Legacy regrade. */
{
  const fx = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/pattern-overhaul-blockparty-legacy.json.gz")).toString()) as {
    puzzles: PuzzleData[];
    cases: { p: number; answer: string; msLeft: number; score: number; correct: boolean; parts: unknown }[];
  };
  check(fx.cases.length >= 40, `legacy: only ${fx.cases.length} cases`);
  check(fx.puzzles.every((p) => !usesPatternNov15(p, "blockparty")), "legacy: a recorded board carries the new stamp");
  for (const c of fx.cases) {
    const g = gradeAnswer(fx.puzzles[c.p]!, c.answer, c.msLeft);
    const parts = (g.extra as Record<string, unknown> | undefined)?.["parts"] ?? null;
    check(
      g.score === c.score && g.isCorrect === c.correct && JSON.stringify(parts) === JSON.stringify(c.parts),
      `legacy: board ${c.p} graded ${g.score}/${g.isCorrect}, recorded ${c.score}/${c.correct}`,
    );
  }
  // The pinned deal is the old stamp and grades as before (the recorder's own path).
  const prev = pinPrePatternNov15(true);
  const pinned = roomPuzzle("blockparty", 9100) as Block;
  pinPrePatternNov15(prev);
  check(pinned.blockRev === 3, `legacy: the pinned deal is blockRev ${pinned.blockRev}`);
  check(JSON.stringify(pinned) === JSON.stringify(fx.puzzles[0]), "legacy: the pinned deal differs from the recorded board");
}

/* 2. The new stamp and the answer's illegal-drop entry. */
const seeds = [9100, 9113, 9126, 9139, 9152, 9165];
const live = seeds.map((s) => roomPuzzle("blockparty", s) as Block);
check(live.every((p) => p.blockRev === 4 && usesPatternNov15(p, "blockparty")), `deal: live boards are blockRev ${live.map((p) => p.blockRev).join(",")}`);
{
  const sol = live[0]!.solution ?? [];
  check(sol.length === 9, `deal: ${sol.length} pieces in the solution`);
  check(encodeBlockAnswer(sol, 0) === encodePlacements(sol), "encode: no illegal drops adds nothing");
  const withDrops = encodeBlockAnswer(sol, 3);
  check(withDrops.endsWith(";!3") && blockIllegalDrops(withDrops) === 3, `encode: ${withDrops.slice(-6)}`);
  check(JSON.stringify(decodePlacements(withDrops)) === JSON.stringify(decodePlacements(encodePlacements(sol))), "decode: the !n entry is not a placement");
  check(encodeBlockAnswer([], 2) === "!2" && decodePlacements("!2").length === 0 && blockIllegalDrops("!2") === 2, "encode: an empty board with drops");
  check(blockIllegalDrops(encodeBlockAnswer(sol, 5000)) === 999, "encode: the count is capped");
  check(blockIllegalDrops("0:1-2;!x") === 0 && blockIllegalDrops("") === 0, "decode: no count reads 0");
  check(verifyPlacements(live[0]!.blockers, decodePlacements(withDrops), blockGeometry(live[0]!)).solved, "verify: a solve with drops is still a solve");
}

/* 3. blockRev 4's rule. */
const parts = (g: ReturnType<typeof gradeAnswer>) => (g.extra as Record<string, unknown> | undefined)?.["parts"] as Record<string, number> | undefined;
for (const p of live) {
  const sol = p.solution ?? [];
  const clean = solveAt(p, sol, 0);
  const g = gradeAnswer(p, clean, 30_000);
  check(g.isCorrect && g.score === 200, `rule: a clean quick solve scores ${g.score}`);
  // The first piece dropped elsewhere first, then moved: no cost on blockRev 4.
  const first = sol[0]!;
  const elsewhere = otherSpot(p, [], first.piece, [...first.cells].sort((a, b) => a - b).join(","));
  if (elsewhere) {
    const drafts = [{ answer: encodePlacements([{ piece: first.piece, cells: elsewhere }]), at: 500 }, ...sol.map((_, i) => ({ answer: encodePlacements(sol.slice(0, i + 1)), at: 1000 + i * 1000 }))];
    const moved = gradeAnswer(p, sent(p, drafts), 30_000);
    check(moved.score === g.score, `rule: a solve with a piece moved scores ${moved.score}, a clean one ${g.score}`);
    // The same play on blockRev 3 still costs the bonus share.
    const old = { ...p, blockRev: 3 } as Block;
    const oldMoved = gradeAnswer(old, sent(old, drafts), 30_000);
    check(oldMoved.score < gradeAnswer(old, solveAt(old, sol, 0), 30_000).score, "rule: blockRev 3 still charges a moved piece");
  }
  // Illegal drops: each takes one piece's share of the 10-point bonus.
  const two = gradeAnswer(p, solveAt(p, sol, 2), 30_000);
  const pt = parts(two);
  check(two.isCorrect && Math.abs((pt?.["efficiency"] ?? -1) - (10 * 7) / 9) <= 0.5, `rule: two illegal drops leave a bonus of ${pt?.["efficiency"]}`);
  check(two.score < g.score, `rule: illegal drops cost (${two.score} vs ${g.score})`);
  const many = gradeAnswer(p, solveAt(p, sol, 40), 30_000);
  check(many.isCorrect && (parts(many)?.["efficiency"] ?? -1) === 0 && many.score >= 150, `rule: many illegal drops floor the bonus at 0 (${many.score})`);
  // Unfinished: never below the board's own credit, never paid for guessing.
  for (const c of blockCases(p, 77)) {
    const r = gradeAnswer(p, c.answer, c.msLeft);
    check(r.score >= 0 && r.score <= 200, `rule: ${c.label} scored ${r.score}`);
    if (c.label === "random") check(r.score <= 25, `rule: random drops scored ${r.score}`);
  }
  const half = sol.slice(0, 4);
  const halfClean = gradeAnswer(p, sent(p, half.map((_, i) => ({ answer: encodePlacements(half.slice(0, i + 1)), at: 4000 * (i + 1) }))), 0);
  const halfDrops = gradeAnswer(p, sent(p, half.map((_, i) => ({ answer: encodeBlockAnswer(half.slice(0, i + 1), 2), at: 4000 * (i + 1) }))), 0);
  check(!halfClean.isCorrect && halfDrops.score <= halfClean.score, `rule: unfinished with drops ${halfDrops.score} vs clean ${halfClean.score}`);
}
function solveAt(p: Block, sol: NonNullable<Block["solution"]>, drops: number): string {
  return sent(p, sol.map((_, i) => ({ answer: encodeBlockAnswer(sol.slice(0, i + 1), i === sol.length - 1 ? drops : 0), at: 1000 + i * 1000 })));
}

/* 4. Help and intro. */
{
  const ins = PUZZLE_INSTRUCTIONS.blockparty;
  const how = ins.how.map((l) => `${l.action} ${l.detail}`).join(" | ");
  check(/double-tap/i.test(how) && /flip/i.test(how) && /doesn’t turn first/.test(how), `help: the flip line: ${how}`);
  check(/Undo gives your last move back/.test(how) && /Reset/.test(how), "help: Undo and Reset are not explained");
  check(!/anchor/i.test(how), "help: still says anchor");
  check(ins.how.filter((l) => !l.helpOnly).length <= 4, "help: more than four intro lines");
  check(/Clean drops/.test(ins.score) && /moving a placed piece costs nothing/.test(ins.score) && !/right first time/.test(ins.score), `help: score text: ${ins.score}`);
  const intro = INTRO_SCORE.blockparty ?? "";
  check(/clean drops/.test(intro) && intro.length <= 90 && intro.includes("200"), `intro: ${intro}`);
  const ex = renderToStaticMarkup(<blockPartyPuzzle.IntroExample />);
  check(/double-tap to flip/.test(ex), "intro example: no flip line");
}

/* 5. Art, stage and reveal. */
{
  const names = [...BLOCK_SPRITE_COLOURS.map((c) => `block-${c}`), ...BLOCK_SPRITE_COLOURS.map((c) => `tray-${c}`), "well", "peg"];
  let total = 0;
  for (const name of names) {
    const file = `public/pattern-art/blockparty/${name}.webp`;
    let bytes: Buffer | null = null;
    try {
      bytes = readFileSync(file);
    } catch {
      check(false, `art: ${file} missing`);
      continue;
    }
    total += statSync(file).size;
    const riff = bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
    const chunk = bytes.toString("ascii", 12, 16);
    // VP8X with its alpha flag, or a lossless VP8L (always RGBA as written by sprite.py's PIL save).
    const alpha = (chunk === "VP8X" && (bytes[20]! & 0x10) !== 0) || chunk === "VP8L";
    check(riff && alpha, `art: ${name} is not a WebP with alpha (${chunk})`);
    check(bytes.length <= 25_000, `art: ${name} is ${bytes.length} bytes`);
  }
  check(total <= 400_000, `art: ${total} bytes in all`);

  const board = renderToStaticMarkup(<BlockBoard blockers={[0, 8]} placements={[{ piece: 3, cells: [1, 2, 3, 4] }]} cols={7} />);
  check(board.includes("/pattern-art/blockparty/peg.webp") && board.includes("/pattern-art/blockparty/well.webp"), "art: the board draws no well / peg sprites");
  check((board.match(/block-purple\.webp/g) ?? []).length === 4, "art: the placed piece draws no block per square");
  check((board.match(/peg\.webp/g) ?? []).length === 2 && (board.match(/well\.webp/g) ?? []).length === 47, "art: one sprite per board square");

  const stageProps = { phaseStartedAt: 0, now: 0, locked: false, onSubmit: () => {}, onDraftAnswer: () => {} };
  const stage = renderToStaticMarkup(<BlockPartyPuzzle puzzle={live[0]!} {...stageProps} />);
  // Stage 2 (Joe): the tray draws its own glossy render of the same blocks (changed with the tray sprites).
  check(/tray-red\.webp/.test(stage) && /tray-white\.webp/.test(stage), "art: the tray draws no block sprites");
  check(stage.includes('data-testid="blockparty-undo"') && stage.includes('data-testid="blockparty-reset"'), "stage: blockRev 4 has no Undo / Reset");
  check(/data-variant="secondary"/.test(stage), "stage: Undo / Reset are not the design system's buttons");
  const oldStage = renderToStaticMarkup(<BlockPartyPuzzle puzzle={{ ...live[0]!, blockRev: 3 }} {...stageProps} />);
  check(!oldStage.includes("blockparty-undo"), "stage: blockRev 3 shows Undo");

  const src = readFileSync("src/components/puzzles/BlockPartyPuzzle.tsx", "utf8");
  check(/DOUBLE_TAP_MS/.test(src) && /setHeld\(\{ piece: info\.item\.piece, pose: state \}\)/.test(src), "stage: a single tap's turn is not held for the double-tap window");
  check(/soundCue\("blockparty\.pickup"\)/.test(src) && /soundCue\("blockparty\.illegal"\)/.test(src), "stage: pick-up / illegal drop are silent");
  check(/soundCue\("blockparty\.undo"\)/.test(src) && /soundCue\("blockparty\.reset"\)/.test(src), "stage: Undo / Reset are silent");
  check(/encodeBlockAnswer\(list, drops\)/.test(src) && /setIllegal\(\(current\) => current \+ 1\)/.test(src), "stage: illegal drops are not sent");
  const flipBranch = src.slice(src.indexOf("if (double) {"), src.indexOf("} else {", src.indexOf("if (double) {")));
  check(flipBranch.includes('soundCue("blockparty.flip")') && !flipBranch.includes("blockparty.turn"), "stage: a double tap still sounds a turn");

  // The reveal (section 7 below) replaced the stage-1 "You: …" line.
}

/* 7. The answer reveal (Joe's reveal redesign, 15 Nov 2026). */
{
  const Reveal = blockPartyPuzzle.Reveal;
  const draw = (p: Block, answer: string, msLeft: number) => {
    const g = gradeAnswer(p, answer, msLeft);
    const html = renderToStaticMarkup(
      <Reveal puzzle={p} myAnswer={answer} myCorrect={g.isCorrect} myReactionAvgMs={null} myMsRemaining={msLeft} timeLimitMs={60_000} myExtra={g.extra as Record<string, unknown>} />,
    );
    return { g, html };
  };
  const pill = (html: string, id: string) => new RegExp(`data-hud-pill="${id}"[^>]*>(?:<span[^>]*>([^<]*)</span>)?<b[^>]*>([^<]*)</b>`).exec(html);
  const pillValue = (html: string, id: string) => pill(html, id)?.[2] ?? null;

  for (const [label, p] of [["new", live[1]!], ["old", fxPuzzle(0)]] as const) {
    const sol = p.solution ?? [];
    const pieces = blockGeometry(p).pieces.length;
    // Solved, with two illegal drops on the new stamp.
    const solved = draw(p, label === "new" ? encodeBlockAnswer(sol, 2) : sent(p, sol.map((_, i) => ({ answer: encodePlacements(sol.slice(0, i + 1)), at: 1000 + i * 1000 }))), 21_400);
    check(solved.g.isCorrect, `reveal ${label}: the solved answer isn't a solve`);
    check((solved.html.match(/data-reveal-board=""/g) ?? []).length === 2, `reveal ${label}: not one fit target per board`);
    check(/>Solution</.test(solved.html) && />Yours</.test(solved.html), `reveal ${label}: the Solution / Yours labels`);
    check(!/×/.test(solved.html), `reveal ${label}: a stray ×`);
    check(!/data-reveal-wrong|data-reveal-gap/.test(solved.html), `reveal ${label}: a solved board is marked`);
    check(pillValue(solved.html, "pieces") === `${pieces}/${pieces}`, `reveal ${label}: pieces pill ${pillValue(solved.html, "pieces")}`);
    check(pillValue(solved.html, "time") === "21 s", `reveal ${label}: time pill ${pillValue(solved.html, "time")}`);
    check(/block-\w+\.webp/.test(solved.html) && /peg\.webp/.test(solved.html), `reveal ${label}: no sprites`);
    const extra = solved.g.extra as Record<string, unknown>;
    if (label === "new") check(pillValue(solved.html, "illegal") === String(extra["illegalDrops"]) && extra["illegalDrops"] === 2, `reveal new: illegal pill ${pillValue(solved.html, "illegal")}`);
    else check(typeof extra["rightFirstTime"] === "number" && pillValue(solved.html, "first") === `${extra["rightFirstTime"]}/${pieces}` && pill(solved.html, "illegal") === null, `reveal old: first-time pill ${pillValue(solved.html, "first")}`);

    // Unfinished: two pieces in their spot, the first piece placed elsewhere.
    const first = sol[0]!;
    const elsewhere = otherSpot(p, sol.slice(1, 3), first.piece, [...first.cells].sort((a, b) => a - b).join(","));
    const mine = [...sol.slice(1, 3), ...(elsewhere ? [{ piece: first.piece, cells: elsewhere }] : [])];
    const part = draw(p, label === "new" ? encodeBlockAnswer(mine, 1) : encodePlacements(mine), 0);
    const stored = decodePlacements(String((part.g.extra as Record<string, unknown>)["placements"]));
    check(!part.g.isCorrect && stored.length === mine.length, `reveal ${label}: the unfinished answer graded ${stored.length} placements`);
    check(pillValue(part.html, "pieces") === `${stored.length}/${pieces}`, `reveal ${label}: unfinished pieces pill ${pillValue(part.html, "pieces")}`);
    const covered = Number((part.g.extra as Record<string, unknown>)["covered"]);
    check(pillValue(part.html, "gaps") === String(blockGeometry(p).free - covered), `reveal ${label}: gaps pill ${pillValue(part.html, "gaps")}`);
    const gaps = (part.html.match(/data-reveal-gap=/g) ?? []).length;
    check(gaps === blockGeometry(p).free - covered, `reveal ${label}: ${gaps} empty squares marked, ${blockGeometry(p).free - covered} empty`);
    if (elsewhere) {
      const wrong = (part.html.match(/data-reveal-wrong="(\d+)"/g) ?? []).length;
      check(wrong === elsewhere.length && part.html.includes(`data-reveal-wrong="${first.piece}"`), `reveal ${label}: the misplaced piece outlined on ${wrong} squares`);
      check(pillValue(part.html, "wrong") === "1", `reveal ${label}: off-the-solution pill ${pillValue(part.html, "wrong")}`);
      check(/Red: not in a solution spot/.test(part.html) && /Dashed: left empty/.test(part.html), `reveal ${label}: the marks' key`);
    }
    if (label === "new") check(pillValue(part.html, "illegal") === "1" && /Illegal drop</.test(part.html), `reveal new: one illegal drop pill`);
    check(pill(part.html, "time") === null, `reveal ${label}: a time pill on an unfinished round`);
    check(!/×/.test(part.html), `reveal ${label}: a stray × (unfinished)`);
    // Nothing reads as the solution's: the numbers sit in the Yours column only.
    const solCol = part.html.slice(part.html.indexOf('data-reveal-view="solution"'), part.html.indexOf('data-reveal-view="yours"'));
    check(solCol.length > 0 && !/data-hud-pill|data-reveal-wrong|data-reveal-gap/.test(solCol), `reveal ${label}: numbers or marks under Solution`);
  }
  // A round with no stored extra (an older row): the reveal reads its own answer with the shared rules.
  {
    const p = live[2]!;
    const sol = p.solution ?? [];
    const html = renderToStaticMarkup(<Reveal puzzle={p} myAnswer={encodePlacements(sol.slice(0, 3))} myCorrect={false} myReactionAvgMs={null} timeLimitMs={60_000} />);
    check(pillValue(html, "pieces") === `3/${blockGeometry(p).pieces.length}`, `reveal bare: pieces pill ${pillValue(html, "pieces")}`);
    const empty = renderToStaticMarkup(<Reveal puzzle={p} myAnswer={null} myCorrect={false} myReactionAvgMs={null} timeLimitMs={60_000} />);
    check(pillValue(empty, "pieces") === `0/${blockGeometry(p).pieces.length}`, "reveal: no answer");
  }
  // The fit targets the board itself (the half-size solution under the switch was the fit scaling a column).
  const css = readFileSync("src/polish-pattern/blockparty.css", "utf8");
  check(/\[data-solution-view\] \.bp-reveal-board \{ width: min\(100cqw, 360px\); \}/.test(css), "reveal: the shown board doesn't take the whole row");
}
function fxPuzzle(i: number): Block {
  const fx = JSON.parse(gunzipSync(readFileSync("scripts/fixtures/pattern-overhaul-blockparty-legacy.json.gz")).toString()) as { puzzles: Block[] };
  return fx.puzzles[i]!;
}

/* 8. Challenges and the star against the new Normal (Joe's additions, 15 Nov 2026). */
{
  const p = live[3]!;
  const sol = p.solution ?? [];
  const nst = challengeById("blockparty.no-second-thoughts")!;
  const snap = challengeById("blockparty.snap-fit")!;
  check(/without dropping a piece where it won’t fit/.test(nst.text) && !/twice/.test(nst.text), `challenge: No second thoughts reads "${nst.text}"`);
  const run = (answer: string, msLeft: number) => {
    const g = gradeAnswer(p, answer, msLeft);
    return { score: g.score, isCorrect: g.isCorrect, extra: g.extra as Record<string, unknown> };
  };
  const clean = run(encodeBlockAnswer(sol, 0), 25_000);
  const first = sol[0]!;
  const elsewhere = otherSpot(p, [], first.piece, [...first.cells].sort((a, b) => a - b).join(","));
  const moved = elsewhere
    ? run(sent(p, [{ answer: encodePlacements([{ piece: first.piece, cells: elsewhere }]), at: 500 }, ...sol.map((_, i) => ({ answer: encodePlacements(sol.slice(0, i + 1)), at: 1000 + i * 1000 }))]), 25_000)
    : clean;
  const oneDrop = run(encodeBlockAnswer(sol, 1), 25_000);
  check(evaluateChallenge(nst, clean).met && evaluateChallenge(nst, moved).met, "challenge: a clean solve (pieces moved or not) misses No second thoughts");
  check(!evaluateChallenge(nst, oneDrop).met, "challenge: one illegal drop still meets No second thoughts");
  check(evaluateChallenge(snap, run(encodePlacements(sol), 20_000)).met && !evaluateChallenge(snap, run(encodePlacements(sol), 10_000)).met, "challenge: Snap fit is not 'within 40 s'");
  // The star (175): a solve by 40 s with up to two illegal drops earns it; a slow, careless one doesn't.
  check(STAR_SCORE === 175 && run(encodeBlockAnswer(sol, 2), 20_000).score >= STAR_SCORE, "star: a quick solve with two illegal drops misses 175");
  check(run(encodeBlockAnswer(sol, 9), 2_000).score < STAR_SCORE, "star: a slow solve with nine illegal drops reaches 175");
}

// Older coordinate demos are stopped until re-recorded on blockRev 4 (the intro shows its still).
check(puzzlePresentation("blockparty") === BLOCKPARTY_NOV15_PRESENTATION, "demo: Tessellate's older demos are not stopped");

/* 6. Sound slots and their lines. */
{
  const lines = readFileSync("docs/sound-cues/pattern-elevenlabs.md", "utf8");
  const section = lines.slice(lines.indexOf("<!-- tessellate:start -->"), lines.indexOf("<!-- tessellate:end -->"));
  for (const slot of ["turn", "flip", "pickup", "place", "illegal", "undo", "reset", "solve"]) {
    const id = `blockparty.${slot}` as keyof typeof SOUND_MANIFEST;
    check(!!SOUND_MANIFEST[id]?.url, `sound: ${id} has no file`);
    check(section.includes(`\`${id}\` — `), `sound: no ElevenLabs line for ${id}`);
  }
  const doc = readFileSync("docs/sound-cues/pattern.md", "utf8");
  for (const slot of ["pickup", "illegal", "undo", "reset"]) check(doc.includes(`\`blockparty.${slot}\``), `sound: blockparty.${slot} not in pattern.md`);
}

/* 9. Stage 2: Joe's fixes and the effects. */
{
  // The studs: one plain dome on a short base (no collar, no polished cap: they read as engraved coins).
  const py = readFileSync("docs/design/game-art/pattern/source/blockparty.py", "utf8");
  const pegFn = py.slice(py.indexOf("def peg():"), py.indexOf("SPRITES = "));
  check(/ellipsoid\(/.test(pegFn) && !/brass_dot|brass_base|collar/.test(pegFn.replace(/#.*$/gm, "")), "studs: the peg is not one plain dome");
  check(/def tray_block\(/.test(py) && /tray-\{name\}/.test(py), "tray: no tray render of the blocks in the source");

  // No animation in the game's files but transform and opacity; the effects go through the kit.
  const files = [
    "src/components/puzzles/BlockPartyPuzzle.tsx",
    "src/components/puzzles/pattern/blockPartyArt.tsx",
    "src/puzzles/blockParty.tsx",
  ].map((f) => [f, readFileSync(f, "utf8")] as const);
  for (const [f, text] of files) check(!/\.animate\(/.test(text), `kit: ${f} calls element.animate itself`);
  const css = readFileSync("src/polish-pattern/blockparty.css", "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
  for (const m of css.matchAll(/@keyframes\s+([\w-]+)\s*\{((?:[^{}]*\{[^{}]*\})*)\s*\}/g)) {
    const props = [...m[2]!.matchAll(/([\w-]+)\s*:/g)].map((p) => p[1]);
    check(props.every((p) => p === "transform" || p === "opacity"), `css: @keyframes ${m[1]} animates ${props.join(", ")}`);
  }
  check(!/transition\s*:/.test(css), "css: a transition in blockparty.css");
  check(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.bp-drop-flash, \.bp-peg-glint \{ animation: none; \}[\s\S]*\.bp-drop-flash, \.bp-peg-glint \{ display: none; \}/.test(css), "reduced: the drop flash or the glints still play under reduced motion");
  check(/@media \(prefers-reduced-motion: reduce\)[\s\S]*\.bp-sweep-band \{[^}]*bp-shine-still/.test(css), "reduced: the sweep isn't a still glow under reduced motion");

  // A page for the stage (happy-dom).
  const { Window } = await import("happy-dom");
  const win = new Window({ url: "http://localhost/", width: 390, height: 844 });
  const g = globalThis as Record<string, unknown>;
  for (const key of ["window", "document", "navigator", "Node", "Element", "HTMLElement", "SVGElement", "Text", "Event", "CustomEvent", "PointerEvent", "MouseEvent", "getComputedStyle", "MutationObserver", "ResizeObserver", "requestAnimationFrame", "cancelAnimationFrame", "IS_REACT_ACT_ENVIRONMENT"]) {
    const value = (win as unknown as Record<string, unknown>)[key];
    g[key] = typeof value === "function" && /^[a-z]/.test(key) && key !== "window" ? (value as (...a: unknown[]) => unknown).bind(win) : key === "window" ? win : value;
  }
  g["ResizeObserver"] = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
  g["IS_REACT_ACT_ENVIRONMENT"] = true;
  let reducedMotion = false;
  const matchMedia = (query: string) => ({ matches: query.includes("prefers-reduced-motion") ? reducedMotion : false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  Object.defineProperty(win, "matchMedia", { configurable: true, writable: true, value: matchMedia });

  // The board measures 350 × 350 at the page's top left; everything else measures nothing.
  const BOARD = 350;
  const proto = (win as unknown as { HTMLElement: { prototype: object } }).HTMLElement.prototype;
  const isBoard = (el: Element) => el.classList?.contains("bp-board");
  const rectOf = (el: Element) => (isBoard(el) ? { left: 0, top: 0, right: BOARD, bottom: BOARD, width: BOARD, height: BOARD, x: 0, y: 0 } : { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0, x: 0, y: 0 });
  Object.defineProperty(proto, "getBoundingClientRect", { configurable: true, value(this: Element) { return { ...rectOf(this), toJSON() {} }; } });
  for (const k of ["clientWidth", "clientHeight", "offsetWidth", "offsetHeight"])
    Object.defineProperty(proto, k, { configurable: true, get(this: Element) { return isBoard(this) ? BOARD : 0; } });

  // Every kit call (its plan) with the element it animated, and every sound cue.
  type Rec = { kind: string; variant: string; silent: boolean; frames: unknown[]; el: Element | null };
  const fx: Rec[] = [];
  const { setGameFxSink } = await import("../src/lib/fx/kit");
  setGameFxSink((plan) => fx.push({ kind: plan.kind, variant: plan.variant, silent: plan.sound === null, frames: plan.frames, el: null }));
  const elementProto = (win as unknown as { Element: { prototype: object } }).Element.prototype;
  Object.defineProperty(elementProto, "animate", {
    configurable: true,
    writable: true,
    value(this: Element) {
      const last = fx[fx.length - 1];
      if (last && last.el === null) last.el = this;
      return { cancel() {}, finish() {}, finished: Promise.resolve() };
    },
  });
  const cues: string[] = [];
  win.addEventListener("duelz-sound", (e) => cues.push(String((e as unknown as CustomEvent<{ cue: string }>).detail?.cue)));

  const React = await import("react");
  const { createRoot } = await import("react-dom/client");
  const { act } = React;
  const { orientationOffsets, absoluteCells } = await import("../src/lib/duel/blockParty");
  const { DOUBLE_TAP_MS } = await import("../src/components/puzzles/BlockPartyPuzzle");

  const p = live[4]!;
  const geo = blockGeometry(p);
  const n = geo.cols;
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host as unknown as Element);
  const submits: string[] = [];
  await act(async () => {
    root.render(<BlockPartyPuzzle puzzle={p} phaseStartedAt={Date.now()} now={Date.now()} locked={false} onSubmit={(a) => submits.push(a)} onDraftAnswer={() => {}} />);
  });
  const fire = (target: EventTarget, type: string, x: number, y: number) => {
    const Ctor = (type.startsWith("pointer") ? win.PointerEvent : win.MouseEvent) as unknown as typeof MouseEvent;
    target.dispatchEvent(new Ctor(type, { bubbles: true, cancelable: true, clientX: x, clientY: y, button: 0, pointerId: 1 } as MouseEventInit) as unknown as Event);
  };
  const slot = (piece: number) => host.querySelector(`[data-bp-tray-piece="${piece}"]`) as unknown as HTMLElement | null;
  const hitCell = (piece: number) => slot(piece)?.querySelector("[data-bp-lift] > div > div") as unknown as HTMLElement | null;
  const placedCount = () => host.querySelectorAll("[data-bp-piece]").length;
  const taken = new Set<number>(p.blockers);
  /** A legal spot for a piece in its first pose, avoiding pegs and pieces placed so far. */
  const legalSpot = (piece: number) => {
    const offsets = orientationOffsets(piece, 0, false, geo.pieces);
    for (let row = 0; row < n; row++)
      for (let col = 0; col < n; col++) {
        const cells = absoluteCells(offsets, row, col, n);
        if (cells && cells.every((c) => !taken.has(c))) return { cells, offsets, row, col };
      }
    return null;
  };
  const centre = (r: number, c: number) => [((c + 0.5) * BOARD) / n, ((r + 0.5) * BOARD) / n] as const;
  const START = [120, 600] as const;
  /** Drags a tray piece by its first square from START to (x, y) and lets go. */
  const dragTo = async (piece: number, x: number, y: number) => {
    await act(async () => fire(hitCell(piece)!, "pointerdown", START[0], START[1]));
    await act(async () => fire(win, "pointermove", START[0] + 12, START[1] - 12));
    await act(async () => fire(win, "pointermove", x, y));
    await act(async () => fire(win, "pointerup", x, y));
  };
  const since = (mark: number) => fx.slice(mark);
  const cuesSince = (mark: number) => cues.slice(mark);

  // Turn: one tap, the turn shown after the double-tap window, with its click and the kit's tap on the lift.
  {
    const a = fx.length;
    const c = cues.length;
    await act(async () => fire(hitCell(0)!, "pointerdown", START[0], START[1]));
    await act(async () => fire(win, "pointerup", START[0], START[1]));
    check(cuesSince(c).length === 0 && since(a).length === 0, `turn: something played before the double-tap window passed (${cuesSince(c)})`);
    await act(async () => {
      await new Promise((r) => setTimeout(r, DOUBLE_TAP_MS + 60));
    });
    const tap = since(a).find((r) => r.kind === "tap");
    check(cuesSince(c).join() === "blockparty.turn", `turn: sounds ${cuesSince(c).join()}`);
    check(!!tap && tap.silent && tap.el !== null && (tap.el as Element).hasAttribute("data-bp-lift"), "turn: no silent kit tap on the piece's lift wrapper");
    check(!!slot(0)?.querySelector(".bp-glyph-turn"), "turn: the glyph doesn't spin");
    check(since(a).every((r) => r.kind === "tap"), `turn: other effects ${since(a).map((r) => r.kind)}`);
    // Back to its first pose for the drags below (three more turns).
    for (let i = 0; i < 3; i++) {
      await act(async () => fire(hitCell(0)!, "pointerdown", START[0], START[1]));
      await act(async () => fire(win, "pointerup", START[0], START[1]));
      await act(async () => {
        await new Promise((r) => setTimeout(r, DOUBLE_TAP_MS + 40));
      });
    }
  }

  // Pick-up and a legal drop.
  const legalPiece = geo.pieces.map((_, i) => i).find((i) => legalSpot(i));
  const spot = legalPiece === undefined ? null : legalSpot(legalPiece);
  check(spot !== null, "drop: no legal spot to test with");
  if (spot && legalPiece !== undefined) {
    const [gr, gc] = spot.offsets[0]!;
    const [x, y] = centre(spot.row + gr, spot.col + gc);
    const a = fx.length;
    const c = cues.length;
    await act(async () => fire(hitCell(legalPiece)!, "pointerdown", START[0], START[1]));
    await act(async () => fire(win, "pointermove", START[0] + 12, START[1] - 12));
    const pick = since(a).find((r) => r.kind === "pickUp");
    check(!!pick && pick.silent && (pick.el as Element | null)?.hasAttribute("data-bp-lift") === true, "pick-up: no silent kit pickUp on the piece under the finger");
    check(cuesSince(c).join() === "blockparty.pickup", `pick-up: sounds ${cuesSince(c).join()}`);
    await act(async () => fire(win, "pointermove", x, y));
    await act(async () => fire(win, "pointerup", x, y));
    const dropRec = since(a).find((r) => r.kind === "drop");
    check(cuesSince(c).join() === "blockparty.pickup,blockparty.place", `drop: sounds ${cuesSince(c).join()}`);
    check(!!dropRec && dropRec.silent && (dropRec.el as Element | null)?.getAttribute("data-bp-piece") === String(legalPiece), "drop: no silent kit drop on the placed piece's own group");
    const flash = host.querySelector("[data-bp-flash]");
    check(flash?.getAttribute("data-bp-flash") === spot.cells.join(","), `drop: the flash covers ${flash?.getAttribute("data-bp-flash")}, the piece ${spot.cells.join(",")}`);
    check(!since(a).some((r) => r.kind === "wrong" || r.kind === "slide"), "drop: a refused-move effect on a legal drop");
    for (const cell of spot.cells) taken.add(cell);
  }

  // An illegal drop onto a peg: a thud, the piece slides home and its slot shakes; no place sound or drop effect.
  const other = geo.pieces.map((_, i) => i).find((i) => i !== legalPiece && slot(i));
  if (other !== undefined) {
    const peg = p.blockers[0]!;
    const [x, y] = centre(Math.floor(peg / n), peg % n);
    const a = fx.length;
    const c = cues.length;
    const before = placedCount();
    await dragTo(other, x, y);
    check(placedCount() === before, "illegal: the piece was placed on a peg");
    check(cuesSince(c).join() === "blockparty.pickup,blockparty.illegal", `illegal: sounds ${cuesSince(c).join()}`);
    const slide = since(a).find((r) => r.kind === "slide");
    const wrong = since(a).find((r) => r.kind === "wrong");
    check(!!slide && slide.silent && (slide.el as Element | null)?.hasAttribute("data-bp-move") === true, "illegal: the piece doesn't slide home (kit slide on its move wrapper)");
    check(JSON.stringify(slide?.frames[0]) === JSON.stringify({ transform: `translate(${x - START[0]}px, ${y - START[1]}px)` }), `illegal: the slide starts at ${JSON.stringify(slide?.frames[0])}`);
    check(!!wrong && wrong.silent && (wrong.el as Element | null)?.getAttribute("data-bp-tray-piece") === String(other), "illegal: no silent kit wrong on the piece's slot");
    check(!since(a).some((r) => r.kind === "drop"), "illegal: a drop effect on a refused move");

    // Never blocks input: the next move, made at once while the refusal plays, is taken.
    const next = legalSpot(other);
    if (next) {
      const [gr, gc] = next.offsets[0]!;
      const [nx, ny] = centre(next.row + gr, next.col + gc);
      await dragTo(other, nx, ny);
      check(placedCount() === before + 1, "input: the move right after a refusal was not taken");
      for (const cell of next.cells) taken.add(cell);
    }

    // A tray piece let go off the board goes home with no sound.
    const third = geo.pieces.map((_, i) => i).find((i) => slot(i));
    if (third !== undefined) {
      const a2 = fx.length;
      const c2 = cues.length;
      await dragTo(third, 200, 780);
      check(cuesSince(c2).join() === "blockparty.pickup", `off the board: sounds ${cuesSince(c2).join()}`);
      check(since(a2).some((r) => r.kind === "slide") && !since(a2).some((r) => r.kind === "wrong" || r.kind === "drop"), "off the board: not a quiet slide home");
    }
  }

  // Undo: the move given back, no drop effect or flash.
  {
    const a = fx.length;
    const c = cues.length;
    const undoBtn = host.querySelector('[data-testid="blockparty-undo"]') as unknown as HTMLElement;
    await act(async () => undoBtn.click());
    check(cuesSince(c).join() === "blockparty.undo" && !since(a).some((r) => r.kind === "drop"), `undo: ${cuesSince(c).join()} / ${since(a).map((r) => r.kind)}`);
    check(!host.querySelector("[data-bp-flash]"), "undo: the last drop's flash is still on the board");
  }

  // Reduced motion: every kit effect is its crossfade (opacity only).
  {
    reducedMotion = true;
    const a = fx.length;
    const piece = geo.pieces.map((_, i) => i).find((i) => slot(i) && legalSpot(i));
    const s2 = piece === undefined ? null : legalSpot(piece);
    if (s2 && piece !== undefined) {
      const [gr, gc] = s2.offsets[0]!;
      const [x, y] = centre(s2.row + gr, s2.col + gc);
      await dragTo(piece, x, y);
    }
    const recs = since(a);
    check(recs.some((r) => r.kind === "drop") && recs.every((r) => r.variant === "reduced" && r.frames.every((f) => !("transform" in (f as object)))), `reduced: effects ${recs.map((r) => `${r.kind}/${r.variant}`)}`);
    reducedMotion = false;
  }
  await act(async () => root.unmount());

  // The solve: the shine across the board, each piece pulsing as it passes (left columns first).
  {
    const sol = p.solution ?? [];
    const html = renderToStaticMarkup(<BlockBoard blockers={p.blockers} placements={sol} cols={n} celebrate />);
    check(/data-bp-sweep=""/.test(html) && /bp-sweep-band/.test(html), "solve: no shine across the board");
    check(p.blockers.every((peg) => html.includes(`data-bp-glint="${peg}"`)), "solve: a stud doesn't catch the light");
    const delays = sol.map((pl) => ({ left: Math.min(...pl.cells.map((c) => c % n)), ms: Number(new RegExp(`data-bp-piece="${pl.piece}"><g class="bp-piece-lock" style="animation-delay:(\\d+)ms`).exec(html)?.[1]) }));
    check(delays.every((d) => Number.isFinite(d.ms)) && delays.every((d) => delays.every((e) => d.left <= e.left || d.ms >= e.ms)), `solve: the pulse doesn't follow the shine ${JSON.stringify(delays)}`);
    const plain = renderToStaticMarkup(<BlockBoard blockers={p.blockers} placements={sol} cols={n} />);
    check(!/data-bp-sweep|bp-piece-lock/.test(plain), "solve: the shine on a board that isn't solving");
    const stageSrc = readFileSync("src/components/puzzles/BlockPartyPuzzle.tsx", "utf8");
    check(/useSolveMoment\(covered >= geo\.free, "blockparty\.solve"\)/.test(stageSrc), "solve: the shine's cue isn't blockparty.solve");
  }

  // The reveal's result: the kit's win on a solve, never on an unfinished round, never on a board.
  {
    const Reveal = blockPartyPuzzle.Reveal;
    const sol = p.solution ?? [];
    const draw = async (answer: string, msLeft: number) => {
      const gr = gradeAnswer(p, answer, msLeft);
      const a = fx.length;
      const h = document.createElement("div");
      document.body.appendChild(h);
      const r = createRoot(h as unknown as Element);
      await act(async () => {
        r.render(<Reveal puzzle={p} myAnswer={answer} myCorrect={gr.isCorrect} myReactionAvgMs={null} myMsRemaining={msLeft} timeLimitMs={60_000} myExtra={gr.extra as Record<string, unknown>} />);
      });
      await act(async () => {
        await new Promise((res) => setTimeout(res, 60));
      });
      await act(async () => r.unmount());
      return since(a);
    };
    // As the reveal's switch leaves it: the Solution column shown, Yours hidden (display: none has no boxes).
    Object.defineProperty(elementProto, "getClientRects", {
      configurable: true,
      value(this: Element) {
        return this.closest("[data-reveal-view=\"yours\"]") ? [] : [{ width: 1, height: 1 }];
      },
    });
    const won = await draw(encodeBlockAnswer(sol, 0), 30_000);
    const wins = won.filter((r) => r.kind === "win");
    const w = wins[0];
    check(wins.length === 1 && !!w && w.silent && (w.el as Element | null)?.getAttribute("data-bp-result") === "solved" && (w.el as Element).getAttribute("data-bp-result-view") === "solution" && !(w.el as Element).querySelector("[data-reveal-board]"), `reveal: not one silent kit win on the solved result in view (${wins.length})`);
    const lost = await draw(encodeBlockAnswer(sol.slice(0, 2), 0), 0);
    check(!lost.some((r) => r.kind === "win"), "reveal: a win on an unfinished round");
  }

  setGameFxSink(null);
  // The stage's own timers (a piece gliding home) settle before the page goes.
  await act(async () => {
    await new Promise((r) => setTimeout(r, 500));
  });
}

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`pattern-overhaul-blockparty-check: FAIL (${failures.length} failed, ${passed} passed)`);
  process.exit(1);
}
console.log(`pattern-overhaul-blockparty-check: ${passed} checks passed`);
