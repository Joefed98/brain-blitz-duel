/**
 * reveal-palette-check (3 Nov 2026): the answer reveal is its own screen in the game's own colours.
 *
 *  1. src/lib/duel/revealPalette.data.ts is what `bun scripts/reveal-palette.ts` makes from today's tiles
 *     (re-run it after re-exporting a tile).
 *  2. Every active game has a gradient, and white text reads at least REVEAL_MIN_CONTRAST:1 on every stop
 *     (so on the whole gradient), as on the fallback.
 *  3. Pinball's is purple (the brief's example): its top stop's hue is violet.
 *  4. Every reveal screen asks for it (PhoneShell `reveal` on the room, practice, daily and challenge reveals),
 *     PhoneShell marks it and sets the stops, the CSS paints them, and the arcade reveal draws no frozen world.
 */
import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";

import { ACTIVE_PUZZLE_TYPES } from "../src/lib/duel/registry";
import { REVEAL_PALETTE } from "../src/lib/duel/revealPalette.data";
import { REVEAL_FALLBACK, REVEAL_MIN_CONTRAST, hexToRgb, revealPaletteFor, revealPaletteStyle, whiteContrast } from "../src/lib/duel/revealPalette";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

// 1. In step with the tiles.
const run = spawnSync("bun", ["scripts/reveal-palette.ts", "--check"], { encoding: "utf8" });
check(run.status === 0, `revealPalette.data.ts is out of date with the tiles: ${(run.stdout + run.stderr).trim()}`);

// 2. Every active game, legible.
for (const type of ACTIVE_PUZZLE_TYPES) {
  check(type in REVEAL_PALETTE, `${type}: no reveal gradient (re-run bun scripts/reveal-palette.ts)`);
  const stops = revealPaletteFor(type);
  for (const hex of stops) {
    check(/^#[0-9A-F]{6}$/.test(hex), `${type}: ${hex} is not a hex colour`);
    const c = whiteContrast(hexToRgb(hex));
    check(c >= REVEAL_MIN_CONTRAST, `${type}: white on ${hex} is ${c.toFixed(2)}:1, under ${REVEAL_MIN_CONTRAST}:1`);
  }
}
for (const hex of REVEAL_FALLBACK) check(whiteContrast(hexToRgb(hex)) >= REVEAL_MIN_CONTRAST, `fallback ${hex} too light`);
check(revealPaletteFor("no-such-game") === REVEAL_FALLBACK, "a game without a tile gets the fallback");
const style = revealPaletteStyle("pinball");
check(style["--reveal-top"] === REVEAL_PALETTE["pinball"]?.[0] && "--reveal-mid" in style && "--reveal-bottom" in style, "PhoneShell's variables carry the stops");

// 3. Pinball is purple.
{
  const [r, g, b] = hexToRgb(revealPaletteFor("pinball")[0]);
  check(b > g && r > g && b >= r, `Pinball's reveal is purple (${revealPaletteFor("pinball")[0]})`);
}

// 4. Wiring.
const read = (p: string) => readFileSync(p, "utf8");
for (const [file, pattern] of [
  ["src/routes/duel.$code.tsx", /<PhoneShell constrained gameScreen reveal gameType=\{puzzle\?\.type\}>\s*<AnswerReveal/],
  ["src/routes/practice.tsx", /<PhoneShell constrained gameScreen reveal gameType=\{type\}>\s*<AnswerReveal/],
  ["src/components/async/AsyncRun.tsx", /<PhoneShell constrained gameScreen reveal gameType=\{step\.puzzle\.type\}>\s*<AnswerReveal/],
  ["src/components/async/AsyncResults.tsx", /<PhoneShell constrained gameScreen reveal gameType=\{shown\.puzzle\.type\}>\s*<AnswerReveal/],
] as const)
  check(pattern.test(read(file)), `${file}: its answer reveal is a reveal screen`);
const shell = read("src/components/duel/PhoneShell.tsx");
check(/data-reveal-screen=\{reveal && gameScreen \? "" : undefined\}/.test(shell) && /revealPaletteStyle\(gameType\)/.test(shell), "PhoneShell marks the reveal screen and sets its stops");
check(/!\(reveal && gameScreen\)/.test(shell), "the reveal screen has no app top bar");
const css = read("src/polish-layout/reveal-screen.css");
check(/\[data-reveal-screen\] > \.screen-background \{[\s\S]*var\(--reveal-top\)[\s\S]*var\(--reveal-mid\)[\s\S]*var\(--reveal-bottom\)/.test(css), "the CSS paints the gradient");
check(/var\(--screen-edge\) env\(safe-area-inset-top/.test(css) && /linear-gradient\(to top, var\(--screen-edge\)/.test(css), "the notch and home-bar strips stay --screen-edge");
check(/@import "\.\/polish-layout\/reveal-screen\.css";/.test(read("src/styles.css")), "styles.css imports it");
const arcade = read("src/components/duel/ArcadeReveal.tsx");
check(!/function Backdrop|<Backdrop|drawFinal|data-reveal-scrim/.test(arcade), "the arcade reveal draws no frozen world behind it");
check(/data-reveal-head/.test(read("src/components/duel/AnswerReveal.tsx")) && /<MuteToggle \/>/.test(read("src/components/duel/AnswerReveal.tsx")), "the reveal's header row carries the sound button");

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL ${f}`);
  console.log(`FAIL reveal-palette-check: ${failures.length} of ${passes + failures.length} checks failed`);
  process.exit(1);
}
console.log(`PASS reveal-palette-check: ${passes} checks (${ACTIVE_PUZZLE_TYPES.length} active games, white text at ${REVEAL_MIN_CONTRAST}:1 or more)`);
