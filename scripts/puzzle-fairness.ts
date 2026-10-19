/**
 * Puzzle fairness audit (Oct 2026 puzzle score shape, `puzzleScoreRev: 1`).
 *
 * Every non-arcade game with a finish state, plus the no-finish games (Nucleus,
 * Forage, Letterfall, Flash, Bang On, Bonk, Pull!), is played on seeded room
 * puzzles by the player kits in scripts/puzzle-fairness/ and graded by the
 * server's own gradeAnswer, twice: "before" grades the same puzzle with the
 * score stamp removed (the shape stored rounds keep), "after" with it. Five rules:
 *
 *   a. no input scores 0 (the empty draft at the buzzer and on an instant Done);
 *   b. random or spam input scores about 0: every spam strategy's median and
 *      90th percentile at most 5;
 *   c. every finish beats every unfinished run (min finished > max unfinished,
 *      over every play, intermediate state and spam run);
 *   d. partial credit counts only progress the player made (the starting
 *      state, submitted untouched, scores 0: rule a on the start state);
 *   e. the intro SCORE line and "?" help state the real numbers (TEXT below).
 *
 * Then four simulated solver levels (average, good, great, near-perfect;
 * scripts/puzzle-fairness/kit.ts SKILLS) report each game's median score.
 *
 *   bun scripts/puzzle-fairness.ts                   # every game, 20 seeds
 *   bun scripts/puzzle-fairness.ts sudoku tents      # only these games
 *   bun scripts/puzzle-fairness.ts --seeds=40 --md=out.md --json=out.json
 *
 * Not a check (no CI time): rules a–c on the after shape are guarded quickly by
 * scripts/puzzle-score-rev-check.ts. Prints a FAIL line per rule broken on the
 * "after" shape; games whose formula is out of scope tonight (no-finish games,
 * Interloper) report but are marked "flag" instead of FAIL.
 */
import { writeFileSync } from "node:fs";
import { INTRO_SCORE } from "../src/lib/duel/introScore";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import type { PuzzleData, PuzzleType } from "../src/lib/duel/types";
import { LEVELS, LEVEL_LABEL, type Level } from "./puzzle-fairness/kit";
import { KITS } from "./puzzle-fairness/kits";
import { roomPuzzle, runNothing, runPlay, runSpam, type GradedRun } from "./puzzle-fairness/run";

const args = process.argv.slice(2);
const opt = (name: string) => args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3);
const SEEDS = Number(opt("seeds") ?? 20);
const MD = opt("md");
const JSON_PATH = opt("json");
const ONLY = args.filter((a) => !a.startsWith("--"));

/** Games with a finish state (the new shape applies), in category order. */
export const FINISH_GAMES: PuzzleType[] = [
  "tilegrid", "wordslide", "wordsearch", "letterwheel", "strikeout", "codeword", "swapword",
  "target", "equation", "balance", "numpyramid", "trail", "measure", "checkout", "numline", "tendrop",
  "numhunt", "chain",
  "stroop", "symscan", "spotdiff", "countup", "maze", "pairmatch",
  "unblock", "blockparty", "iceslide", "gravity", "tiles", "rings", "laser",
  "pipes", "lightsout", "sudoku", "flow", "push", "tower", "tubes", "safe", "bomb", "nonogram", "flood", "tents", "shikaku", "lightup",
];
/** No finish state: their own formulas, audited only (Bang On's bottom is the one rev-1 change). */
export const OPEN_GAMES: PuzzleType[] = ["wordsmith", "wordhunt", "wordfall", "reaction", "stopwatch", "whack", "clayshoot"];

/**
 * Rule e: numbers the intro SCORE line and the "?" help must both state for the
 * new shape (help may say more). Every finish game says 120.
 */
