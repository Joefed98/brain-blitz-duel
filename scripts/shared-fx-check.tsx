import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { PUZZLE_REGISTRY } from "../src/lib/duel/registry";
import { FX_HOOKS } from "../src/lib/fx/theme";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";
import { MOTION_MS, animateFx } from "../src/lib/fx/motion";
import { arcadeFeedback } from "../src/lib/fx/arcade";
import { fx, setFxTheme, type FxEvent } from "../src/lib/fx";
import { TimerBar } from "../src/components/duel/TimerBar";
import { ProgressStrip } from "../src/components/duel/ProgressStrip";

assert.equal(FX_HOOKS.length, 16);
assert.equal(MOTION_MS.pop, 180);
assert.equal(MOTION_MS.shake, 250);
assert.equal(MOTION_MS.burst, 400);
for (const definition of Object.values(PUZZLE_REGISTRY)) {
  assert.equal(definition.theme.accent, definition.category);
  for (const hook of FX_HOOKS) assert.ok(SOUND_MANIFEST[definition.theme.sounds[hook] ?? "correct"]);
}
// Music beds now ship real loops (lobby, standings, per-category and per-arcade beds).
assert.equal(SOUND_MANIFEST.lobby_loop?.channel, "music");
assert.match(SOUND_MANIFEST.lobby_loop?.url ?? "", /lobby_loop\.mp3$/);
for (const entry of Object.values(SOUND_MANIFEST)) {
  if (entry.channel === "music" && entry.url !== null) assert.match(entry.url, /\.mp3$/);
}
assert.equal(renderToStaticMarkup(<TimerBar active totalMs={60000} msRemaining={5000} />).match(/role="timer"/g)?.length, 1);
assert.ok(renderToStaticMarkup(<ProgressStrip name="Player" value={150} />).includes("150"));

const events: FxEvent[] = [];
let reduced = false;
Object.defineProperty(globalThis, "window", { configurable: true, value: {
  localStorage: { getItem: () => null },
  matchMedia: () => ({ matches: reduced }),
  dispatchEvent: (event: CustomEvent<FxEvent>) => { events.push(event.detail); return true; },
} });
const observe = arcadeFeedback();
observe({ combo: 0, tick: 0 }, false);
observe({ combo: 3, tick: 1 }, false);
observe({ combo: 3, tick: 2 }, true);
observe({ combo: 3, tick: 2 }, true);
assert.equal(events.filter(event => event.hook === "onCombo").length, 1);
assert.equal(events.filter(event => event.hook === "onComplete").length, 1);
const restore = setFxTheme({ ...PUZZLE_REGISTRY.balance.theme, overrides: { onPlace: "glow" } });
fx.onPlace();
assert.equal(events.at(-1)?.primitive, "glow");
restore();
let frames: Keyframe[] = [];
let options: KeyframeAnimationOptions | undefined;
const element = { animate: (values: Keyframe[], config: KeyframeAnimationOptions) => { frames = values; options = config; return undefined; } } as unknown as Element;
reduced = true;
animateFx(element, "shake");
assert.equal(options?.duration, 160);
assert.ok(frames.every(frame => frame.transform === undefined));
console.log(`Shared FX checks passed: ${Object.keys(PUZZLE_REGISTRY).length} themes, 16 hooks, manifest, run-end/combo deduplication, reduced-motion fades and HUD markup.`);