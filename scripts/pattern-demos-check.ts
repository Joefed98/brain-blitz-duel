/**
 * pattern-demos-check (15 Nov 2026, the Pattern overhaul): the intro demos of the seven Pattern games whose demo plays on
 * the overhaul's stamps, packaged as `scripts/fixtures/pattern-demos.json` for the "Save intro demos" run after the final
 * merge (`scripts/pattern-demos-save.ts`) and bundled with the app until then (`src/lib/duel/bundledDemos/`).
 *
 * For every game in the fixture (Tessellate, Pipeline, Chroma Lines, Skid, Topsy-Turvy, Gridlock, Lightbender):
 *   1. the fixture's row is the bundled demo byte for byte, an intro_demos row of the fixed intro example (seed 0, start
 *      0, length its last touch, today's presentation) on the game's overhaul stamp;
 *   2. its puzzle is exactly the public half of the intro example practiceGenerateFn deals today (example: true): worked
 *      out here as that function does, and (with PostgreSQL) asked of the real function on a database whose
 *      unblock_bank is loaded in the fallback bank's order (Gridlock's example is the table's first row);
 *   3. getIntroDemoFn's version rules accept it, refuse the same demo on the stamp before, and pick it over no live row
 *      or a refused one while a live row on today's stamp still wins;
 *   4. the run the fixture holds (the answer those touches sent in the real practice stage) grades through practice's
 *      grading (gradeAnswer behind practiceTrustedMs, and with PostgreSQL the real practiceGradeFn on the sealed deal)
 *      to exactly the stored score, a solve; Gridlock's and Lightbender's touches are tied to their answer move for move;
 *   5. the save script (with PostgreSQL, through the real server functions): a wrong key saves nothing, a fixture that
 *      isn't the server's example is refused, a dry run saves nothing, a real run stores exactly the fixture's rows and
 *      the intro serves them; the command line exits 2 without a URL or key, and never prints the key.
 *
 *   bun scripts/pattern-demos-check.ts
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import {
  ANON_KEY,
  SERVICE_KEY,
  callServerFn,
  installServerFnPlugin,
  postgresBin,
  startLocalDb,
  startRestServer,
  type LocalDb,
  type RestServer,
} from "./server-fn-harness";
import { canonicalJson, comparablePuzzle, loadPatternDemos, PATTERN_DEMO_GAMES, samePuzzle, type PatternDemo } from "./pattern-demos-lib";
import { readSettings, saveDemos, type DemoCall, type DemoFn } from "./pattern-demos-save";

// Server functions run as the server bundle runs them (the harness's plugin), so install it before any import of one.
await installServerFnPlugin();

const { acceptIntroDemo, pickIntroDemo } = await import("../src/lib/duel/introDemo.functions");
const { bundledIntroDemo, BUNDLED_INTRO_DEMOS } = await import("../src/lib/duel/bundledDemos");
const { puzzleInputDemoCompatible, puzzlePresentation, REVISED_PUZZLE_DEMOS } = await import("../src/components/puzzles/wordInput");
const { INTRO_EXAMPLE_ID, INTRO_EXAMPLE_SEED, isPuzzleDemoLog } = await import("../src/lib/duel/puzzleDemo");
const { generatePuzzle } = await import("../src/lib/duel/generate.server");
const { gradeAnswer } = await import("../src/lib/duel/gradeAnswer.server");
const { bankedIntroExample } = await import("../src/lib/duel/puzzleBank.server");
const { withSeededRandom } = await import("../src/lib/duel/random");
const { mergePuzzle, splitPuzzle } = await import("../src/lib/duel/secrets");
const { practiceTrustedMs } = await import("../src/lib/duel/practiceReceipt");
const { PATTERN_NOV15_STAMPS } = await import("../src/lib/duel/patternNov15");
const { UNBLOCK_BANK } = await import("../src/lib/duel/unblockBank.server");
const { INTRO_MS } = await import("../src/lib/duel/types");
const { puzzlePrepMs, puzzleTimeLimitMs } = await import("../src/lib/duel/catalogue");
const { decodeMoves } = await import("../src/lib/duel/unblock");

type Row = Parameters<typeof acceptIntroDemo>[1] & {};

const failures: string[] = [];
let passes = 0;
function ok(cond: unknown, what: string): void {
  if (cond) passes++;
  else failures.push(what);
}
const clone = <T>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

const demos = loadPatternDemos();

/* ------------------------------------------------------------------ the intro example, as practiceGenerateFn deals it */

