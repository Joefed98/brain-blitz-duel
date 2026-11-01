/**
 * haptics-check (31 Oct 2026, presentation only): haptics on the main moments only
 * (src/lib/haptics.ts), with navigator.vibrate mocked in happy-dom.
 *
 *  1. The helper: six named patterns; the web Vibration API adapter plays them; a native adapter
 *     (Capacitor later) takes the same names with no call site changed.
 *  2. Each listed moment fires its pattern through the real code: the countdown (RoundIntro: tick on
 *     3, 2, 1 and go on GO), a puzzle's correct and wrong answers (usePuzzleHaptics on the shared
 *     signals) and its completion (useSignatureVerdict), the arcade moments (the sound observers: a
 *     goal, a home run, a pot, a foul, a life lost, a crash; arcadeFeedback: the buzzer) and the
 *     podium (Podium and the two-player FinalResult, for the winner only).
 *  3. Nothing fires on button taps (every button of Settings, the podium and the intro), on
 *     routine signals (a placement, a move), in an intro demo, a replay, an answer reveal or with no
 *     live board on screen; no vibrate call exists outside the helper, and haptic() is called only
 *     from the listed call sites (CALL_SITES).
 *  4. The setting: "Haptics" in Settings, on by default, saved on the device; off stops everything;
 *     on an unsupported device the switch shows "Not supported on this device" and nothing calls.
 *
 *   bun scripts/haptics-check.tsx
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { Window } from "happy-dom";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

/* ------------------------------------------------------------ happy-dom with a mocked vibrate */

const win = new Window({ url: "https://brain-blitz-duel.lovable.app/" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "localStorage", "sessionStorage", "location", "getComputedStyle", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  const bind = typeof value === "function" && !["HTMLElement", "Element", "Node", "Event", "CustomEvent"].includes(key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
// The DOM classes components test against (HTMLFormElement, SVGElement, ResizeObserver…).
for (const key of Object.getOwnPropertyNames(win)) {
  if (!/^(HTML|SVG|Mutation|Resize|Intersection|Keyboard|Pointer|Mouse|Focus|Touch|DOM|Text|Comment|Document|Shadow|Custom|Animation|Node|Range|Selection|Tree|Event)/.test(key) || key in globalThis) continue;
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (win as unknown as Record<string, unknown>)[key] });
}
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
// Timer-driven count-ups and the router's absence are not what this check is about.
const consoleError = console.error;
console.error = (...args: unknown[]) => {
  const text = String(args[0] ?? "");
  if (/not wrapped in act|useRouter must be used/.test(text)) return;
  consoleError(...args);
};
const consoleWarn = console.warn;
console.warn = (...args: unknown[]) => {
  if (/useRouter must be used/.test(String(args[0] ?? ""))) return;
  consoleWarn(...args);
};
let calls: (number | number[])[] = [];
const vibrate = (p: number | number[]) => {
  calls.push(p);
  return true;
};
const supportVibrate = (on: boolean) => {
  if (on) Object.defineProperty(win.navigator, "vibrate", { configurable: true, writable: true, value: vibrate });
  else delete (win.navigator as unknown as { vibrate?: unknown }).vibrate;
};
supportVibrate(true);

const H = await import("../src/lib/haptics");
const sound = await import("../src/lib/sound");
const fxMod = await import("../src/lib/fx");
const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The next calls only: clears the record, the setting cache and the gaps. */
const fresh = () => {
  calls = [];
  H.resetHapticsForTest();
};
const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
const sorted = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).sort(([a], [b]) => a.localeCompare(b)));
const pat = (name: keyof typeof H.HAPTIC_PATTERNS) => {
  const p = H.HAPTIC_PATTERNS[name];
  return typeof p === "number" ? p : [...p];
};

/** A live board on screen (GameLayout's `[data-game-stage]`), as in a round. */
const stage = document.createElement("div");
stage.setAttribute("data-game-stage", "");
const showBoard = (on: boolean) => {
  if (on) document.body.appendChild(stage);
  else stage.remove();
};

/* ------------------------------------------------------------ 1. the helper */

