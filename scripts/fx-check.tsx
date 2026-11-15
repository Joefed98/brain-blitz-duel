/**
 * The games effects kit (phase 2 step 4, 15 Nov 2026; src/lib/fx/kit.ts, docs/design/game-fx/README.md). Happy-dom,
 * no browser, ~2 s. Fails unless:
 *  1. every kind (tap, pick up, drop, slide, pour, match, wrong, combo, count-up, near miss, win, new best, stars)
 *     has a full, a lite and a reduced variant, each a non-empty keyframe list with a length; the lite one no longer
 *     than the full one; the reduced one has no movement (opacity only) and lasts at most 160 ms;
 *  2. no keyframe animates anything but transform and opacity, and transforms use only translate, scale and rotate;
 *     the kit's stylesheet, its React pieces, the arena panel and the result screens it touched animate no layout
 *     property (no width, height, top, left, margin or padding transition or keyframe; no `transition-[width]`);
 *  3. every kind has a sound hook: a shared slot of the manifest on the effects channel, played through playSound
 *     (so the player's effects volume, mute, the demo hush and the replay quiet hold); haptics only through
 *     haptic(); no AudioContext or navigator.vibrate of its own;
 *  4. the variants follow the settings: reduced motion gives "reduced" (no particles), the battery saver gives "lite"
 *     (at most a third of the particles), the celebrations switch off gives payoff kinds "calm" (no particles) and
 *     leaves the others as they were; a forced variant (the showcase) is honoured;
 *  5. combos escalate (bigger pop, higher tone a step a count) and stop growing at the cap;
 *  6. in the page: a call animates the element with the planned frames, keeps at most 32 particles alive, plays
 *     nothing in an intro demo (the hush), and the count-up writes its final number (at once under reduced motion);
 *  7. the React pieces render their final state in the markup (the score, the stars earned, the new-best badge).
 *
 *   bun scripts/fx-check.tsx
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
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

// Reduced motion on demand.
let reducedMotion = false;
const matchMedia = (query: string) => ({ matches: query.includes("prefers-reduced-motion") ? reducedMotion : false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
Object.defineProperty(win, "matchMedia", { configurable: true, writable: true, value: matchMedia });
Object.defineProperty(globalThis, "matchMedia", { configurable: true, writable: true, value: matchMedia });

// Element.animate: a recording stand-in (happy-dom draws nothing).
const animated: { el: Element; frames: Keyframe[]; options: KeyframeAnimationOptions }[] = [];
const fakeAnimation = () => ({ cancel() {}, finish() {}, onfinish: null as null | (() => void), finished: Promise.resolve() });
Object.defineProperty((win as unknown as { HTMLElement: { prototype: object } }).HTMLElement.prototype, "animate", {
  configurable: true,
  writable: true,
  value(this: Element, frames: Keyframe[], options: KeyframeAnimationOptions) {
    animated.push({ el: this, frames, options });
    return fakeAnimation();
  },
});
const setBeta = (on: boolean) => ((win as unknown as Record<string, unknown>)["__DUELZ_BETA_CONFIG__"] = { FX_CELEBRATIONS: on });
setBeta(true);

const K = await import("../src/lib/fx/kit");
const { SOUND_MANIFEST } = await import("../src/lib/fx/manifest");
const battery = await import("../src/lib/battery");
const sound = await import("../src/lib/sound");
const { HAPTIC_PATTERNS } = await import("../src/lib/haptics");

const ALLOWED_KEYS = new Set(["transform", "opacity", "offset", "easing"]);
const LAYOUT = /\b(width|height|top|left|right|bottom|margin|padding|inset)\b/;

/* ------------------------------------------------------------------ 1–3. the table */