/**
 * practiceGenerateFn's example path (practice.functions.ts): Skid, Chroma Lines and Tessellate the live deal at the
 * example seed; Gridlock the unblock_bank table's first row (by id) at that seed, here the fallback bank's first entry,
 * the order the live table was loaded in; the rest the stored example or the live deal at the seed.
 */
function introExample(type: string) {
  if (type === "iceslide" || type === "flow" || type === "blockparty")
    return withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type, { bankSeed: INTRO_EXAMPLE_SEED }));
  if (type === "unblock") {
    const [layout, min, solution] = UNBLOCK_BANK[0]!.split("|");
    const unblockRow = { layout: layout!, min_moves: Number(min), solution: solution! };
    return withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type, { unblockRow }));
  }
  return bankedIntroExample(type as never) ?? withSeededRandom(INTRO_EXAMPLE_SEED, () => generatePuzzle(type as never));
}

/* ------------------------------------------------------------------ 1–4 without a database */

ok(
  demos.map((d) => d.game).join() === PATTERN_DEMO_GAMES.join(),
  `the fixture holds exactly ${PATTERN_DEMO_GAMES.join(", ")} (has ${demos.map((d) => d.game).join(", ")})`,
);
ok(
  Object.keys(BUNDLED_INTRO_DEMOS).sort().join() === [...PATTERN_DEMO_GAMES].sort().join(),
  `the bundled demos are exactly the fixture's games (bundled ${Object.keys(BUNDLED_INTRO_DEMOS).join(", ")})`,
);

for (const demo of demos) {
  const { game, row, run, stamp } = demo;
  const asRow = row as unknown as Row;
  // 1. The row.
  const file = readFileSync(`src/lib/duel/bundledDemos/${game}.json`, "utf8").trim();
  ok(JSON.stringify(row) === file, `${game}: the fixture's row is the bundled demo byte for byte`);
  ok(JSON.stringify(bundledIntroDemo(game)) === file, `${game}: bundledIntroDemo serves that file`);
  ok(row.game_type === game && row.puzzle.type === game, `${game}: game_type and puzzle type`);
  ok(row.seed === 0 && row.start_tick === 0 && row.example_id === INTRO_EXAMPLE_ID, `${game}: the fixed intro example's row (seed 0, start 0, ${INTRO_EXAMPLE_ID})`);
  ok(isPuzzleDemoLog(row.input_log), `${game}: a puzzle demo log`);
  const lastT = Math.max(...row.input_log.actions.map((a) => a.t));
  ok(row.length_ticks === Math.round(lastT), `${game}: length is the last touch's time (${row.length_ticks})`);
  ok(row.input_log.actions[0]?.t === 600, `${game}: the first touch at 0.6 s, as every bundled demo`);
  ok(!REVISED_PUZZLE_DEMOS.has(game) || row.input_log.presentation === puzzlePresentation(game), `${game}: today's presentation (${row.input_log.presentation})`);
  ok(puzzleInputDemoCompatible(game, row.input_log as never), `${game}: the phone's presentation rule accepts it`);
  ok(!JSON.stringify(row).includes("__"), `${game}: no sealed-only fields`);
  const st = PATTERN_NOV15_STAMPS[game as never] as { key: string; from: number; to: number } | undefined;
  ok(st && st.key === stamp.key && st.to === stamp.rev, `${game}: the fixture's stamp is the overhaul's (${stamp.key} ${stamp.rev})`);
  ok(row.puzzle[stamp.key] === stamp.rev, `${game}: recorded on ${stamp.key} ${stamp.rev}`);

  // 2. Today's intro example (worked out as practiceGenerateFn does).
  const example = introExample(game);
  const pub = splitPuzzle(example).pub;
  ok(samePuzzle(pub, row.puzzle), `${game}: the puzzle is exactly today's intro example (public half)`);
  ok(!("solution" in row.puzzle), `${game}: only the public half is stored (no solution)`);

  // 3. getIntroDemoFn's rules and choice.
  ok(acceptIntroDemo(game, asRow) === asRow, `${game}: getIntroDemoFn's stamp rules accept it`);
  if (st) {
    const older = clone(asRow);
    (older.puzzle as unknown as Record<string, number>)[st.key] = st.from;
    ok(acceptIntroDemo(game, older) === null, `${game}: the same demo on ${st.key} ${st.from} is refused (it stops where the stamp changed)`);
    ok(pickIntroDemo(game, acceptIntroDemo(game, older), asRow) === asRow, `${game}: a refused live row → the bundled demo`);
  }
  ok(pickIntroDemo(game, null, asRow) === asRow, `${game}: no live row → the bundled demo`);
  const live = clone(asRow);
  ok(pickIntroDemo(game, acceptIntroDemo(game, live), asRow) === live, `${game}: a live row on today's stamp wins`);

  // 4. The run, graded by practice's grading on the full example (the claim bound by its own receipt, as practice does).
  const full = mergePuzzle(pub as never, splitPuzzle(example).priv as never);
  const { ms, received } = practiceTrustedMs(full, run.msRemaining, run.msRemaining);
  const graded = gradeAnswer(full, run.answer, ms, run.extra as never, received);
  ok(graded.score === run.score, `${game}: the run grades to the stored score (${graded.score}, stored ${run.score})`);
  ok(graded.isCorrect === true && run.isCorrect === true, `${game}: the run is a solve`);
  ok(graded.storedMs === run.storedMs, `${game}: stored time left ${graded.storedMs} (fixture ${run.storedMs})`);
  ok(run.score >= 1 && run.score <= 200, `${game}: score in range (${run.score})`);
  // …and the grade is sharp: the same answer without its final move doesn't solve.
  const cut = cutLastMove(game, run.answer);
  if (cut !== null) {
    const short = gradeAnswer(full, cut, ms, run.extra as never, received);
    ok(!short.isCorrect && short.score < run.score, `${game}: without its last move the run no longer solves (${short.score})`);
  }
}

