/**
 * Bomb Defusal version 3 (plain-language clues, 14 Oct 2026).
 *
 *   bun scripts/bomb-v3-check.ts
 *
 * 1. Every card in the bank (src/lib/duel/bombBankV3.server.ts) is proved from
 *    its clue TEXT alone: each clue must match exactly one of the plain
 *    wordings below, and this file's own reading of the words (not the
 *    generator's predicates) is applied to all 60,480 ordered sequences of six
 *    different actions (seven cuts, two presses). Exactly one sequence must pass
 *    every clue, it must be the stored plan, and every clue must be needed
 *    (some sequence fails that clue alone).
 * 2. The wording stays plain: no "if", no conditions on the light, serial or
 *    switch, no sums; a colour clue's "both" / "all 3" matches the panel.
 * 3. The generator's own proof (inspectPlainBomb) agrees on every card, and the
 *    first cards rebuild byte for byte from their seeds.
 * 4. New rounds are version 3 (six steps, 90 s) and grade exactly like version
 *    2: the plan 150 at half time, 22 per correct leading step, a wrong step
 *    ends the run; a stored version-2 card still grades the same.
 */
import { generatePuzzle, gradeAnswer } from "../src/lib/duel/generate.server";
import { generatePlainBombPanel, inspectPlainBomb } from "../src/lib/duel/bomb.server";
import { BOMB_V3_BANK } from "../src/lib/duel/bombBankV3.server";
import { BOMB_V2_BANK } from "../src/lib/duel/bombBank.server";
import { withSeededRandom } from "../src/lib/duel/random";
import { BOMB_V2_TIME_MS, BOMB_V3_MAX_RULES, BOMB_V3_MIN_RULES, type BombPuzzleData } from "../src/lib/duel/types";
import { BOMB_V3_SEED } from "./bomb-bank";
import { pinDealtPuzzleScoreRev } from "../src/lib/duel/puzzleScoreRev";

// Written for the rev-1 puzzle shape: new puzzles here carry puzzleScoreRev 1 (rooms deal rev 2 since 19 Oct 2026, scoring-bands-check).
pinDealtPuzzleScoreRev(1);

let failures = 0;
const fail = (msg: string) => {
  failures++;
  if (failures <= 40) console.log(`FAIL ${msg}`);
};

const ACTIONS = ["w0", "w1", "w2", "w3", "w4", "w5", "w6", "bA", "bB"];
const SEQS: string[][] = [];
(function walk(prefix: string[]) {
  if (prefix.length === 6) return void SEQS.push(prefix);
  for (const a of ACTIONS) if (!prefix.includes(a)) walk([...prefix, a]);
})([]);
if (SEQS.length !== 60_480) fail(`expected 60,480 sequences, got ${SEQS.length}`);

const COLOURS = ["Red", "Blue", "Green", "Yellow", "White", "Black"];
type Pred = (s: string[]) => boolean;

/** "cut wire 3" → w2, "press A" → bA. */
function action(words: string): string | null {
  const cut = /^cut wire ([1-7])$/i.exec(words);
  if (cut) return `w${Number(cut[1]) - 1}`;
  const press = /^press ([AB])$/i.exec(words);
  return press ? `b${press[1]}` : null;
}