check(same(Object.keys(H.HAPTIC_PATTERNS).sort(), ["celebrate", "error", "go", "impact", "success", "tick"]), "the six named patterns");
for (const name of Object.keys(H.HAPTIC_PATTERNS) as (keyof typeof H.HAPTIC_PATTERNS)[]) {
  fresh();
  check(H.haptic(name) && same(calls, [pat(name)]), `${name} plays its pattern through navigator.vibrate (${JSON.stringify(calls)})`);
}
{
  const error = H.HAPTIC_PATTERNS.error;
  check(Array.isArray(error) && error.length === 3, "error is a soft double");
  const tick = H.HAPTIC_PATTERNS.tick as number;
  const go = H.HAPTIC_PATTERNS.go as number;
  check(typeof tick === "number" && typeof go === "number" && go > tick, "go is firmer than tick");
}
// A native adapter takes the same names; the web API is not touched while it is in.
{
  fresh();
  const native: string[] = [];
  H.setHapticsAdapter({ supported: () => true, play: (p) => native.push(p) });
  H.haptic("impact");
  check(same(native, ["impact"]) && calls.length === 0, "a native adapter plays the named pattern instead of the web API");
  H.setHapticsAdapter(null);
  H.resetHapticsForTest();
  H.haptic("tick");
  check(same(calls, [pat("tick")]), "null restores the web adapter");
}
// Two moments in the same instant play once (a life lost that ends the run).
fresh();
H.haptic("impact");
H.haptic("impact");
check(calls.length === 1, "two moments within the gap play once");

/* ------------------------------------------------------------ 4. the setting (first: everything after runs on) */

fresh();
check(H.hapticsOn() && localStorage.getItem(H.HAPTICS_KEY) === null, "on by default");
H.setHapticsOn(false);
check(localStorage.getItem(H.HAPTICS_KEY) === "0", "off is saved on the device");
H.resetHapticsForTest(); // a fresh visit reads the saved choice
check(!H.hapticsOn(), "off is read back on the next visit");
for (const name of Object.keys(H.HAPTIC_PATTERNS) as (keyof typeof H.HAPTIC_PATTERNS)[]) H.haptic(name);
showBoard(true);
H.haptic("success", { inGame: true });
showBoard(false);
check(calls.length === 0, `the setting off stops everything (${calls.length} calls)`);
H.setHapticsOn(true);
check(localStorage.getItem(H.HAPTICS_KEY) === null && H.hapticsOn(), "on again");

// Unsupported (iPhone Safari: no navigator.vibrate): no calls, no throw, the switch shows the note.
{
  fresh();
  supportVibrate(false);
  let threw = false;
  let played = true;
  try {
    played = H.haptic("celebrate");
  } catch {
    threw = true;
  }
  check(!H.hapticsSupported() && !played && !threw, "an unsupported device makes no call and never throws");
  // An adapter that says unsupported is never asked to play.
  let asked = 0;
  H.setHapticsAdapter({ supported: () => false, play: () => asked++ });
  H.haptic("go");
  check(asked === 0, "an unsupported adapter is never asked to play");
  H.setHapticsAdapter(null);
  supportVibrate(true);
}

/* ------------------------------------------------------------ a React host */

const host = document.createElement("div");
document.body.appendChild(host);
let root = createRoot(host as unknown as HTMLElement);
const draw = async (el: React.ReactElement) => {
  await act(async () => {
    root.render(el);
  });
};
const clear = async () => {
  await act(async () => root.unmount());
  root = createRoot(host as unknown as HTMLElement);
};
const clickAll = async (selector: string, skip: (b: Element) => boolean = () => false) => {
  let n = 0;
  for (const b of Array.from(document.querySelectorAll(selector))) {
    if (skip(b)) continue;
    await act(async () => {
      (b as unknown as HTMLElement).click();
    });
    n++;
    await sleep(H.HAPTIC_GAP_MS + 10);
  }
  return n;
};

/* ------------------------------------------------------------ 4b. the Settings switch */

