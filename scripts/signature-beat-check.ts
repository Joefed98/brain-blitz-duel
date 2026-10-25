/**
 * The shared signature beat (13 Oct 2026): which completions earn it, its two
 * tiers, its timing (SIGNATURE_DELAY_MS after the solve moment, SIGNATURE_MS
 * long, never when the verdict is too late), its named sound cues, the reveal's
 * perfect-score burst, reduced motion, and that it never takes taps. Presentation
 * only: no game state, recorded time or score is touched (the module imports no
 * grading or room code, and the beat's layer has pointer-events none).
 */
import { readFileSync } from "node:fs";
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

const cues: string[] = [];
window.addEventListener("duelz-sound", (event) =>
  cues.push((event as unknown as CustomEvent<{ cue: string }>).detail.cue),
);

const sig = await import("../src/lib/fx/signature");
const { BAND_SPECS } = await import("../src/lib/arcade/bandParts");
const { DEFAULT_ROUND_MAX, roundMaxFor } = await import("../src/lib/duel/roundMax");
const {
  NO_FINISH_TYPES,
  PERFECT_CUE,
  SIGNATURE_CUES,
  SIGNATURE_DELAY_MS,
  SIGNATURE_LATE_MS,
  SIGNATURE_MIN_SCORE,
  SIGNATURE_MS,
  noteSignatureSubmit,
  perfectBurst,
  playSignature,
  recentSignatureSubmit,
  scheduleSignature,
  signatureTierForArcadeRun,
  signatureTierForVerdict,
} = sig;

// Timing and cue names.
ok(
  SIGNATURE_DELAY_MS === 1000 && SIGNATURE_MS === 600,
  "beat starts 1.0 s after the solve and lasts 0.6 s",
);
ok(
  SIGNATURE_CUES.solve === "shared.signature.solve" &&
    SIGNATURE_CUES.fast === "shared.signature.fast" &&
    PERFECT_CUE === "shared.perfect",
  "cue names",
);

// Puzzles: a solve earns the beat, "fast" with at least half the time left.
const v = (over: Partial<Parameters<typeof signatureTierForVerdict>[0]>) =>
  signatureTierForVerdict({
    type: "sudoku",
    arcade: false,
    correct: true,
    score: 140,
    msRemaining: 10_000,
    timeLimitMs: 90_000,
    ...over,
  });
ok(v({}) === "solve", "solved puzzle → solve");
ok(v({ msRemaining: 45_000 }) === "fast", "solved with half the time left → fast");
ok(v({ msRemaining: 44_999 }) === "solve", "just under half → solve");
ok(
  v({ correct: false, score: 120 }) === null,
  "unsolved puzzle → no beat, whatever its partial score",
);
ok(v({ type: "orbit", arcade: true }) === null, "arcade beats come from the run, not the verdict");
// Non-arcade games with no finish state: 120 of 150 or more at the end of the run, scaled to the
// game's own maximum (roundMax.ts: 120 at 150, 160 at 200), worked out here from roundMaxFor.
ok(SIGNATURE_MIN_SCORE === 120, "the no-finish threshold is 120 on the 150 scale");
for (const type of NO_FINISH_TYPES) {
  const min = Math.round((SIGNATURE_MIN_SCORE * roundMaxFor(type)) / DEFAULT_ROUND_MAX);
  ok(
    v({ type, correct: true, score: min - 1, msRemaining: 60_000 }) === null,
    `${type}: ${min - 1} → no beat`,
  );
  ok(
    v({ type, correct: false, score: min, msRemaining: 0 }) === "solve",
    `${type}: ${min} at the end → solve`,
  );
}

