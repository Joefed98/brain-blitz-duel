/**
 * Letting completion effects be seen (13 Oct 2026): after a solve the shared
 * frame holds the board until the signature beat has finished (at most 2 s from
 * the solve). Rooms keep the locked board at full brightness (no Locked card)
 * until then and dim it as before; practice shows the reveal once the beat ends,
 * and a tap anywhere goes to it at once. The answer still leaves at the solve
 * moment with the same time; unsolved, timed-out, no-finish and reduced-motion
 * rounds are never held.
 */
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { Window } from "happy-dom";

const window = new Window({ width: 375, height: 667 });
let reduced = false;
(window as unknown as { matchMedia: (q: string) => { matches: boolean } }).matchMedia = () => ({
  matches: reduced,
});
Object.assign(globalThis, {
  window,
  document: window.document,
  CustomEvent: window.CustomEvent,
  HTMLElement: window.HTMLElement,
});

const failures: string[] = [];
const ok = (cond: boolean, message: string) => {
  if (!cond) {
    failures.push(message);
    console.log(`FAIL ${message}`);
  }
};

const sig = await import("../src/lib/fx/signature");
const { BAND_SPECS } = await import("../src/lib/arcade/bandParts");
const { GameLayout } = await import("../src/components/duel/PhoneShell");
const {
  NO_FINISH_TYPES,
  SIGNATURE_DELAY_MS,
  SIGNATURE_HOLD_MAX_MS,
  SIGNATURE_MS,
  noteSignatureSubmit,
  setSignatureGame,
  signatureArcadeRunOver,
  signatureHoldUntil,
} = sig;

ok(SIGNATURE_HOLD_MAX_MS === 2000, "the hold is at most 2 s from the solve");

// A controllable phone clock (Date.now) and no real timers for the beat itself.
const realNow = Date.now;
let clock = 1_000_000;
Date.now = () => clock;
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = (() => 0) as unknown as typeof setTimeout;

const verdict = (over: Partial<Parameters<typeof signatureHoldUntil>[0]> = {}) => ({
  type: "sudoku" as const,
  arcade: false,
  correct: true,
  score: 140,
  msRemaining: 30_000,
  timeLimitMs: 90_000,
  ...over,
});
/** Solve at `solveAt`, the verdict lands `after` ms later: the hold's end, relative to the solve. */
const holdFor = (over: Partial<Parameters<typeof signatureHoldUntil>[0]> = {}, after = 300) => {
  const solveAt = (clock += 10_000);
  noteSignatureSubmit((over.type ?? "sudoku") as never);
  clock = solveAt + after;
  const until = signatureHoldUntil(verdict(over) as never);
  return until === null ? null : until - solveAt;
};

// Solved: held to the beat's end (1.0 s delay + 0.6 s), never past 2 s.
const beatEnd = SIGNATURE_DELAY_MS + SIGNATURE_MS;
ok(holdFor() === beatEnd, `solve, verdict at 0.3 s → held to the beat's end (${holdFor()} ms)`);
ok(holdFor({ msRemaining: 60_000 }) === beatEnd, "fast solve → held to the beat's end");
ok(holdFor({}, 1500) === SIGNATURE_HOLD_MAX_MS, "late verdict (beat 1.5–2.1 s) → capped at 2 s");
ok(holdFor({}, 2100) === null, "verdict after 2 s → no hold");
// Unsolved, timed out, no-finish games, reduced motion: never held.
ok(holdFor({ correct: false, score: 90 }) === null, "unsolved → no hold");
ok(holdFor({ msRemaining: 0 }) === null, "timed out → no hold");
for (const type of NO_FINISH_TYPES)
  ok(holdFor({ type, correct: true, score: 140, msRemaining: 5_000 }) === null, `${type} → no hold`);
reduced = true;
ok(holdFor() === null, "reduced motion → no wait");
reduced = false;
// A verdict with no recent submit on this phone (a reload mid-round) → no hold.
clock += 60_000;
ok(signatureHoldUntil(verdict() as never) === null, "no recent submit → no hold");

// Arcade: a finish game whose run reached the finish holds; unfinished and open runs do not.
const specs = BAND_SPECS as Record<string, unknown>;
const parts = (finished: boolean, points: number) => () => ({
  units: 0,
  points,
  bonus: 0,
  penalty: 0,
  finished,
  text: "",
});
document.body.innerHTML = `<div data-game-stage></div>`;
const arcadeHold = (key: string, finished: boolean, kind: "finish" | "open") => {
  specs[key] = { parts: parts(finished, 130), curve: [], kind };
  const release = setSignatureGame({ type: key as never, arcade: true, runMs: 60_000 });
  const solveAt = (clock += 10_000);
  signatureArcadeRunOver({ band: 1, acted: 1, tick: 60 * 40 });
  noteSignatureSubmit(key as never);
  clock = solveAt + 400;
  const until = signatureHoldUntil(verdict({ type: key as never, arcade: true }) as never);
  release();
  delete specs[key];
  return until === null ? null : until - solveAt;
};
ok(arcadeHold("__finishA", true, "finish") === beatEnd, "arcade finish reached → held to the beat's end");
ok(arcadeHold("__finishB", false, "finish") === null, "arcade finish not reached → no hold");
ok(arcadeHold("__openA", false, "open") === null, "arcade open run (ends at the buzzer) → no hold");