/** The answer less its final move, for the games whose answer is a plain move list (null for the others). */
function cutLastMove(game: string, answer: string): string | null {
  if (game === "unblock") {
    const [moves] = answer.split("tl1:");
    return moves!.split(",").slice(0, -1).join(",");
  }
  if (game === "laser") return answer.replace(/,f@\d+$/, "");
  return null;
}

/* ------------------------------------------------------------------ the touches are the answer (Gridlock, Lightbender) */

{
  const demo = demos.find((d) => d.game === "unblock")!;
  const log = demo.row.input_log;
  const moves = decodeMoves(demo.run.answer.split("tl1:")[0]!);
  ok(moves.some((m) => m.id === -1), "unblock: the run shows an Undo");
  const p = demo.row.puzzle as unknown as { vehicles: { id: number; axis: "h" | "v"; len: number; row: number; col: number }[] };
  const state = new Map(p.vehicles.map((v) => [v.id, { ...v }]));
  const done: { id: number; before: { row: number; col: number } }[] = [];
  const pairs: { u: number; v: number; x: number; y: number; dx: number; dy: number; axis: "h" | "v"; delta: number }[] = [];
  const touches = log.actions;
  let i = 0;
  let paired = true;
  for (const m of moves) {
    const a = touches[i++];
    if (m.id === -1) {
      paired &&= a?.action === "tap";
      const last = done.pop();
      if (last) Object.assign(state.get(last.id)!, last.before);
      continue;
    }
    const v = state.get(m.id)!;
    paired &&= a?.action === "drag";
    if (a?.action !== "drag") continue;
    const from = a.args["from"] as { x: number; y: number };
    const to = a.args["to"] as { x: number; y: number };
    const pos = v.axis === "h" ? v.col : v.row;
    pairs.push({
      u: v.col + (v.axis === "h" ? v.len / 2 : 0.5),
      v: v.row + (v.axis === "v" ? v.len / 2 : 0.5),
      x: from.x * log.w,
      y: from.y * log.h,
      dx: (to.x - from.x) * log.w,
      dy: (to.y - from.y) * log.h,
      axis: v.axis,
      delta: m.to - pos,
    });
    done.push({ id: m.id, before: { row: v.row, col: v.col } });
    if (v.axis === "h") v.col = m.to;
    else v.row = m.to;
  }
  ok(paired && i === touches.length, `unblock: one drag a slide and one tap an Undo, in order (${touches.length} touches, ${moves.length} answer moves)`);
  // The board's place and square size from the drags' starts (x = x0 + c·u, y = y0 + c·v, least squares).
  const n = pairs.length;
  const suu = pairs.reduce((s, q) => s + q.u * q.u + q.v * q.v, 0);
  const sux = pairs.reduce((s, q) => s + q.u * q.x + q.v * q.y, 0);
  const sx = pairs.reduce((s, q) => s + q.x, 0);
  const sy = pairs.reduce((s, q) => s + q.y, 0);
  const sumU = pairs.reduce((s, q) => s + q.u, 0);
  const sumV = pairs.reduce((s, q) => s + q.v, 0);
  // Minimise Σ(x − x0 − c·u)² + (y − y0 − c·v)²: x0 = (Σx − cΣu)/n, y0 = (Σy − cΣv)/n.
  const c = (sux - (sumU * sx + sumV * sy) / n) / (suu - (sumU * sumU + sumV * sumV) / n);
  const x0 = (sx - c * sumU) / n;
  const y0 = (sy - c * sumV) / n;
  const off = Math.max(...pairs.map((q) => Math.max(Math.abs(q.x - x0 - c * q.u), Math.abs(q.y - y0 - c * q.v)) / c));
  ok(c > 30 && off < 0.2, `unblock: every drag starts on the car it moves (a ${c.toFixed(1)} px square, off by ${off.toFixed(3)} of one)`);
  const slid = pairs.every((q) => {
    const along = (q.axis === "h" ? q.dx : q.dy) / c;
    const across = (q.axis === "h" ? q.dy : q.dx) / c;
    return Math.round(along) === q.delta && Math.abs(along - q.delta) < 0.3 && Math.abs(across) < 0.3;
  });
  ok(slid, "unblock: every drag slides its car exactly the answer's squares, along its lane");
}
{
  const demo = demos.find((d) => d.game === "laser")!;
  const acts = demo.run.answer.replace(/^alog1:/, "").split(",").map((a) => a.split("@")[0]!);
  const count = (re: RegExp) => acts.filter((a) => re.test(a)).length;
  const places = count(/^p\d+/);
  const turns = count(/^r\d+/);
  const solution = (splitPuzzle(introExample("laser")).priv as { solution: unknown[] }).solution;
  ok(places === solution.length, `laser: one placement a piece (${places} of ${solution.length})`);
  ok(count(/^f$/) === 1 && acts.at(-1) === "f", "laser: one Fire, last");
  // Undo of a turn turns it back (a second r on the same cell in a row); Undo of a move moves it back.
  const turnedBack = acts.some((a, k) => k > 0 && a.startsWith("r") && acts[k - 1] === a);
  const moves = acts.filter((a) => a.startsWith("m"));
  const ends = moves.map((a) => a.slice(1).split("-").map(Number));
  const movedBack = moves.length === 2 && ends[0]![0] === ends[1]![1] && ends[0]![1] === ends[1]![0];
  ok(turnedBack, "laser: the run turns a mirror and Undo turns it back");
  ok(movedBack, `laser: the run moves a mirror and Undo moves it back (${moves.join(", ")})`);
  const touches = demo.row.input_log.actions;
  const taps = touches.filter((a) => a.action === "tap").length;
  const drags = touches.filter((a) => a.action === "drag").length;
  // Every tap: a placement, a turn by tap (all but Undo's), the two Undos, the tray's two picks (splitter, then mirror), Fire.
  ok(drags === 1 && taps === places + (turns - 1) + 2 + 2 + 1, `laser: the touches are the answer's actions (${taps} taps, ${drags} drag)`);
}