const { SettingsSheet } = await import("../src/components/app/SettingsSheet");
fresh();
await draw(<SettingsSheet onClose={() => undefined} onHowItWorks={() => undefined} />);
const hapticsRow = () => document.querySelector("[data-setting='haptics']");
check(hapticsRow()?.getAttribute("role") === "switch" && hapticsRow()?.getAttribute("aria-checked") === "true", "Settings has a Haptics switch, on");
check(!hapticsRow()?.querySelector("[data-setting-note]"), "no note where haptics are supported");
// 3: every button tap in Settings (but the Haptics switch) vibrates nothing.
const settingTaps = await clickAll("[data-settings-sheet] button", (b) => b === hapticsRow());
check(settingTaps >= 4 && calls.length === 0, `Settings' ${settingTaps} button taps made ${calls.length} haptic calls`);
await act(async () => (hapticsRow() as unknown as HTMLElement).click());
check(hapticsRow()?.getAttribute("aria-checked") === "false" && !H.hapticsOn() && localStorage.getItem(H.HAPTICS_KEY) === "0", "the switch turns haptics off and saves it");
await act(async () => (hapticsRow() as unknown as HTMLElement).click());
check(H.hapticsOn() && calls.length === 0, "the switch turns haptics back on (and taps it silently)");
await clear();
supportVibrate(false);
H.resetHapticsForTest();
await draw(<SettingsSheet onClose={() => undefined} onHowItWorks={() => undefined} />);
check(!!hapticsRow() && hapticsRow()?.querySelector("[data-setting-note]")?.textContent === "Not supported on this device", "unsupported: the switch is shown with its note");
await clear();
supportVibrate(true);
document.querySelectorAll("[data-settings-sheet]").forEach((n) => n.closest("[data-skin]")?.remove());

/* ------------------------------------------------------------ 2a. the countdown */

const { RoundIntro } = await import("../src/components/duel/RoundIntro");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const queries = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const { INTRO_MS } = await import("../src/lib/duel/types");
{
  fresh();
  const startedAt = Date.now();
  const intro = (now: number) => (
    <QueryClientProvider client={queries}>
      <RoundIntro round={1} type="sudoku" startedAt={startedAt} now={now} outcomes={[]} practice onReady={() => undefined} />
    </QueryClientProvider>
  );
  // Before the countdown: Ready and Back taps are buttons, never haptics.
  await draw(intro(startedAt + 1000));
  const introTaps = await clickAll("button");
  check(introTaps >= 1 && calls.length === 0, `the intro's ${introTaps} button taps made ${calls.length} haptic calls`);
  fresh();
  // 3, 2, 1 (a second apart, as the shared clock ticks), then GO from the intro's own timer.
  const at3 = startedAt + INTRO_MS - 2400;
  await draw(intro(at3));
  await sleep(250);
  await draw(intro(at3 + 1000));
  await sleep(250);
  await draw(intro(at3 + 2000));
  check(same(calls, [pat("tick"), pat("tick"), pat("tick")]), `tick on 3, 2, 1 (${JSON.stringify(calls)})`);
  // GO lands INTRO_MS after startedAt (2.4 s after "3" on the intro's own clock).
  await sleep(2600);
  check(same(calls, [pat("tick"), pat("tick"), pat("tick"), pat("go")]), `go on GO (${JSON.stringify(calls)})`);
  await clear();
  // Setting off: a whole countdown is silent.
  fresh();
  H.setHapticsOn(false);
  await draw(intro(Date.now() - INTRO_MS + 2400));
  await sleep(250);
  await clear();
  check(calls.length === 0, "the countdown with the setting off");
  H.setHapticsOn(true);
}

/* ------------------------------------------------------------ 2b. puzzles: correct, wrong, completion */

