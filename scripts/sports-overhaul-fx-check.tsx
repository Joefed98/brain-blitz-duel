/**
 * The Home Run and Top Bins overhaul's effects on #422's kit (stage 2, 15 Nov 2026; docs/design/game-fx/README.md).
 * Happy-dom, no browser, ~3 s. Renders each game's rev-5 reveal picture on a real run (the oracle's, through the
 * stored answer the server replays) and fails unless:
 *  1. every batted ball (Home Run) and every kick that reached the line (Top Bins) is a mark in the markup, and each
 *     mark plays the kit's "drop" once, silent and out of game, in the order the run happened (each later than the one
 *     before), the first after the reveal's own fade;
 *  2. the key numbers are in the markup as their final values (a server render, reduced motion and a screenshot read
 *     the end state) and count up through the kit's count-up, silently (the arcade reveal's score keeps the sound);
 *  3. the kit's plans for those effects carry no haptic, and no kit effect but "drop" plays on the reveal;
 *  4. Home Run's Contact / Power press plays the kit's "tap" on the pressed button (the press registering) and no
 *     haptic.
 *
 *   bun scripts/sports-overhaul-fx-check.tsx
 */
import { Window } from "happy-dom";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

const win = new Window({ url: "https://joulz.uk/" });
for (const key of ["window", "document", "navigator", "HTMLElement", "Element", "Node", "Event", "CustomEvent", "localStorage", "sessionStorage", "location", "getComputedStyle", "requestAnimationFrame", "cancelAnimationFrame"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  const bind = typeof value === "function" && !["HTMLElement", "Element", "Node", "Event", "CustomEvent"].includes(key);
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: bind ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
for (const key of Object.getOwnPropertyNames(win)) {
  if (!/^(HTML|SVG|Mutation|Resize|Text|Comment|Document|Custom|Node|Event)/.test(key) || key in globalThis) continue;
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: (win as unknown as Record<string, unknown>)[key] });
}
const matchMedia = (query: string) => ({ matches: false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
Object.defineProperty(win, "matchMedia", { configurable: true, writable: true, value: matchMedia });
Object.defineProperty(globalThis, "matchMedia", { configurable: true, writable: true, value: matchMedia });

// Element.animate: a recording stand-in on HTML and SVG elements alike (happy-dom draws nothing).
const animated: { el: Element; options: KeyframeAnimationOptions }[] = [];
const fakeAnimation = () => ({ cancel() {}, finish() {}, onfinish: null as null | (() => void), finished: Promise.resolve() });
Object.defineProperty((win as unknown as { Element: { prototype: object } }).Element.prototype, "animate", {
  configurable: true,
  writable: true,
  value(this: Element, _frames: Keyframe[], options: KeyframeAnimationOptions) {
    animated.push({ el: this, options });
    return fakeAnimation();
  },
});
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const React = await import("react");
const { act } = await import("react");
const { createRoot } = await import("react-dom/client");
const K = await import("../src/lib/fx/kit");
const { LAND_FIRST_MS } = await import("../src/components/puzzles/SportsRevealParts");
const { homerunPuzzle } = await import("../src/puzzles/homerun");
const { freekickPuzzle } = await import("../src/puzzles/freekick");
const { homerunGameFor, homerunCheckpoint, HOMERUN_REV_5 } = await import("../src/lib/arcade/homerun");
const { freekickGameFor, freekickCheckpoint, FREEKICK_REV_5 } = await import("../src/lib/arcade/freekick");
const { encodeHomerunRun, replayHomerunRun } = await import("../src/lib/duel/homerun");
const { encodeFreekickRun, freekickKickSummaries, replayFreekickRun } = await import("../src/lib/duel/freekick");
const { HOMERUN_DEAL_V5 } = await import("../src/lib/duel/homerunDealV5.server");
const { FREEKICK_DEAL_V5 } = await import("../src/lib/duel/freekickDealV5.server");
const { oracleRunV5: hrOracle } = await import("./homerun-oracle");
const { oracleRunV5: fkOracle } = await import("./freekick-oracle");
const { HR5_WHIFF, HR5_FOUL } = await import("../src/lib/arcade/homerunInnings");
type ArcadeInputEvent = import("../src/lib/arcade/engine").ArcadeInputEvent;

const records: import("../src/lib/fx/kit").GameFxRecord[] = [];
K.setGameFxSink((r) => records.push(r));

/** A run's stored answer, as the phone sends it (the same path the deal scripts prove). */
function answerOf<S extends { tick: number }>(game: { init(seed: number): S; step(s: S, e: ArcadeInputEvent | null): S; isOver(s: S): boolean; score(s: S): number }, checkpoint: (s: S) => unknown, encode: (r: never) => string, seed: number, events: ArcadeInputEvent[]): string {
  const at = new Map(events.map((e) => [e.t, e]));
  const checkpoints: unknown[] = [];
  let s = game.init(seed);
  while (!game.isOver(s)) {
    s = game.step(s, at.get(s.tick + 1) ?? null);
    if (s.tick % 60 === 0) checkpoints.push(checkpoint(s));
  }
  return encode({ seed, claimedScore: game.score(s), events, endTick: s.tick, checkpoints } as never);
}

async function render(node: React.ReactNode): Promise<{ host: HTMLElement; done: () => void }> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => root.render(node));
  await act(async () => void (await new Promise((r) => setTimeout(r, 20))));
  return { host, done: () => { root.unmount(); host.remove(); } };
}