const EXPECTED: string[] = ["tap", "pickUp", "drop", "slide", "pour", "match", "wrong", "combo", "countUp", "nearMiss", "win", "newBest", "stars"];
check(JSON.stringify([...K.GAME_FX_KINDS].sort()) === JSON.stringify([...EXPECTED].sort()), `the kit's kinds ${JSON.stringify(K.GAME_FX_KINDS)}`);
for (const kind of K.GAME_FX_KINDS) {
  const spec = K.GAME_FX[kind];
  for (const v of ["full", "lite", "reduced"] as const) {
    check(spec.frames[v].length >= 2 && spec.ms[v] > 0, `${kind}: a ${v} variant with frames and a length`);
    for (const f of spec.frames[v]) {
      for (const k of Object.keys(f)) check(ALLOWED_KEYS.has(k), `${kind} ${v}: animates "${k}" (transform and opacity only)`);
    }
  }
  // The transforms as played (per-call values written in): only translate, scale and rotate.
  for (const v of ["full", "lite", "reduced"] as const) {
    K.forceGameFxVariant(v);
    for (const f of K.planGameFx(kind, { from: { x: 5, y: -5 }, tilt: -30, count: 3 }).frames)
      if (f.transform) check(/^(\s*(translate|translateX|translateY|scale|rotate)\([-\d., a-z%]*\))+\s*$/.test(f.transform), `${kind} ${v}: transform "${f.transform}" uses only translate, scale and rotate`);
  }
  K.forceGameFxVariant(null);
  check(spec.ms.lite <= spec.ms.full, `${kind}: lite (${spec.ms.lite} ms) no longer than full (${spec.ms.full} ms)`);
  check(spec.frames.reduced.every((f) => f.transform === undefined), `${kind}: reduced motion moves nothing (opacity only)`);
  check(spec.ms.reduced <= 160, `${kind}: reduced lasts ${spec.ms.reduced} ms (at most 160)`);
  check(spec.frames.reduced.some((f) => typeof f.opacity === "number"), `${kind}: reduced still shows the change (an opacity step)`);
  // A sound hook on every kind: a manifest slot on the effects channel.
  const slot = spec.sound?.slot;
  check(Boolean(slot && SOUND_MANIFEST[slot] && SOUND_MANIFEST[slot].channel === "effects"), `${kind}: a sound hook on a shared effects slot (${slot})`);
  if (spec.haptic) check(spec.haptic in HAPTIC_PATTERNS, `${kind}: haptic pattern ${spec.haptic}`);
}
// Haptics only on main moments: never a tap, pick-up, drop, slide, pour, match or count.
for (const kind of ["tap", "pickUp", "drop", "slide", "pour", "match", "countUp", "combo", "stars"] as const) check(K.GAME_FX[kind].haptic === null, `${kind}: no haptic (routine moves never buzz)`);
check(K.GAME_FX.wrong.haptic === "error", "wrong: the error haptic");