Date.now = realNow;
globalThis.setTimeout = realSetTimeout;

// The shared frame: a held locked board keeps full brightness and takes no taps; then it dims.
const board = (locked: boolean, held: boolean) => {
  const host = document.createElement("div");
  host.innerHTML = renderToStaticMarkup(
    <GameLayout label="R" title="T" help={null} locked={locked} held={held}>
      <div />
    </GameLayout>,
  );
  return host.querySelector("[data-game-stage]")!.getAttribute("class") ?? "";
};
ok(!/opacity-30/.test(board(true, true)) && /pointer-events-none/.test(board(true, true)), "held: undimmed, no taps");
ok(/opacity-30/.test(board(true, false)) && /pointer-events-none/.test(board(true, false)), "after the hold: dimmed as before");
ok(!/opacity-30|pointer-events-none/.test(board(false, false)), "unlocked board unchanged");

// Rooms: wired through the hold; the answer still leaves at the solve moment.
const read = (p: string) => readFileSync(p, "utf8");
const room = read("src/routes/duel.$code.tsx");
ok(/const holdUntil = useSignatureHold\(/.test(room), "rooms: hold worked out from the stored verdict");
ok(/const boardHeld = holdUntil !== null && Date\.now\(\) < holdUntil;/.test(room), "rooms: held until the beat ends");
ok(/locked=\{!!myResult\}\s*held=\{boardHeld\}/.test(room), "rooms: locked board held undimmed");
ok(/\{myResult && !boardHeld && \(/.test(room), "rooms: Locked card waits for the hold");
const roomSubmit = room.split("const handleSubmit = useCallback(")[1]?.split("}, [")[0] ?? "";
ok(
  /const at = serverNow\(\);/.test(roomSubmit) &&
    /latest\.current\.clockDeadline - at/.test(roomSubmit) &&
    !/hold|Hold/.test(roomSubmit),
  "rooms: submission time measured at the solve, untouched by the hold",
);

// Practice: graded at the solve; the reveal waits for the beat; a tap skips it.
const practice = read("src/routes/practice.tsx");
const grade = practice.split("const grade = useCallback(")[1]?.split("\n  );\n")[0] ?? "";
const submitAt = grade.indexOf("await practiceGradeFn(");
const holdAt = grade.indexOf("signatureHoldUntil(");
ok(
  submitAt > 0 &&
    holdAt > submitAt &&
    /const remaining =\s*clockDeadline === null \? timeLimitMs : Math\.max\(0, clockDeadline - Date\.now\(\)\);/.test(
      grade.slice(0, submitAt),
    ),
  "practice: answer graded with the solve-moment time before any hold",
);
ok(
  /if \(holdUntil !== null\) \{\s*setRevealAt\(holdUntil\);\s*return;\s*\}\s*setStartedAt\(Date\.now\(\)\);\s*setStage\("reveal"\);/.test(
    grade,
  ),
  "practice: solved → reveal at the hold's end; otherwise the reveal at once",
);
ok(
  /window\.setTimeout\(showReveal, Math\.max\(0, revealAt - Date\.now\(\)\)\)/.test(practice),
  "practice: reveal shown once the beat has finished",
);
ok(
  /document\.addEventListener\("pointerdown", skip, true\)/.test(practice) &&
    /const skip = \(\) => showReveal\(\);/.test(practice),
  "practice: a tap anywhere goes to the reveal at once",
);
ok(
  /const showReveal = useCallback\(\(\) => \{\s*setRevealAt\(null\);\s*setStartedAt\(Date\.now\(\)\);\s*setStage\("reveal"\);/.test(
    practice,
  ),
  "practice: the reveal runs its full length from when it appears",
);
ok(/locked=\{holding\}\s*held=\{holding\}/.test(practice), "practice: held board undimmed, no taps");
ok(
  (practice.match(/setRevealAt\(null\)/g) ?? []).length >= 3,
  "practice: a new run or Back clears a pending hold",
);

// No game file takes part.
for (const file of (await import("node:fs")).readdirSync("src/puzzles"))
  ok(!/signatureHoldUntil|useSignatureHold|held=/.test(read(`src/puzzles/${file}`)), `${file} untouched`);

if (failures.length) {
  console.log(`FAIL: ${failures.length} beat-hold problem(s)`);
  process.exit(1);
}
console.log(
  "PASS: beat hold: solved boards held to the beat's end (1.6 s, capped at 2 s), unsolved/timed-out/no-finish/reduced-motion/reloaded rounds and arcade runs without a finish never held, rooms undimmed with no Locked card until then, practice reveal after the beat with tap-to-skip, submission time unchanged",
);
