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
 *    pick-up and the illegal drop; the reveal's own count reads "You: …", never as the solution's.
 * 6. The new sound slots exist in the manifest and each has its ElevenLabs line.
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
  const names = [...BLOCK_SPRITE_COLOURS.map((c) => `block-${c}`), "well", "peg"];
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
  check(/block-red\.webp/.test(stage) && /block-white\.webp/.test(stage), "art: the tray draws no block sprites");
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

  const p = live[0]!;
  const reveal = renderToStaticMarkup(<blockPartyPuzzle.Reveal puzzle={p} myAnswer={encodeBlockAnswer((p.solution ?? []).slice(0, 2), 1)} myCorrect={false} {...({} as Record<string, never>)} />);
  check(/<p data-own-count=""[^>]*>You: (<!-- -->)?2\/9 pieces in place/.test(reveal), `reveal: the own count is not labelled as the player's: ${reveal.slice(-260)}`);
  check(/one solution/.test(reveal) && /your board/.test(reveal), "reveal: the Solution / Yours labels moved");
}

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

if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`pattern-overhaul-blockparty-check: FAIL (${failures.length} failed, ${passed} passed)`);
  process.exit(1);
}
console.log(`pattern-overhaul-blockparty-check: ${passed} checks passed`);