/* ------------------------------------------------------------------ 5. the real functions on PostgreSQL */

let db: LocalDb | null = null;
let rest: RestServer | null = null;
if (!postgresBin()) {
  if (process.env["CI"]) ok(false, "no PostgreSQL binaries on the CI runner");
  else console.log("  NOTE no PostgreSQL binaries: the real server functions and the save script were not run (CI runs them)");
} else {
  try {
    db = startLocalDb("pattern-demos-");
    ok(db.failed === null, `all migrations apply${db.failed ? ` (${db.failed.file}: ${db.failed.error})` : ""}`);
    // The live unblock_bank was loaded from the fallback bank in its order (docs/supabase-move/runbook.md: ids 1–400).
    const values = UNBLOCK_BANK.map((e) => {
      const [l, m, s] = e.split("|");
      return `('${l}', ${Number(m)}, '${s}')`;
    });
    ok(db.psql(`INSERT INTO public.unblock_bank (layout, min_moves, solution) VALUES ${values.join(",")};`).ok, "unblock_bank loaded");
    rest = await startRestServer(db.socketDir);
    process.env["SUPABASE_URL"] = rest.url;
    process.env["SUPABASE_PUBLISHABLE_KEY"] = ANON_KEY;
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = SERVICE_KEY;
    const KEY = "pattern-demos-check-key-7f3a";
    process.env["INTRO_DEMO_KEY"] = KEY;
    await serverChecks(db, KEY);
  } catch (err) {
    ok(false, `harness: ${err instanceof Error ? err.message : String(err)}`);
  } finally {
    await rest?.stop();
    db?.stop();
  }
}