const { usePuzzleHaptics } = await import("../src/components/puzzles/usePuzzleHaptics");
function PuzzleScreen({ board }: { board: boolean }) {
  const ref = React.useRef<HTMLDivElement>(null);
  usePuzzleHaptics(ref, true);
  return <div ref={ref}>{board ? <div data-game-stage /> : <div data-answer-reveal />}</div>;
}
const gap = () => sleep(H.SUCCESS_GAP_MS + 20);
{
  await draw(<PuzzleScreen board />);
  fresh();
  fxMod.fx.onCorrect();
  check(same(calls, [pat("success")]), `a correct answer (fx.onCorrect) gives success (${JSON.stringify(calls)})`);
  fresh();
  fxMod.fx.onWrong();
  check(same(calls, [pat("error")]), `a wrong answer (fx.onWrong) gives error (${JSON.stringify(calls)})`);
  fresh();
  sound.playCue("wrong");
  check(same(calls, [pat("error")]), `the "wrong" cue gives error (${JSON.stringify(calls)})`);
  fresh();
  sound.playCue("correct");
  check(same(calls, [pat("success")]), `the "correct" cue gives success (${JSON.stringify(calls)})`);
  fresh();
  fxMod.fx.onStageComplete();
  check(same(calls, [pat("success")]), `a solved stage gives success (${JSON.stringify(calls)})`);
  // Routine signals: placements, moves, ticks, a refused move.
  fresh();
  fxMod.fx.onPlace();
  await sleep(80);
  fxMod.fx.onMove();
  await sleep(80);
  sound.playCue("tick");
  await sleep(80);
  sound.playCue("lock");
  const { puzzleReject } = await import("../src/lib/fx/puzzleReject");
  puzzleReject(document.querySelector("[data-game-stage]"));
  check(calls.length === 0, `routine puzzle signals made ${calls.length} haptic calls`);
  // An intro demo (hushed) and a replay on screen: nothing.
  fresh();
  sound.hushForDemo(true);
  fxMod.fx.onCorrect();
  fxMod.fx.onWrong();
  sound.hushForDemo(false);
  sound.quietForReplay(true);
  fxMod.fx.onCorrect();
  await sleep(80);
  sound.playCue("wrong");
  sound.quietForReplay(false);
  check(calls.length === 0, `an intro demo or a replay made ${calls.length} haptic calls`);
  // An answer reveal holds them (AnswerReveal's verdict cues: fx.onCorrect / fx.onWrong).
  fresh();
  const release = H.holdHaptics();
  fxMod.fx.onCorrect();
  await sleep(80);
  fxMod.fx.onWrong();
  release();
  check(calls.length === 0, `under an answer reveal ${calls.length} haptic calls`);
  // No live board (the reveal screen's own verdict): nothing.
  await draw(<PuzzleScreen board={false} />);
  fresh();
  fxMod.fx.onCorrect();
  await sleep(80);
  fxMod.fx.onWrong();
  check(calls.length === 0, `with no live board ${calls.length} haptic calls`);
  await clear();
}
// Completion: the verdict, timed from this phone's own submit, while the board is still up.
{
  const { useSignatureVerdict } = await import("../src/lib/fx/useSignature");
  const { noteSignatureSubmit } = await import("../src/lib/fx/signature");
  type Verdict = Parameters<typeof useSignatureVerdict>[1];
  function Verdicted({ k, verdict }: { k: string; verdict: Verdict }) {
    useSignatureVerdict(k, verdict);
    return <div data-game-stage />;
  }
  const solved = { type: "sudoku", arcade: false, correct: true, score: 160, msRemaining: 40_000, timeLimitMs: 90_000 } as Verdict;
  fresh();
  noteSignatureSubmit("sudoku");
  await draw(<Verdicted k="r1" verdict={solved} />);
  check(same(calls, [pat("success")]), `a completed puzzle gives success (${JSON.stringify(calls)})`);
  await clear();
  await gap();
  fresh();
  noteSignatureSubmit("sudoku");
  await draw(<Verdicted k="r2" verdict={{ ...solved!, correct: false, score: 40 }} />);
  check(calls.length === 0, "an unfinished puzzle's verdict gives nothing");
  await clear();
  fresh();
  await draw(<Verdicted k="r3" verdict={{ ...solved!, type: "nonogram" }} />);
  check(calls.length === 0, "a verdict with no submit on this phone (a reload) gives nothing");
  await clear();
  fresh();
  noteSignatureSubmit("hover");
  await draw(<Verdicted k="r4" verdict={{ ...solved!, type: "hover", arcade: true }} />);
  check(calls.length === 0, "an arcade verdict gives nothing (its own moments and the buzzer do)");
  await clear();
}

/* ------------------------------------------------------------ 2c. arcade moments */

const GS = await import("../src/lib/fx/gameSounds");
const { arcadeFeedback } = await import("../src/lib/fx/arcade");
const FK = await import("../src/lib/arcade/freekick");
const HR = await import("../src/lib/arcade/homerun");
const POOL = await import("../src/lib/arcade/pool");