// Arcade runs: finish games on reaching the finish, open games at 120+.
const specs = BAND_SPECS as Record<string, unknown>;
const parts = (finished: boolean, points: number) => () => ({
  units: 0,
  points,
  bonus: 0,
  penalty: 0,
  finished,
  text: "",
});
specs["__finish"] = { parts: parts(true, 100), curve: [], kind: "finish" };
specs["__unfinished"] = { parts: parts(false, 140), curve: [], kind: "finish" };
specs["__open"] = { parts: parts(false, 120), curve: [], kind: "open" };
specs["__openLow"] = { parts: parts(false, 119), curve: [], kind: "open" };
const banded = (tick: number, acted = 1) => ({ band: 1, acted, tick });
ok(
  signatureTierForArcadeRun("__finish", banded(60 * 20), 60_000) === "fast",
  "finish reached in 20 s of 60 → fast",
);
ok(
  signatureTierForArcadeRun("__finish", banded(60 * 40), 60_000) === "solve",
  "finish reached at 40 s of 60 → solve",
);
ok(
  signatureTierForArcadeRun("__unfinished", banded(60 * 60), 60_000) === null,
  "finish game without the finish → no beat",
);
ok(
  signatureTierForArcadeRun("__open", banded(60 * 60), 60_000) === "solve",
  "open game at 120 → solve",
);
ok(
  signatureTierForArcadeRun("__openLow", banded(60 * 60), 60_000) === null,
  "open game at 119 → no beat",
);
ok(
  signatureTierForArcadeRun("__open", banded(60 * 60, 0), 60_000) === null,
  "no input scores 0 → no beat",
);
ok(
  signatureTierForArcadeRun("__open", { tick: 3600 }, 60_000) === null,
  "pre-band (legacy) runs → no beat",
);
ok(signatureTierForArcadeRun("not-a-game", banded(1), 60_000) === null, "unknown game → no beat");
for (const key of ["__finish", "__unfinished", "__open", "__openLow"]) delete specs[key];

// Submit moments: only recent submits of the same game time a beat.
noteSignatureSubmit("sudoku");
ok(
  recentSignatureSubmit("sudoku") !== null && recentSignatureSubmit("tents") === null,
  "submit moment is per game",
);

// Scheduling: SIGNATURE_DELAY_MS after the solve, at once if already past, never when too late.
const timers: { at: number; fn: () => void }[] = [];
const realSetTimeout = globalThis.setTimeout;
globalThis.setTimeout = ((fn: () => void, ms = 0) => {
  timers.push({ at: ms, fn });
  return timers.length as unknown as ReturnType<typeof setTimeout>;
}) as typeof setTimeout;
const now = Date.now();
scheduleSignature("solve", now);
ok(
  timers.length === 1 && Math.abs(timers[0]!.at - SIGNATURE_DELAY_MS) <= 20,
  `scheduled ${timers[0]?.at} ms after the solve`,
);
scheduleSignature("solve", now - 1500);
ok(timers.length === 2 && timers[1]!.at === 0, "a late verdict plays at once");
scheduleSignature("solve", now - SIGNATURE_LATE_MS - 1);
ok(timers.length === 2, "a verdict over 4 s late plays nothing");
timers.length = 0;

// Drawing: over the game region (below the timer), never taking taps, then removed.
document.body.innerHTML = `<div data-timer style="height:20px"></div><div data-game-region></div>`;
const region = document.querySelector("[data-game-region]")!;
(region as unknown as { getBoundingClientRect: () => DOMRect }).getBoundingClientRect = () =>
  ({
    left: 4,
    top: 120,
    width: 367,
    height: 480,
    right: 371,
    bottom: 600,
    x: 4,
    y: 120,
    toJSON: () => ({}),
  }) as DOMRect;