async function serverChecks(db: LocalDb, KEY: string): Promise<void> {
  const practice = await import("../src/lib/duel/practice.functions");
  const intro = await import("../src/lib/duel/introDemo.functions");
  const FNS: Record<DemoFn, unknown> = {
    checkDemoKeyFn: practice.checkDemoKeyFn,
    practiceGenerateFn: practice.practiceGenerateFn,
    savePuzzleDemoFn: practice.savePuzzleDemoFn,
    getIntroDemoFn: intro.getIntroDemoFn,
  };
  const call: DemoCall = (fn, data) => callServerFn(FNS[fn], data, null);
  const stored = () =>
    db.psql(`SELECT coalesce(json_agg(json_build_object('game_type', game_type, 'seed', seed, 'puzzle', puzzle, 'input_log', input_log, 'example_id', example_id, 'start_tick', start_tick, 'length_ticks', length_ticks) ORDER BY game_type), '[]') FROM public.intro_demos`);
  const rows = () => JSON.parse(stored().out || "[]") as PatternDemo["row"][];

  // practiceGenerateFn's own example, and practiceGradeFn on its sealed deal.
  for (const demo of demos) {
    const deal = (await call("practiceGenerateFn", { type: demo.game, example: true })) as { puzzle: unknown; sealed: string };
    // At or after the deal's own sealed time (it is sealed as the call ends).
    const dealtAt = Date.now();
    ok(samePuzzle(deal.puzzle, demo.row.puzzle), `${demo.game}: practiceGenerateFn's intro example is the fixture's puzzle`);
    // The answer arrives when the run did: the intro (no start token, so the round counts from the intro's own end),
    // the board's prep, then the time the run took. The server's receipt holds the claim and the action log to it.
    const full = mergePuzzle(splitPuzzle(introExample(demo.game)).pub as never, splitPuzzle(introExample(demo.game)).priv as never);
    const arrives = dealtAt + INTRO_MS + puzzlePrepMs(full) + (puzzleTimeLimitMs(full) - demo.run.msRemaining) + 100;
    const realNow = Date.now;
    Date.now = () => arrives;
    let graded: { score: number; isCorrect: boolean };
    try {
      graded = (await callServerFn(practice.practiceGradeFn, { puzzle: deal.puzzle, sealed: deal.sealed, answer: demo.run.answer, msRemaining: demo.run.msRemaining, ...(demo.run.extra ? { extra: demo.run.extra } : {}) }, null)) as { score: number; isCorrect: boolean };
    } finally {
      Date.now = realNow;
    }
    ok(graded.score === demo.run.score && graded.isCorrect, `${demo.game}: practiceGradeFn grades the run to ${graded.score} (stored ${demo.run.score})`);
  }
  // Without the table, Gridlock's example is another board: the save script would refuse it (the deal must match).
  db.psql("ALTER TABLE public.unblock_bank RENAME TO unblock_bank_off;");
  const lines: string[] = [];
  const print = (line: string) => lines.push(line);
  const unblockOnly = demos.filter((d) => d.game === "unblock");
  let res = await saveDemos({ call, key: KEY, dry: true, demos: unblockOnly, print }).catch(() => null);
  ok(res === null || res.every((r) => !r.ok), "save: Gridlock's example from another bank row is refused");
  db.psql("ALTER TABLE public.unblock_bank_off RENAME TO unblock_bank;");

  // A wrong key saves nothing.
  res = await saveDemos({ call, key: "not-the-key", dry: false, demos, print });
  ok(res.length === demos.length && res.every((r) => !r.ok), "save: a wrong key fails every game");
  ok(rows().length === 0, "save: a wrong key stores nothing");
  // A fixture that isn't the server's example is refused.
  const tampered = clone(demos.find((d) => d.game === "laser")!);
  (tampered.row.puzzle as { gems: number[] }).gems = [...(tampered.row.puzzle as { gems: number[] }).gems].reverse();
  res = await saveDemos({ call, key: KEY, dry: false, demos: [tampered], print });
  ok(res.length === 1 && !res[0]!.ok && /refused/.test(res[0]!.line) && /gems/.test(res[0]!.line), `save: a puzzle that isn't the server's example is refused (${res[0]?.line})`);
  ok(rows().length === 0, "save: the refused demo stores nothing");
  // A dry run checks every deal and saves nothing.
  res = await saveDemos({ call, key: KEY, dry: true, demos, print });
  ok(res.every((r) => r.ok && /dry run/.test(r.line)), "save: a dry run passes every game");
  ok(rows().length === 0, "save: a dry run stores nothing");
  // The real run stores exactly the fixture's rows, and the intro serves them.
  res = await saveDemos({ call, key: KEY, dry: false, demos, print });
  ok(res.every((r) => r.ok), `save: every game saved and served back (${res.filter((r) => !r.ok).map((r) => r.line).join("; ")})`);
  const saved = rows();
  ok(saved.length === demos.length, `save: one row a game (${saved.length})`);
  for (const demo of demos) {
    const row = saved.find((r) => r.game_type === demo.game);
    ok(
      row &&
        canonicalJson(comparablePuzzle(row.puzzle)) === canonicalJson(comparablePuzzle(demo.row.puzzle)) &&
        canonicalJson(row.input_log) === canonicalJson(demo.row.input_log) &&
        row.seed === demo.row.seed &&
        row.start_tick === demo.row.start_tick &&
        row.length_ticks === demo.row.length_ticks &&
        row.example_id === demo.row.example_id,
      `${demo.game}: the stored row is the fixture's row`,
    );
    const served = (await call("getIntroDemoFn", { type: demo.game })) as Row | null;
    ok(served && canonicalJson(served.input_log) === canonicalJson(demo.row.input_log) && acceptIntroDemo(demo.game, served) === served, `${demo.game}: the intro plays the saved demo`);
  }
  ok(!lines.some((l) => l.includes(KEY)), "save: the key is never printed");
}