/** Plays two frames of an observer (prev, next) on a live board; returns the calls. */
const observe = async <S,>(make: () => { frame: (s: S, running: boolean) => void; stop: () => void }, prev: S, next: S, board = true) => {
  fresh();
  showBoard(board);
  const o = make();
  o.frame(prev, true);
  o.frame(next, true);
  o.stop();
  showBoard(false);
  const out = calls;
  await sleep(H.HAPTIC_GAP_MS + 10);
  return out;
};
const any = <T,>(v: unknown) => v as T;

// Top Bins: a goal.
{
  const shot = (out: number) => ({ out, z: 0, post: false, bar: false });
  const prev = any<Parameters<ReturnType<typeof GS.freekickSounds>["frame"]>[0]>({ tick: 100, phase: FK.FK_FLIGHT, kickTick: 90, fl: shot(0), targets: 0 });
  const goal = { ...prev, tick: 101, fl: shot(FK.FK_OUT_GOAL) };
  check(same(await observe(GS.freekickSounds, prev, goal), [pat("success")]), "a goal (Top Bins) gives success");
  check((await observe(GS.freekickSounds, prev, { ...prev, tick: 101, fl: shot(FK.FK_OUT_SAVED) })).length === 0, "a save gives nothing");
  check((await observe(GS.freekickSounds, prev, { ...prev, tick: 101, fl: shot(FK.FK_OUT_WALL) })).length === 0, "a wall hit gives nothing");
  check((await observe(GS.freekickSounds, prev, goal, false)).length === 0, "a goal with no live board (a demo or replay) gives nothing");
}
// Home Run: a home run.
{
  const base = HR.homerunInit(1);
  const hit = (out: number) => ({ out, q: 950, sign: -1, feet: 300, spray: 0 });
  const prev = { ...base, tick: 200 };
  const homer = { ...base, tick: 201, hits: [...base.hits, any<(typeof base.hits)[number]>(hit(HR.OUT_HOMER))] };
  check(same(await observe(GS.homerunSounds, prev, homer), [pat("success")]), "a home run gives success");
  const fair = { ...base, tick: 201, hits: [...base.hits, any<(typeof base.hits)[number]>(hit(HR.OUT_FAIR))] };
  check((await observe(GS.homerunSounds, prev, fair)).length === 0, "an ordinary hit gives nothing");
}
// Cue Ball: a pot (both revisions), a foul, the cue ball's scratch.
{
  const balls = (downAt?: number) => [{ x: 0, y: 0, vx: 0, vy: 0 }, { x: 0, y: 0, vx: 0, vy: 0, ...(downAt === undefined ? {} : { downAt }) }];
  const v1 = any<Parameters<ReturnType<typeof GS.poolSounds>["frame"]>[0]>({ rev: 1, tick: 300, phase: POOL.POOL_ROLL, balls: balls(), hits: 0, cushionTick: 0, pots: 0, scratches: 0, fouls: 0, black: 0 });
  check(same(await observe(GS.poolSounds, v1, { ...v1, tick: 301, pots: 1 }), [pat("success")]), "a pot gives success (poolRev 1)");
  check(same(await observe(GS.poolSounds, v1, { ...v1, tick: 301, fouls: 1 }), [pat("error")]), "a foul gives error");
  check((await observe(GS.poolSounds, v1, { ...v1, tick: 301, hits: 1, cushionTick: 301 })).length === 0, "ball-on-ball and cushions give nothing");
  const { POOL_DROP_MOUTH_TICKS } = await import("../src/lib/arcade/pool.renderer");
  const v2 = { ...v1, rev: 2, balls: balls(300 - POOL_DROP_MOUTH_TICKS + 1) };
  check(same(await observe(GS.poolSounds, v2, { ...v2, tick: 301 }), [pat("success")]), "a pot gives success (poolRev 2, as it reaches the mouth)");
  const scratch = { ...v1, rev: 2, balls: [{ ...balls()[0]!, downAt: 300 - POOL_DROP_MOUTH_TICKS + 1 }, balls()[1]!] };
  check((await observe(GS.poolSounds, scratch, { ...scratch, tick: 301 })).length === 0, "the cue ball's own drop is no pot");
}
// A life lost and a crash.
{
  const cross = any<Parameters<ReturnType<typeof GS.crossSounds>["frame"]>[0]>({ tick: 50, lives: 3, dead: false, score: 0, row: 0, hops: 0, best: 0, crossings: 0 });
  check(same(await observe(GS.crossSounds, cross, { ...cross, tick: 51, lives: 2 }), [pat("impact")]), "a life lost (Jaywalk) gives impact");
  const flip = any<Parameters<ReturnType<typeof GS.flipSounds>["frame"]>[0]>({ tick: 50, ended: 0 });
  check(same(await observe(GS.flipSounds, flip, { ...flip, tick: 51, ended: 2 }), [pat("impact")]), "a crash (Roofbound) gives impact");
}
// The arcade round's buzzer (arcadeFeedback at the run's end), once.
{
  fresh();
  showBoard(true);
  const feed = arcadeFeedback({ game: "hover" });
  feed({ tick: 10 }, false);
  check(calls.length === 0, "a running arcade frame gives nothing");
  feed({ tick: 11 }, true);
  feed({ tick: 12 }, true);
  check(same(calls, [pat("impact")]), `the buzzer gives impact once (${JSON.stringify(calls)})`);
  showBoard(false);
  await sleep(H.HAPTIC_GAP_MS + 10);
  fresh();
  arcadeFeedback({ game: "hover" })({ tick: 11 }, true);
  check(calls.length === 0, "the buzzer with no live board (a reveal's replay) gives nothing");
  fresh();
  showBoard(true);
  sound.hushForDemo(true);
  arcadeFeedback({ game: "hover" })({ tick: 11 }, true);
  sound.hushForDemo(false);
  showBoard(false);
  check(calls.length === 0, "the buzzer in an intro demo gives nothing");
}

