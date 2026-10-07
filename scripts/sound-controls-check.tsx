import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { MuteToggle } from "../src/components/duel/MuteToggle";
import { PUZZLE_REGISTRY } from "../src/lib/duel/registry";
import { roundMusicFor } from "../src/lib/fx/theme";
import { roundMusicRamp } from "../src/lib/soundSettings";
import type { PuzzleType } from "../src/lib/duel/types";

// Static markup and arithmetic only: no browser or gameplay simulation.
const controls = renderToStaticMarkup(<MuteToggle />);
assert.equal((controls.match(/aria-label="Turn off/g) ?? []).length, 2);
assert.equal((controls.match(/aria-label="(?:Effects|Music) volume"/g) ?? []).length, 2);
assert.match(controls, /h-9 w-\[104px\]/);
assert.doesNotMatch(controls, /Music in puzzle rounds/);
for (const width of [375, 390]) {
  assert.ok(width - 8 - 104 - 8 >= 255, "game header retains flexible text space");
  assert.ok(width - 40 - 104 - 8 >= 223, "lobby/practice text space");
}
for (const [arcade, base, end, windowMs] of [
  [false, 0.2, 0.5, 10000],
  [true, 0.5, 0.9, 15000],
] as const) {
  assert.equal(roundMusicRamp(arcade, windowMs * 2), base);
  assert.equal(roundMusicRamp(arcade, windowMs), base);
  assert.ok(Math.abs(roundMusicRamp(arcade, windowMs / 2) - (base + end) / 2) < 1e-9);
  assert.equal(roundMusicRamp(arcade, 0), end);
}
for (const [type, def] of Object.entries(PUZZLE_REGISTRY)) {
  if (def.retired) continue;
  const track = roundMusicFor(type as PuzzleType, def.category);
  if (type === "beat") assert.equal(track, null);
  else assert.ok(track, `${type} has round music independent of mute`);
}
const sound = readFileSync("src/lib/sound.ts", "utf8");
assert.match(sound, /roundLevel \* musicVolume\(\)/);
assert.doesNotMatch(sound, /roundLevel \* effectsVolume/);
const prepare =
  sound
    .split("export function prepareRoundMusic")[1]
    ?.split("/* Dev audio log")[0] ?? "";
assert.doesNotMatch(prepare, /isMusicMuted|isMuted/);
assert.match(prepare, /roundBuffers.length >= 2/);
const ui = readFileSync("src/components/duel/MuteToggle.tsx", "utf8");
assert.match(ui, /data-sound-dismiss/);
assert.match(ui, /event.preventDefault\(\)/);
assert.match(ui, /event.stopPropagation\(\)/);
const timer = readFileSync("src/components/duel/TimerBar.tsx", "utf8");
assert.doesNotMatch(timer, /RoundMusic/, "the timer bar never owns round music");
for (const file of [
  "src/components/duel/RoundIntro.tsx",
  "src/components/duel/AnswerReveal.tsx",
  "src/components/duel/FeedbackStage.tsx",
  "src/components/duel/PhoneShell.tsx",
]) {
  assert.doesNotMatch(readFileSync(file, "utf8"), /startRoundMusic|stopRoundMusic|syncRoundMusic/, file);
}
assert.doesNotMatch(sound, /export function (startRoundMusic|stopRoundMusic)/);
for (const route of ["src/routes/duel.$code.tsx", "src/routes/practice.tsx"]) {
  assert.match(readFileSync(route, "utf8"), /useRoundMusic\(/, route);
}
console.log(
  "PASS shared 36px controls, 375/390px header budgets, music mappings, Beat silence, ramps, slider independence, unconditional loading and outside-tap shield.",
);