/** This file's reading of one clue: a predicate, or a reason it is not plain. */
function read(text: string, card: BombPuzzleData): Pred | string {
  if (/\bif\b|light|serial|switch|add up|sum|odd|even/i.test(text)) return "not plain: a condition or sum";
  let m = /^Step ([1-6]): (cut wire [1-7]|press [AB])\.$/.exec(text);
  if (m) {
    const at = Number(m[1]) - 1;
    const x = action(m[2]!)!;
    return (s) => s[at] === x;
  }
  m = /^(Cut wire [1-7]|Press [AB]) at some point before you (cut wire [1-7]|press [AB])\.$/.exec(text);
  if (m) {
    const x = action(m[1]!)!;
    const y = action(m[2]!)!;
    return (s) => s.includes(x) && s.includes(y) && s.indexOf(x) < s.indexOf(y);
  }
  m = /^(Cut wire [1-7]|Press [AB]), then (cut wire [1-7]|press [AB]) as the very next step\.$/.exec(text);
  if (m) {
    const x = action(m[1]!)!;
    const y = action(m[2]!)!;
    return (s) => s.includes(x) && s[s.indexOf(x) + 1] === y;
  }
  m = /^Do not cut wire ([1-7])\.$/.exec(text);
  if (m) {
    const x = `w${Number(m[1]) - 1}`;
    return (s) => !s.includes(x);
  }
  m = /^Do not press button ([AB])\.$/.exec(text);
  if (m) {
    const x = `b${m[1]}`;
    return (s) => !s.includes(x);
  }
  if (text === "Press both buttons.") return (s) => s.includes("bA") && s.includes("bB");
  m = /^Cut exactly ([4-6]) wires\.$/.exec(text);
  if (m) {
    const k = Number(m[1]);
    return (s) => s.filter((a) => a.startsWith("w")).length === k;
  }
  const wiresOf = (name: string) => card.wires.flatMap((w, i) => (w === name.toUpperCase() ? [`w${i}`] : []));
  m = /^Cut (the|both|all [3-7]) (\w+) wires?\.$/.exec(text);
  if (m && COLOURS.includes(m[2]!)) {
    const wires = wiresOf(m[2]!);
    const said = m[1] === "the" ? 1 : m[1] === "both" ? 2 : Number(m[1]!.slice(4));
    if (said !== wires.length) return `says ${said} ${m[2]} wire(s), the panel has ${wires.length}`;
    if ((said === 1) !== text.endsWith(" wire.")) return "singular / plural mismatch";
    return (s) => wires.every((w) => s.includes(w));
  }
  m = /^Do not cut (the|any) (\w+) wires?\.$/.exec(text);
  if (m && COLOURS.includes(m[2]!)) {
    const wires = wiresOf(m[2]!);
    if (wires.length === 0) return `names ${m[2]}, which is not on the panel`;
    if ((m[1] === "the") !== (wires.length === 1)) return `"${m[1]}" with ${wires.length} ${m[2]} wire(s)`;
    return (s) => wires.every((w) => !s.includes(w));
  }
  return "matches no plain wording";
}

const t0 = performance.now();
let clueTotal = 0;
const kinds = new Map<string, number>();
BOMB_V3_BANK.forEach((card, n) => {
  const tag = `card ${n}`;
  if (card.bombVersion !== 3 || card.stepCount !== 6 || card.timeLimitMs !== BOMB_V2_TIME_MS) fail(`${tag}: not a six-step version-3 card`);
  if (card.rules.length < BOMB_V3_MIN_RULES || card.rules.length > BOMB_V3_MAX_RULES) fail(`${tag}: ${card.rules.length} clues`);
  const preds: Pred[] = [];
  for (const rule of card.rules) {
    const p = read(rule.text, card);
    if (typeof p === "string") fail(`${tag}: "${rule.text}" ${p}`);
    else preds.push(p);
    const kind = rule.text.startsWith("Step") ? "step" : rule.text.includes("some point before") ? "before" : rule.text.includes("very next") ? "next" : "which";
    kinds.set(kind, (kinds.get(kind) ?? 0) + 1);
  }
  clueTotal += card.rules.length;
  if (preds.length !== card.rules.length) return;
  // One pass: each sequence's failing clues. Solutions fail none; clue k is needed when some sequence fails k alone.
  const solutions: string[][] = [];
  const failsAlone = new Array<boolean>(preds.length).fill(false);
  for (const s of SEQS) {
    let first = -1;
    let count = 0;
    for (let k = 0; k < preds.length && count < 2; k++) {
      if (!preds[k]!(s)) {
        if (count === 0) first = k;
        count++;
      }
    }
    if (count === 0) solutions.push(s);
    else if (count === 1) failsAlone[first] = true;
  }
  if (solutions.length !== 1) fail(`${tag}: ${solutions.length} sequences pass every clue`);
  else if (solutions[0]!.join(",") !== card.sequence) fail(`${tag}: the one sequence is not the stored plan`);
  failsAlone.forEach((needed, k) => {
    if (!needed) fail(`${tag}: clue ${k + 1} "${card.rules[k]!.text}" is not needed`);
  });
  if (card.required !== card.sequence) fail(`${tag}: required differs from the plan`);
  const inspected = inspectPlainBomb(card);
  if (!inspected.unique || inspected.necessaryRules !== card.rules.length || !inspected.wordingOk || inspected.unknownRules || !inspected.familiesOk || !inspected.pairsOk)
    fail(`${tag}: the generator's proof disagrees (${JSON.stringify(inspected)})`);
});
if (BOMB_V3_BANK.length !== 300) fail(`bank has ${BOMB_V3_BANK.length} cards, expected 300`);
if (new Set(BOMB_V3_BANK.map((c) => JSON.stringify(c))).size !== BOMB_V3_BANK.length) fail("duplicate cards");
console.log(
  `Bomb v3 bank: ${BOMB_V3_BANK.length} cards, ${clueTotal} clues (${[...kinds].map(([k, v]) => `${k} ${v}`).join(", ")}), each proved from its text over 60,480 sequences: one valid sequence, the stored plan, every clue needed [${Math.round(performance.now() - t0)} ms]`,
);