cues.length = 0;
playSignature("fast");
const layer = document.querySelector<HTMLElement>("[data-signature-beat]");
ok(layer !== null && layer.dataset["signatureBeat"] === "fast", "beat layer drawn");
ok(layer?.style.pointerEvents === "none", "beat never takes taps");
ok(
  layer?.style.top === "120px" && layer?.style.height === "480px",
  "beat sits over the game region, below the timer",
);
const logo = layer?.querySelector("img");
ok(logo?.getAttribute("src") === "/icon-512.png", "logo drawn from the app-logo asset");
const raysFast = layer?.querySelectorAll("span").length ?? 0;
ok(cues.join() === "shared.signature.fast", `fast beat dispatches its cue (${cues.join()})`);
timers.forEach((t) => t.fn());
ok(document.querySelector("[data-signature-beat]") === null, "beat layer removed after it ends");
timers.length = 0;
playSignature("solve");
const raysSolve =
  document.querySelector("[data-signature-beat]")?.querySelectorAll("span").length ?? 0;
ok(
  raysFast > raysSolve && raysSolve > 0,
  `fast tier is a little bigger (${raysFast} vs ${raysSolve} rays)`,
);
timers.forEach((t) => t.fn());
timers.length = 0;
reduced = true;
playSignature("fast");
ok(
  (document.querySelector("[data-signature-beat]")?.querySelectorAll("span").length ?? -1) === 0,
  "reduced motion: no burst, a soft fade only",
);
timers.forEach((t) => t.fn());
timers.length = 0;
reduced = false;

// The reveal's perfect score (the game's maximum): one gold burst with its cue.
cues.length = 0;
const score = document.createElement("p");
document.body.appendChild(score);
perfectBurst(score);
ok(
  document.querySelector("[data-perfect-burst]") !== null && cues.join() === PERFECT_CUE,
  "perfect burst drawn with shared.perfect",
);
globalThis.setTimeout = realSetTimeout;

// Wiring: one common point each, no game fires it itself.
const read = (p: string) => readFileSync(p, "utf8");
ok(
  /signatureArcadeRunOver\(state\)/.test(read("src/lib/fx/arcade.ts")),
  "arcadeFeedback (every arcade run's end) feeds the beat",
);
ok(
  /setSignatureGame\(signature\)/.test(read("src/components/duel/FeedbackStage.tsx")),
  "FeedbackStage registers the game on screen",
);
for (const route of ["src/routes/duel.$code.tsx", "src/routes/practice.tsx"]) {
  const text = read(route);
  ok(
    /useSignatureVerdict\(/.test(text) && /noteSignatureSubmit\(/.test(text),
    `${route}: verdict beat and submit moment wired`,
  );
}
ok(
  /usePerfectBurst\(scoreRef, score, type\)/.test(read("src/components/duel/AnswerReveal.tsx")),
  "puzzle reveal: perfect burst on the stored score at its game's maximum",
);
ok(
  /usePerfectBurst\(scoreRef, myScore, puzzle\.type\)/.test(read("src/components/duel/ArcadeReveal.tsx")),
  "arcade reveal: perfect burst on the stored score at its game's maximum",
);
const signatureSource = read("src/lib/fx/signature.ts");
ok(
  !/from "@\/lib\/duel\/(grade|scoring|api|registry)/.test(signatureSource),
  "the beat imports no grading, scoring, room or registry code",
);
const gameFiles = (await import("node:fs"))
  .readdirSync("src/puzzles")
  .filter((f) => f.endsWith(".tsx"));
for (const file of gameFiles)
  ok(
    !/playSignature|scheduleSignature|signatureArcadeRunOver/.test(read(`src/puzzles/${file}`)),
    `${file} must not fire the beat itself`,
  );

if (failures.length) {
  console.log(`FAIL: ${failures.length} signature-beat problem(s)`);
  process.exit(1);
}
console.log(
  `PASS: signature beat: solve/fast tiers for puzzles, 120 of 150 (scaled to each game's maximum) for ${NO_FINISH_TYPES.size} no-finish games, arcade finish and open-run rules, 1.0 s delay and 0.6 s length, late verdicts skipped, game-region placement with no taps taken, app-logo asset, reduced motion, shared.* cues, perfect-score burst, and one common firing point`,
);