// Source rules: sound through playSound, haptics through haptic(), nothing of its own.
const ROOT = join(import.meta.dir, "..");
const read = (p: string) => readFileSync(join(ROOT, p), "utf8");
const kitSrc = read("src/lib/fx/kit.ts");
check(/from "@\/lib\/sound"/.test(kitSrc) && /playSound\(plan\.sound\.slot, plan\.sound\.volume, plan\.sound\.rate\)/.test(kitSrc), "the kit plays its sound through playSound (volumes, mute, hush and replay quiet hold)");
check(!/AudioContext|new Audio\(|\.play\(\)/.test(kitSrc), "the kit makes no audio of its own");
check(!/navigator\s*\.\s*vibrate/.test(kitSrc) && /haptic\(plan\.haptic/.test(kitSrc), "the kit's haptics go through haptic()");
check(!/Math\.random/.test(kitSrc), "the kit draws no random sparks (the same call draws the same effect)");

// No layout animation anywhere the kit or the frame step drew.
const css = read("src/polish-layout/game-fx.css");
for (const m of css.matchAll(/transition(?:-property)?\s*:\s*([^;]+);/g)) check(!LAYOUT.test(m[1]!.replace(/var\([^)]*\)/g, "")), `game-fx.css: a transition on a layout property (${m[1]})`);
check(!/@keyframes/.test(css) || [...css.matchAll(/@keyframes[^{]+\{([\s\S]*?)\n\}/g)].every((m) => !LAYOUT.test(m[1]!)), "game-fx.css: keyframes move only transform and opacity");
for (const file of [
  "src/components/fx/GameFx.tsx",
  // Changed with Joe's approval, 15 Nov 2026 (routine consequence of the game frame restyle): the arena's panel is
  // ArenaGamePanel (the mirrored ArenaSidePanel is gone); the timer's new looks and the header styles' showcase join.
  "src/components/duel/ArenaGamePanel.tsx",
  "src/components/duel/TimerBar.tsx",
  "src/design/HeaderStylesShowcase.tsx",
  "src/components/duel/RoundResult.tsx",
  "src/components/duel/RoundResultsTable.tsx",
  "src/components/duel/FinalResult.tsx",
  "src/components/async/AsyncResults.tsx",
  "src/components/offline/OfflineRunResult.tsx",
  "src/design/GameFxShowcase.tsx",
]) {
  const src = read(file);
  check(!/transition-\[(width|height|top|left|margin|padding)/.test(src) && !/transition(Property)?:\s*["'`]?(width|height|top|left)/.test(src), `${file}: animates no layout property`);
}

/* ------------------------------------------------------------------ 4–5. the variants */

const plan = (kind: Parameters<typeof K.planGameFx>[0], o = {}) => K.planGameFx(kind, o);
for (const kind of K.GAME_FX_KINDS) check(plan(kind).variant === "full", `${kind}: full by default`);
check(plan("win").particles === K.GAME_FX.win.particles && plan("win").particles > 0, "win: its sparks at full");

reducedMotion = true;
for (const kind of K.GAME_FX_KINDS) {
  const p = plan(kind);
  check(p.variant === "reduced" && p.particles === 0 && p.frames.every((f) => f.transform === undefined), `${kind}: reduced motion → a crossfade, no particles (${p.variant}, ${p.particles})`);
  check(p.sound !== null, `${kind}: reduced motion keeps the sound`);
}
reducedMotion = false;

battery.setBatterySaver(true);
for (const kind of K.GAME_FX_KINDS) {
  const p = plan(kind);
  check(p.variant === "lite" && p.particles <= Math.ceil(K.GAME_FX[kind].particles / 3), `${kind}: battery saver → lite (${p.variant}, ${p.particles} particles)`);
}
battery.setBatterySaver(false);

setBeta(false);
for (const kind of K.GAME_FX_KINDS) {
  const p = plan(kind);
  if (K.GAME_FX[kind].payoff) check(p.variant === "calm" && p.particles === 0 && p.frames === p.frames && p.ms === K.GAME_FX[kind].ms.lite, `${kind}: celebrations off → calm, no particles (${p.variant}, ${p.particles})`);
  else check(p.variant === "full", `${kind}: celebrations off leaves a non-payoff effect as it is (${p.variant})`);
}
for (const kind of ["combo", "win", "newBest", "stars", "countUp"] as const) check(K.GAME_FX[kind].payoff, `${kind}: a payoff kind (the celebrations switch reaches it)`);
setBeta(true);

K.forceGameFxVariant("lite");
check(plan("tap").variant === "lite", "a forced variant (the showcase) is honoured");
K.forceGameFxVariant("calm");
check(plan("tap").variant === "full" && plan("win").variant === "calm", "a forced calm reaches payoff kinds only");
K.forceGameFxVariant(null);

const pops = [1, 2, 3, 8, 20].map((n) => plan("combo", { count: n }));
const scaleOf = (p: ReturnType<typeof plan>) => Number(/scale\(([\d.]+)\)/.exec(p.frames[1]!.transform ?? "")?.[1] ?? "0");
check(scaleOf(pops[0]!) < scaleOf(pops[1]!) && scaleOf(pops[1]!) < scaleOf(pops[2]!) && scaleOf(pops[2]!) < scaleOf(pops[3]!), `combo: the pop grows with the count (${pops.map(scaleOf).join(", ")})`);
check(pops[0]!.sound!.rate < pops[1]!.sound!.rate && pops[1]!.sound!.rate < pops[3]!.sound!.rate, "combo: the tone rises with the count");
check(scaleOf(pops[4]!) === scaleOf(pops[3]!) && pops[4]!.sound!.rate === pops[3]!.sound!.rate, "combo: stops growing at the cap");
const slide = plan("slide", { from: { x: -40, y: 12 } });
check(slide.frames[0]!.transform === "translate(-40px, 12px)" && slide.frames.at(-1)!.transform === "translate(0, 0)", `slide: drawn from where it was (${slide.frames[0]!.transform})`);
check(plan("drop", { silent: true }).sound === null && plan("wrong", { noHaptic: true }).haptic === null, "silent and noHaptic leave the sound and the haptic out");

/* ------------------------------------------------------------------ 6. in the page */

const records: { kind: string; variant: string }[] = [];
K.setGameFxSink((r) => records.push({ kind: r.kind, variant: r.variant }));
const el = document.createElement("div");
document.body.appendChild(el);
animated.length = 0;
K.gameFx("drop", el, { inGame: false });
check(animated.length === 1 && animated[0]!.el === el && JSON.stringify(animated[0]!.frames) === JSON.stringify(plan("drop").frames), "gameFx animates the element with the planned frames");
check(records.at(-1)?.kind === "drop", "the sink records the call");
for (let i = 0; i < 10; i++) K.gameFx("win", el, { inGame: false, silent: true });
const sparks = document.querySelectorAll("[data-fx-kit-layer] .fx-kit-spark").length;
check(sparks > 0 && sparks <= K.KIT_PARTICLE_LIMIT, `at most ${K.KIT_PARTICLE_LIMIT} sparks alive (${sparks})`);
const layer = document.querySelector("[data-fx-kit-layer]");
check(layer?.getAttribute("aria-hidden") === "true", "the particle layer is hidden from screen readers");
animated.length = 0;
sound.hushForDemo(true);
K.gameFx("tap", el, { inGame: false });
check(animated.length === 0, "an intro demo (the hush) plays no kit effect");
sound.hushForDemo(false);

reducedMotion = true;
const num = document.createElement("span");
K.countUpText(num, 0, 142);
check(num.textContent === "142", `reduced motion: the count-up writes its final number at once (${num.textContent})`);
reducedMotion = false;
const num2 = document.createElement("span");
const stop = K.countUpText(num2, 0, 99, { silent: true });
stop();
check(num2.textContent === "99", "a stopped count-up ends on its final number");
K.setGameFxSink(null);

/* ------------------------------------------------------------------ 7. the React pieces */

const { renderToStaticMarkup } = await import("react-dom/server");
const { createElement } = await import("react");
const G = await import("../src/components/fx/GameFx");
const html = renderToStaticMarkup(createElement(G.ResultPayoff, { score: 176, label: "Your score", stars: { earned: 2 }, newBest: true, won: true }));
check(/>176</.test(html), "the payoff's markup holds the final score");
check((html.match(/data-earned/g) ?? []).length === 2 && /data-fx-stars="2"/.test(html), "the payoff's markup holds the stars earned");
check(/data-fx-new-best/.test(html) && /New best/.test(html), "the payoff's markup holds the new-best badge");

if (failures.length) {
  console.log(`FAIL: ${failures.length} of ${failures.length + passes} assertions failed`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log(`PASS: the effects kit: ${K.GAME_FX_KINDS.length} kinds, each with full, lite and reduced variants, transform and opacity only, a sound hook, celebrations-off and battery saver honoured (${passes} assertions).`);
process.exit(0);