// The first cards rebuild exactly from their seeds (the whole bank: bun scripts/bomb-bank.ts --v3 --check).
for (let i = 0; i < 4; i++) {
  const rebuilt = withSeededRandom(BOMB_V3_SEED + i, () => generatePlainBombPanel().puzzle);
  if (JSON.stringify(rebuilt) !== JSON.stringify(BOMB_V3_BANK[i])) fail(`card ${i} does not rebuild from seed ${BOMB_V3_SEED + i}`);
}

// New rounds: version 3 from the bank, graded like version 2.
for (let seed = 1; seed <= 20; seed++) {
  const p = withSeededRandom(seed, () => generatePuzzle("bomb")) as BombPuzzleData;
  if (p.bombVersion !== 3 || p.stepCount !== 6 || p.timeLimitMs !== BOMB_V2_TIME_MS) fail(`seed ${seed}: new round not version 3`);
  const plan = p.sequence!.split(",");
  const full = gradeAnswer(p, p.sequence!, BOMB_V2_TIME_MS / 2);
  if (!full.isCorrect || full.score !== 150) fail(`seed ${seed}: the plan at half time scored ${full.score}`);
  const slow = gradeAnswer(p, p.sequence!, 0);
  if (!slow.isCorrect || slow.score !== 120) fail(`seed ${seed}: the plan at the buzzer scored ${slow.score}`);
  for (let k = 0; k < 6; k++) {
    const wrong = ACTIONS.find((a) => !plan.slice(0, k).includes(a) && a !== plan[k])!;
    const g = gradeAnswer(p, [...plan.slice(0, k), wrong, ...plan.slice(k + 1)].join(","), 0);
    if (g.isCorrect || g.score !== 22 * k) fail(`seed ${seed}: a wrong step ${k + 1} scored ${g.score}, expected ${22 * k}`);
  }
  if (gradeAnswer(p, "", 0).score !== 0) fail(`seed ${seed}: nothing scored above 0`);
}

// A stored version-2 card grades exactly as it did (same grader branch).
const v2 = { ...BOMB_V2_BANK[0]!, puzzleScoreRev: 1, speedPar: 1 } as BombPuzzleData;
const v2plan = v2.sequence!.split(",");
const v2three = gradeAnswer(v2, [...v2plan.slice(0, 3), v2plan[0]!].join(","), 0);
if (v2three.score !== 66 || gradeAnswer(v2, v2.sequence!, BOMB_V2_TIME_MS / 2).score !== 150) fail(`stored v2 card graded ${v2three.score}`);

console.log(failures ? `FAIL: ${failures} bomb-v3 failure(s)` : "All Bomb Defusal v3 checks passed");
process.exit(failures ? 1 : 0);