export const TEXT: Partial<Record<PuzzleType, { intro: string[]; help: string[] }>> = {};
for (const t of FINISH_GAMES) TEXT[t] = { intro: ["120"], help: ["120", "half the time"] };
const moreHelp: Partial<Record<PuzzleType, string[]>> = {
  tilegrid: ["30", "110"], wordslide: ["15", "27.5"], wordsearch: ["22"], letterwheel: ["110"], strikeout: ["1.5 per strike", "30 per solved word"],
  codeword: ["110", "−5"], swapword: ["15", "110"], target: ["110"], equation: ["20 / 30 / 35 / 45"], balance: ["15, 25, 30 and 55"],
  numpyramid: ["27.5"], trail: ["110"], measure: ["30 / 35 / 45", "15"], checkout: ["22, 24, 26, 28 and 32", "3 per board"],
  numline: ["8", "10%"], tendrop: ["110", "30"], numhunt: ["5", "110"], chain: ["110", "30"], stroop: ["110", "30"],
  symscan: ["40 / 40 / 30", "30"], spotdiff: ["10 per", "5 wrong"], countup: ["40 / 30 / 25 / 15", "15%"], maze: ["110"],
  pairmatch: ["110", "25"], unblock: ["15", "110"], blockparty: ["110"], iceslide: ["15", "110"], gravity: ["15"], tiles: ["15"],
  rings: ["15"], laser: ["15 / 8 / 0", "22"], pipes: ["110"], lightsout: ["15", "110"], sudoku: ["−5"], flow: ["110"],
  push: ["15"], tower: ["15"], tubes: ["15"], safe: ["15 / 8 / 0"], bomb: ["22"], nonogram: ["−5"], flood: ["15"],
  tents: ["−10"], shikaku: ["110"], lightup: ["−5"],
};
for (const [t, extra] of Object.entries(moreHelp)) TEXT[t as PuzzleType]!.help.push(...extra);

/**
 * Spam strategies that rule b reports as a flag, not a failure, with the reason:
 * either a weak but real strategy (it reads the screen's feedback), or a game
 * whose random play reaches progress no state-based score can tell from a
 * player's (the fix needs a game change outside tonight's scoring work).
 */
const STRATEGY = "a weak but real strategy: it reads the screen's feedback";
export const KNOWN_SPAM: Partial<Record<PuzzleType, Record<string, string>>> = {
  wordslide: { "spin-rows-lock-green": `${STRATEGY} (turns each row until it reads as a word)` },
  // strikeoutRev 3 (15 Oct 2026, Joe's chosen rules: ten strikes, three vowel guesses, one more starting letter on
  // words 1–3) gives blind keypad mashing a median of about 6 (it often finds a few letters of word 1 before ten
  // misses); reported in docs/puzzle-score-bands-oct-2026.md, not tuned away.
  strikeout: {
    "frequency-order": `${STRATEGY} (guessing letters in frequency order is how the game is played)`,
    alphabet: "strikeoutRev 3's ten strikes and three vowel guesses let A–Z find a few letters of word 1 (median about 6); chosen rules, reported",
    "random-letters": "strikeoutRev 3's ten strikes and three vowel guesses let random keys find a few letters of word 1 (median about 6); chosen rules, reported",
  },
  codeword: { "frequency-fill": `${STRATEGY} (letter-frequency code breaking)` },
  swapword: { "swap-non-green": `${STRATEGY} (uses the tile marks)`, "swap-amber": `${STRATEGY} (uses the tile marks)` },
  equation: { "brute-force": "3 tries per equation (equationRev 1): trying operator orders until CORRECT now reaches stage 1 on about half the boards and rarely stage 2 (median 20, was 68)" },
  balance: {
    "random-hang": "hang limit per scale and unique small scales (balanceRev 1): random hanging rarely balances (median 0, was 38); the limit itself is the phone's count",
    "random-hang-fast": "hang limit per scale and unique small scales (balanceRev 1): random hanging rarely balances (median 0, was 55)",
  },
  checkout: { greedy: `${STRATEGY} (biggest dart, then a finisher)` },
  // countRev 2 (14 Oct 2026): 13 values per tray, one off 15 %, two off 0, so guessing has a median of about 5 and no flag;
  // these reasons apply to stored rounds (countRev 1 and older) only.
  countup: {
    "guess-typical": "stored rounds only: each tray's count is one of 7 values (countRev 1), near misses 60 % / 30 % (median about 50)",
    "guess-random": "stored rounds only: a random guess in range still scores on near misses (median about 45)",
  },
  maze: { "blind-dfs-6cps": `${STRATEGY} (wall-following every dead end at 6 cells a second)` },
  flow: { "direct-lines": `${STRATEGY} (each dot drawn straight to its twin; many shortest routes are the solution)` },
  nonogram: { "busy-lines": `${STRATEGY} (fills rows and columns whose clues are long)` },
  // Topsy-Turvy and Polypotions: no entry since gravityRev 2 / tubesRev 2 (19 Oct 2026, solverProgress.server.ts):
  // random tilts and pours at the limit now score about 0, so the spam guards apply to them like any other game.
};
/** Ballpark has no clean finish: "all placed" is its finish, scaled by accuracy, so rule c's 120 floor does not apply. */
const NO_CLEAN_FINISH = new Set<PuzzleType>(["numline"]);

