/**
 * replay-sound-check (18 Oct 2026): puzzle replays on the results screen (and the podium) play no
 * sound effects. Every other sound is untouched: arcade highlights, the replay buttons (Skip,
 * Watch, the full-run player) and the screens' own sounds keep their cues.
 *
 *  1. Every puzzle the time-lapse supports: its real PuzzleTimelapse (the game's own Reveal fed
 *     growing prefixes of a stored move list) is played to its end in happy-dom with React, and
 *     no named cue ("duelz-sound") or played cue ("duelz-cue") may fire.
 *  2. Every moment-card game (Flash, Bang On, Nucleus, Forage): the card mounts and changes
 *     silently.
 *  3. Source scan: PuzzleTimelapse and MomentCardView call no sound function, while the arcade
 *     highlight and the replay buttons still dispatch theirs.
 *
 *   bun scripts/replay-sound-check.tsx
 */
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const win = new Window({ url: "http://localhost/", width: 414, height: 896 });
const g = globalThis as Record<string, unknown>;
for (const key of [
  "window", "document", "navigator", "Node", "Element", "HTMLElement", "HTMLIFrameElement", "SVGElement",
  "Text", "Event", "CustomEvent", "MouseEvent", "PointerEvent", "KeyboardEvent", "FocusEvent", "getComputedStyle",
  "MutationObserver", "ResizeObserver",
]) {
  if (g[key] === undefined) g[key] = key === "window" ? win : (win as unknown as Record<string, unknown>)[key];
}
// Bun has its own Event and CustomEvent, which happy-dom's window refuses to dispatch: use its own.
g["Event"] = (win as unknown as Record<string, unknown>)["Event"];
g["CustomEvent"] = (win as unknown as Record<string, unknown>)["CustomEvent"];
g["IS_REACT_ACT_ENVIRONMENT"] = true;
const originalError = console.error;
console.error = (...args: unknown[]) => {
  if (typeof args[0] === "string" && /not wrapped in act|act\(\.\.\.\)/.test(args[0])) return;
  originalError(...args);
};

const React = await import("react");
const { createRoot } = await import("react-dom/client");
const { act } = React;
const { PuzzleTimelapse, MomentCardView } = await import("../src/components/replay/ReplayPanels");
const { generatePuzzle } = await import("../src/lib/duel/generate.server");
const { planTimelapse, TIMELAPSE } = await import("../src/lib/replay/timelapse");
const { CARD_TYPES } = await import("../src/lib/replay/cards");
const { answerFor } = await import("./replay-timelapse-lib");
type PuzzleData = import("../src/lib/duel/types").PuzzleData;
type PuzzleType = import("../src/lib/duel/types").PuzzleType;

const failures: string[] = [];
let checks = 0;
const check = (cond: boolean, label: string) => {
  checks++;
  if (!cond) failures.push(label);
};

const { replayQuieted } = await import("../src/lib/sound");
// What the sound bridge would play: a named cue it doesn't silence for a replay (and every played cue).
const heard: string[] = [];
const fired: string[] = [];
win.addEventListener("duelz-sound", (event) => {
  const cue = String((event as unknown as CustomEvent).detail?.cue);
  fired.push(cue);
  if (!replayQuieted(cue)) heard.push(cue);
});
win.addEventListener("duelz-cue", (event) => heard.push(String((event as unknown as CustomEvent).detail)));
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/* ------------------------------------------------------------------ 1. time-lapses */

let lapses = 0;
const quietedCues = new Set<string>();
for (const type of Object.keys(TIMELAPSE)) {
  const puzzle = generatePuzzle(type as PuzzleType) as PuzzleData;
  // A short budget, so every frame plays in well under a second.
  const plan = planTimelapse(puzzle, answerFor(type, puzzle), true, 400);
  if (!plan) {
    failures.push(`${type}: no time-lapse plan`);
    continue;
  }
  heard.length = 0;
  let ended = false;
  const container = win.document.createElement("div");
  win.document.body.appendChild(container);
  const root = createRoot(container as unknown as HTMLElement);
  await act(async () => {
    root.render(<PuzzleTimelapse puzzle={puzzle} plan={plan} isCorrect height={300} onEnd={() => (ended = true)} />);
  });
  for (let waited = 0; !ended && waited < 5000; waited += 20) await act(() => sleep(20));
  check(ended, `${type}: the time-lapse never reached its end`);
  await act(async () => root.unmount());
  container.remove();
  check(heard.length === 0, `${type}: the time-lapse played sound (${[...new Set(heard)].join(", ")})`);
  if (fired.length) quietedCues.add(`${type}: ${[...new Set(fired)].join(", ")}`);
  fired.length = 0;
  lapses++;
}

// Once the time-lapses are gone, game cues play again; shared, room and UI cues never stop.
check(!replayQuieted("rings.turn"), "a game cue stays silenced after the time-lapse closed");

/* ------------------------------------------------------------------ 2. moment cards */

for (const game of CARD_TYPES) {
  heard.length = 0;
  const container = win.document.createElement("div");
  const root = createRoot(container as unknown as HTMLElement);
  const card = (value: string) => ({ game, id: "best", weight: 1, title: "Best", value, detail: "a detail" });
  await act(async () => root.render(<MomentCardView card={card("187 ms")} />));
  await act(async () => root.render(<MomentCardView card={card("150 ms")} />));
  await act(async () => root.unmount());
  check(heard.length === 0, `${game}: the moment card played sound (${heard.join(", ")})`);
}

/* ------------------------------------------------------------------ 3. source scan */

const panels = readFileSync("src/components/replay/ReplayPanels.tsx", "utf8");
const body = (name: string) => {
  const start = panels.indexOf(`export function ${name}(`);
  const next = panels.indexOf("\nexport function ", start + 1);
  return start < 0 ? "" : panels.slice(start, next < 0 ? undefined : next);
};
const SOUND = /soundCue|playSound|playCue|playSlot|ensureLoop|playVoice|SHARED_CUES/;
for (const name of ["PuzzleTimelapse", "MomentCardView"]) {
  const src = body(name);
  check(src.length > 0, `${name} not found in ReplayPanels.tsx`);
  check(!SOUND.test(src), `${name} calls a sound function`);
}
const highlight = readFileSync("src/components/replay/RoundHighlight.tsx", "utf8");
check(/soundCue\(SHARED_CUES\.highlightStart\)/.test(highlight), "the arcade highlight lost its start cue");
check(/soundCue\(SHARED_CUES\.highlightSkip\)/.test(highlight), "Skip lost its tap cue");
check(/soundCue\(SHARED_CUES\.replayOpen\)/.test(panels), "the full-run player lost its open cue");
check(/soundCue\(SHARED_CUES\.highlightClip\)/.test(readFileSync("src/components/replay/ReplayCanvas.tsx", "utf8")), "arcade clips lost their cue");

{
  const { quietForReplay } = await import("../src/lib/sound");
  quietForReplay(true);
  for (const cue of ["shared.highlight.skip", "room.award", "ui.tap"]) check(!replayQuieted(cue), `${cue} is silenced during a replay`);
  check(replayQuieted("rings.turn"), "a game cue plays during a replay");
  quietForReplay(false);
}

console.log(`${lapses} time-lapses and ${CARD_TYPES.length} moment cards played silently`);
if (quietedCues.size) console.log(`board cues silenced: ${[...quietedCues].join("; ")}`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${checks} checks`);
  for (const failure of failures) console.log(`  - ${failure}`);
  process.exit(1);
}
console.log(`PASS: ${checks} checks`);
process.exit(0);