/* ------------------------------------------------------------ 2d. the podium */

const { Podium } = await import("../src/components/duel/Podium");
const { FinalResult } = await import("../src/components/duel/FinalResult");
const standings = [1, 2, 3].map((slot) => ({
  slot,
  name: ["Ana", "Bo", "Cy"][slot - 1]!,
  status: "active",
  total: 300 - slot * 20,
  roundScore: 150 - slot * 20,
  roundCorrect: true,
  answerMs: 20_000,
  position: slot,
  previousPosition: null,
  summary: "",
  detail: [],
}));
const podium = (mySlot: number) => (
  <Podium rows={standings as never} mySlot={mySlot} results={[]} roundOrder={["hover"]} isHost busy={false} onPlayAgain={() => undefined} onLeave={() => undefined} />
);
{
  fresh();
  await draw(podium(1));
  check(same(calls, [pat("celebrate")]), `the podium celebrates for the winner (${JSON.stringify(calls)})`);
  await clear();
  fresh();
  await draw(podium(2));
  check(calls.length === 0, "no podium haptic for anyone else");
  const podiumTaps = await clickAll("button");
  check(podiumTaps >= 1 && calls.length === 0, `the podium's ${podiumTaps} button taps made ${calls.length} haptic calls`);
  await clear();
  const final = (outcome: "win" | "loss" | "draw") => (
    <FinalResult outcome={outcome} myName="Ana" opponentName="Bo" myTotal={500} opponentTotal={400} breakdown={[{ round: 1, mine: 100, theirs: 80 }]} roundOrder={["hover"]} busy={false} onPlayAgain={() => undefined} isHost onHome={() => undefined} />
  );
  fresh();
  await draw(final("win"));
  check(same(calls, [pat("celebrate")]), "the two-player final celebrates for the winner");
  await clear();
  for (const outcome of ["loss", "draw"] as const) {
    fresh();
    await draw(final(outcome));
    check(calls.length === 0, `no final haptic on a ${outcome}`);
    await clear();
  }
}

/* ------------------------------------------------------------ 3. the call sites, from the source */