/** The same puzzle as a stored round from before the new shape: the score stamp removed. */
function legacy(puzzle: PuzzleData): PuzzleData {
  const copy = { ...(puzzle as object) } as Record<string, unknown>;
  delete copy["puzzleScoreRev"];
  // The engine games carry their own revisions; the shape before is the revision rooms stamped before tonight.
  if (puzzle.type === "tendrop") delete copy["tenRev"];
  if (puzzle.type === "stroop" && copy["clashRev"] === 4) copy["clashRev"] = 3;
  return copy as unknown as PuzzleData;
}

const median = (xs: number[]) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s.length % 2 ? s[(s.length - 1) / 2]! : Math.round((s[s.length / 2 - 1]! + s[s.length / 2]!) / 2);
};
const pct = (xs: number[], p: number) => {
  if (xs.length === 0) return NaN;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(p * s.length))]!;
};

export interface ShapeResult {
  nothing: number[];
  spam: Record<string, number[]>;
  spamSolved: Record<string, number>;
  levels: Record<Level, { scores: number[]; solved: number }>;
  minFinished: number;
  maxUnfinished: number;
}

export interface GameAudit {
  type: PuzzleType;
  name: string;
  open: boolean;
  before: ShapeResult;
  after: ShapeResult;
  textOk: boolean;
  textMissing: string[];
  fails: string[];
  flags: string[];
}

function auditShape(type: PuzzleType, puzzles: PuzzleData[], seeds: number[]): ShapeResult {
  const kit = KITS[type]!;
  const out: ShapeResult = {
    nothing: [], spam: {}, spamSolved: {},
    levels: Object.fromEntries(LEVELS.map((l) => [l, { scores: [], solved: 0 }])) as ShapeResult["levels"],
    minFinished: Infinity, maxUnfinished: -Infinity,
  };
  const see = (g: GradedRun) => {
    if (g.isCorrect) out.minFinished = Math.min(out.minFinished, g.score);
    else out.maxUnfinished = Math.max(out.maxUnfinished, g.score);
  };
  puzzles.forEach((puzzle, i) => {
    const seed = seeds[i]!;
    for (const g of runNothing(kit, puzzle)) { out.nothing.push(g.score); see(g); }
    for (const g of runSpam(kit, puzzle, seed)) {
      (out.spam[g.label] ??= []).push(g.score);
      out.spamSolved[g.label] = (out.spamSolved[g.label] ?? 0) + (g.isCorrect ? 1 : 0);
      see(g);
    }
    for (const level of LEVELS) {
      const r = runPlay(kit, puzzle, seed, level);
      out.levels[level].scores.push(r.score);
      if (r.isCorrect) out.levels[level].solved++;
      see(r);
      for (const u of r.unfinished) see(u);
    }
  });
  return out;
}

function textCheck(type: PuzzleType): string[] {
  const want = TEXT[type];
  if (!want) return [];
  const intro = INTRO_SCORE[type] ?? "";
  const help = PUZZLE_INSTRUCTIONS[type]?.score ?? "";
  return [
    ...want.intro.filter((w) => !intro.includes(w)).map((w) => `intro lacks "${w}"`),
    ...want.help.filter((w) => !help.includes(w)).map((w) => `help lacks "${w}"`),
  ];
}