/* ------------------------------------------------------------------ the command line */

const cli = (args: string[], env: Record<string, string>) =>
  spawnSync("bun", ["scripts/pattern-demos-save.ts", ...args], {
    encoding: "utf8",
    env: { PATH: process.env["PATH"] ?? "", HOME: process.env["HOME"] ?? "", ...env },
    timeout: 60_000,
  });
const SECRET = "cli-secret-key-9c1e";
let r = cli([], { INTRO_DEMO_KEY: SECRET });
ok(r.status === 2 && /DEMOS_URL/.test(r.stdout), `cli: no URL exits 2 (${r.status})`);
r = cli(["--url=http://127.0.0.1:9"], {});
ok(r.status === 2 && /INTRO_DEMO_KEY/.test(r.stdout), `cli: no key exits 2 (${r.status})`);
r = cli(["--dry", "--games=flow"], { DEMOS_URL: "http://127.0.0.1:9", INTRO_DEMO_KEY: SECRET });
ok(r.status === 1 && /^FAIL flow:/m.test(r.stdout), `cli: an unreachable server fails the game and exits 1 (${r.status})`);
ok(!`${r.stdout}${r.stderr}`.includes(SECRET), "cli: the key is never printed");
r = cli([`--key=${SECRET}`, "--games=nope"], { DEMOS_URL: "http://127.0.0.1:9" });
ok(r.status === 1 && /FAIL nope/.test(r.stdout) && !r.stdout.includes(SECRET), `cli: an unknown game fails (${r.status})`);
// Flags win over the environment; the environment alone is enough.
const flags = readSettings(["--url=http://a", "--key=k1", "--games=flow, laser", "--dry"], { DEMOS_URL: "http://b", INTRO_DEMO_KEY: "k2", DEMOS_GAMES: "pipes", DEMOS_DRY: "0" });
ok(flags.url === "http://a" && flags.key === "k1" && flags.games.join() === "flow,laser" && flags.dry === true, "cli: flags win over the environment");
const fromEnv = readSettings([], { DEMOS_URL: "http://b", INTRO_DEMO_KEY: "k2", DEMOS_GAMES: "pipes,gravity", DEMOS_DRY: "1" });
ok(fromEnv.url === "http://b" && fromEnv.key === "k2" && fromEnv.games.join() === "pipes,gravity" && fromEnv.dry === true, "cli: the environment alone sets everything");
ok(readSettings(["--no-dry"], { DEMOS_DRY: "1" }).dry === false && readSettings([], {}).dry === false, "cli: a real run unless asked for a dry one");

if (failures.length) {
  for (const f of failures) console.log(`FAIL: ${f}`);
  console.log(`pattern-demos-check: FAIL (${failures.length} failed, ${passes} passed)`);
  process.exit(1);
}
console.log(`pattern-demos-check: PASS (${passes} assertions)`);