const SRC = join(import.meta.dir, "..", "src");
const files: string[] = [];
const walk = (dir: string) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(name)) files.push(p);
  }
};
walk(SRC);
/** Every haptic() call outside the helper, by file and pattern (the PR lists them). */
const CALL_SITES: Record<string, Record<string, number>> = {
  "components/duel/RoundIntro.tsx": { tick: 1, go: 1 },
  "components/puzzles/usePuzzleHaptics.ts": { "pattern": 1 },
  "lib/fx/useSignature.ts": { success: 1 },
  "lib/fx/arcade.ts": { impact: 1 },
  "lib/fx/gameSounds.ts": { pattern: 1 },
  "puzzles/chainTap.tsx": { error: 1 },
  "puzzles/dual.tsx": { impact: 1 },
  "puzzles/swerve.tsx": { impact: 1 },
  "puzzles/ricochet.tsx": { impact: 1 },
  "components/duel/Podium.tsx": { celebrate: 1 },
  "components/duel/FinalResult.tsx": { celebrate: 1 },
  "components/duel/RoomChat.tsx": { tick: 1 },
};
/** gameSounds' feel() calls: the arcade moments (success: goal, home run, pot x2; error: foul; impact: lives and crashes). */
const FEEL = { success: 4, error: 1, impact: 17 };
const found: Record<string, Record<string, number>> = {};
for (const file of files) {
  const rel = file.slice(SRC.length + 1);
  const text = readFileSync(file, "utf8");
  if (rel !== "lib/haptics.ts") {
    check(!/navigator\s*\.\s*vibrate/.test(text), `${rel}: calls navigator.vibrate outside lib/haptics.ts`);
    check(!/\bbuzz\(|hapticTick\(/.test(text), `${rel}: an old ad-hoc haptic (buzz / hapticTick)`);
  }
  if (rel === "lib/haptics.ts") continue;
  for (const m of text.matchAll(/\bhaptic\(\s*("(\w+)"|(\w+))/g)) {
    const key = m[2] ?? m[3]!;
    (found[rel] ??= {})[key] = (found[rel]![key] ?? 0) + 1;
  }
}
check(same(Object.keys(found).sort(), Object.keys(CALL_SITES).sort()), `haptic() call sites: ${JSON.stringify(Object.keys(found).sort())}`);
for (const [rel, want] of Object.entries(CALL_SITES)) check(same(sorted(found[rel] ?? {}), sorted(want)), `${rel}: haptic() calls ${JSON.stringify(found[rel])}, expected ${JSON.stringify(want)}`);
{
  const text = readFileSync(join(SRC, "lib/fx/gameSounds.ts"), "utf8");
  const feel: Record<string, number> = {};
  for (const m of text.matchAll(/\bfeel\("(\w+)"\)/g)) feel[m[1]!] = (feel[m[1]!] ?? 0) + 1;
  check(same(sorted(feel), sorted(FEEL)), `gameSounds' feel() moments ${JSON.stringify(feel)}, expected ${JSON.stringify(FEEL)}`);
  // Every in-game call is gated (no demo, replay, reveal or missing board).
  check(/haptic\(pattern, \{ inGame: true \}\)/.test(text), "gameSounds' moments use the in-game gate");
}
for (const rel of ["lib/fx/arcade.ts", "lib/fx/useSignature.ts", "puzzles/chainTap.tsx", "puzzles/dual.tsx", "puzzles/swerve.tsx", "puzzles/ricochet.tsx", "components/puzzles/usePuzzleHaptics.ts"])
  check(/inGame: true/.test(readFileSync(join(SRC, rel), "utf8")), `${rel}: an in-game moment without the in-game gate`);
// Wiring: PhoneShell mounts the puzzle listener on puzzle screens only; AnswerReveal holds haptics.
{
  const shell = readFileSync(join(SRC, "components/duel/PhoneShell.tsx"), "utf8");
  check(/usePuzzleHaptics\(surfaceRef, Boolean\(gameScreen && definition && !definition\.arcadeRun && definition\.category !== "arcade"\)\)/.test(shell), "PhoneShell mounts usePuzzleHaptics on puzzle game screens");
  const reveal = readFileSync(join(SRC, "components/duel/AnswerReveal.tsx"), "utf8");
  check(/holdHaptics\(\)/.test(reveal), "AnswerReveal holds haptics while it is up");
}

/* ------------------------------------------------------------ report */

await clear();
if (failures.length) {
  console.log(`haptics-check: FAIL (${failures.length} of ${passes + failures.length})`);
  for (const f of failures) console.log(`  FAIL ${f}`);
  process.exit(1);
}
console.log(`haptics-check: PASS (${passes} checks)`);
process.exit(0);