export function auditGame(type: PuzzleType, seedCount = SEEDS): GameAudit {
  const seeds = Array.from({ length: seedCount }, (_, i) => 5001 + i);
  const stamped = seeds.map((seed) => roomPuzzle(type, seed));
  const open = OPEN_GAMES.includes(type);
  const before = auditShape(type, stamped.map(legacy), seeds);
  const after = auditShape(type, stamped, seeds);
  const fails: string[] = [];
  const flags: string[] = [];
  const note = (msg: string, hard: boolean) => (hard ? fails : flags).push(msg);
  if (after.nothing.some((s) => s !== 0)) note(`a/d: doing nothing scores ${Math.max(...after.nothing)}`, true);
  for (const [label, xs] of Object.entries(after.spam)) {
    const med = median(xs), p90 = pct(xs, 0.9);
    const known = KNOWN_SPAM[type]?.[label];
    if (med > 5) note(`b: spam "${label}" median ${med}, p90 ${p90}, max ${Math.max(...xs)}${after.spamSolved[label] ? `, solved ${after.spamSolved[label]}/${xs.length}` : ""}${known ? ` (${known})` : ""}`, !open && !known);
    else if (p90 > 20) note(`b: spam "${label}" median ${med} but p90 ${p90}, max ${Math.max(...xs)}`, false);
  }
  if (!open && !NO_CLEAN_FINISH.has(type) && Number.isFinite(after.minFinished) && after.minFinished <= after.maxUnfinished)
    note(`c: a finish scored ${after.minFinished}, an unfinished run ${after.maxUnfinished}`, true);
  if (!open && after.maxUnfinished > 110) note(`c: unfinished credit reached ${after.maxUnfinished} (> 110)`, true);
  if (!open && !NO_CLEAN_FINISH.has(type) && Number.isFinite(after.minFinished) && after.minFinished < 120) note(`c: a finish scored ${after.minFinished} (< 120)`, true);
  const textMissing = open ? [] : textCheck(type);
  if (textMissing.length) note(`e: ${textMissing.join("; ")}`, true);
  return { type, name: gameDisplayName(type), open, before, after, textOk: textMissing.length === 0, textMissing, fails, flags };
}

function levelCell(r: ShapeResult, level: Level, seeds: number): string {
  const l = r.levels[level];
  return `${median(l.scores)} (${l.solved}/${seeds})`;
}

export function bandTable(audits: GameAudit[], seeds: number): string {
  const head = `| Game | ${LEVELS.map((l) => `${LEVEL_LABEL[l]} before → after`).join(" | ")} | Spam max (after) | Notes |`;
  const rule = `|---|${LEVELS.map(() => "---").join("|")}|---|---|`;
  const rows = audits.map((a) => {
    const spamMax = Math.max(0, ...Object.values(a.after.spam).flat());
    const cells = LEVELS.map((l) => `${median(a.before.levels[l].scores)} → ${levelCell(a.after, l, seeds)}`);
    return `| ${a.name} (\`${a.type}\`) | ${cells.join(" | ")} | ${spamMax} | ${[...a.fails, ...a.flags].join("; ")} |`;
  });
  return [head, rule, ...rows].join("\n");
}

if (import.meta.main) {
  const games = [...FINISH_GAMES, ...OPEN_GAMES].filter((t) => KITS[t] && (ONLY.length === 0 || ONLY.includes(t)));
  const missing = [...FINISH_GAMES, ...OPEN_GAMES].filter((t) => !KITS[t]);
  if (missing.length) console.log(`no kit yet: ${missing.join(", ")}`);
  const audits: GameAudit[] = [];
  for (const type of games) {
    const t0 = performance.now();
    const a = auditGame(type);
    audits.push(a);
    const lv = LEVELS.map((l) => `${l} ${median(a.before.levels[l].scores)}→${levelCell(a.after, l, SEEDS)}`).join("  ");
    console.log(`${a.name} (${type}) [${Math.round(performance.now() - t0)} ms]  ${lv}`);
    const spam = Object.entries(a.after.spam).map(([k, xs]) => `${k} ${median(xs)}/${Math.max(...xs)}`).join(", ");
    console.log(`    nothing ${Math.max(...a.after.nothing)}; spam ${spam}; finish ≥ ${a.after.minFinished}, unfinished ≤ ${a.after.maxUnfinished}`);
    for (const f of a.fails) console.log(`    FAIL ${f}`);
    for (const f of a.flags) console.log(`    flag ${f}`);
  }
  const fails = audits.reduce((n, a) => n + a.fails.length, 0);
  console.log(`\n${audits.length} games, ${SEEDS} seeds: ${fails} rule failures, ${audits.reduce((n, a) => n + a.flags.length, 0)} flags`);
  if (MD) writeFileSync(MD, bandTable(audits, SEEDS) + "\n");
  if (JSON_PATH) writeFileSync(JSON_PATH, JSON.stringify(audits, null, 1));
}