function landings(host: HTMLElement, label: string, expected: number): void {
  const marks = [...host.querySelectorAll("[data-reveal-mark]")];
  check(marks.length === expected, `${label}: ${expected} marks in the markup (got ${marks.length})`);
  const delays = marks.map((m) => animated.filter((a) => a.el === m).map((a) => Number(a.options.delay ?? 0)));
  check(delays.every((d) => d.length === 1), `${label}: every mark lands exactly once`);
  const first = delays.map((d) => d[0] ?? -1);
  check(first.length === 0 || first[0]! >= LAND_FIRST_MS, `${label}: the first mark lands after the reveal's fade (${first[0]} ms)`);
  check(first.every((d, i) => i === 0 || d > first[i - 1]!), `${label}: the marks land in the order the run happened`);
  const style = marks.every((m) => (m as HTMLElement).style.transformBox === "fill-box");
  check(style, `${label}: every SVG mark transforms about itself (transform-box: fill-box)`);
}

function quiet(label: string, from: number): void {
  const mine = records.slice(from);
  check(mine.length > 0, `${label}: the kit planned the reveal's effects`);
  check(mine.every((r) => r.kind === "drop" || r.kind === "countUp"), `${label}: only the kit's drop and count-up play (${[...new Set(mine.map((r) => r.kind))].join(", ")})`);
  check(mine.every((r) => r.sound === null), `${label}: every reveal effect is silent`);
  check(mine.every((r) => r.haptic === null), `${label}: no reveal effect has a haptic`);
}

/** The stats' final values as the markup states them, and (after the count-up's 600 ms) as the text shows them. */
async function statValues(host: HTMLElement, label: string): Promise<number[]> {
  const els = [...host.querySelectorAll("[data-reveal-stat-value]")];
  const finals = els.map((el) => Number(el.getAttribute("data-reveal-stat-value")));
  await act(async () => void (await new Promise((r) => setTimeout(r, K.KIT_COUNT_UP_MS + 200))));
  check(els.every((el, i) => Number(el.textContent) === finals[i]), `${label}: every count-up lands on its final number (${els.map((e) => e.textContent).join(", ")} for ${finals.join(", ")})`);
  return finals;
}

// 1–3. Home Run: the oracle's innings on Normal's first deal seed, and a weak (random-ish) innings with outs.
for (const level of ["normal", "hard"] as const) {
  const seed = HOMERUN_DEAL_V5[level][0]!;
  const answer = answerOf(homerunGameFor(HOMERUN_REV_5, level), homerunCheckpoint, encodeHomerunRun as never, seed, hrOracle(seed, level));
  const puzzle = { type: "homerun", seed, homerunRev: HOMERUN_REV_5, ...(level === "normal" ? {} : { level }) } as never;
  const inn = replayHomerunRun(seed, answer, HOMERUN_REV_5, level === "normal" ? undefined : level).state.inn!;
  const batted = inn.hits.filter((h) => h.st >= 0 && h.out !== HR5_WHIFF && h.out !== HR5_FOUL).length;
  animated.length = 0;
  const from = records.length;
  const { host, done } = await render(React.createElement(homerunPuzzle.Reveal!, { puzzle, myAnswer: answer, myCorrect: true, myReactionAvgMs: null, myMsRemaining: 0, timeLimitMs: 120_000, myExtra: null } as never));
  check(host.querySelector("[data-homerun-reveal]") !== null, `homerun ${level}: the innings reveal draws`);
  landings(host, `homerun ${level}`, batted);
  const values = await statValues(host, `homerun ${level}`);
  check(values.length === 3 && values[1] === inn.runs, `homerun ${level}: the runs stat holds the final ${inn.runs} in the markup (got ${values.join(", ")})`);
  quiet(`homerun ${level}`, from);
  done();
}

for (const level of ["normal", "expert"] as const) {
  const seed = FREEKICK_DEAL_V5[level][0]!;
  const lv = level === "normal" ? undefined : level;
  const answer = answerOf(freekickGameFor(FREEKICK_REV_5, level), freekickCheckpoint, encodeFreekickRun as never, seed, fkOracle(seed, level));
  const puzzle = { type: "freekick", seed, freekickRev: FREEKICK_REV_5, ...(lv ? { level } : {}) } as never;
  const result = replayFreekickRun(seed, answer, FREEKICK_REV_5, lv);
  const kicks = freekickKickSummaries(seed, answer, FREEKICK_REV_5, lv);
  animated.length = 0;
  const from = records.length;
  const { host, done } = await render(React.createElement(freekickPuzzle.Reveal!, { puzzle, myAnswer: answer, myCorrect: true, myReactionAvgMs: null, myMsRemaining: 0, timeLimitMs: 90_000, myExtra: null } as never));
  check(host.querySelector("[data-freekick-reveal]") !== null, `freekick ${level}: the layered reveal draws`);
  landings(host, `freekick ${level}`, kicks.filter((k) => k.at).length);
  const values = await statValues(host, `freekick ${level}`);
  check(values[0] === result.goals && values[1] === result.best, `freekick ${level}: goals ${result.goals} and best run ${result.best} in the markup (got ${values.join(", ")})`);
  quiet(`freekick ${level}`, from);
  done();
}

// 4. The swing choice's press: rendered through the stage would need the canvas; the call site is checked in source.
const src = (await import("node:fs")).readFileSync(new URL("../src/puzzles/homerun.tsx", import.meta.url), "utf8");
check(/onPressStart=\{\(event\) => \{\s*send\(pick\(m\)\);[\s\S]{0,200}gameFx\("tap", event\.currentTarget\)/.test(src), "homerun: the Contact / Power press sends first, then plays the kit's tap on the pressed button");
const tap = K.planGameFx("tap");
check(tap.haptic === null, "the kit's tap carries no haptic (haptics-check pins the listed sites)");

K.setGameFxSink(null);
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL sports-overhaul-fx-check: ${failures.length} failed, ${passes} passed`);
  process.exit(1);
}
console.log(`PASS sports-overhaul-fx-check: ${passes} checks`);
process.exit(0);
