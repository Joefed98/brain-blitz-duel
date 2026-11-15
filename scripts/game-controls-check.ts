/**
 * Game controls and the header-style switch (phase 2 step 4 pass 2, 15 Nov 2026; src/lib/gameControls.ts,
 * src/config/gameFrameConfig.ts). No browser, ~1 s. Fails unless:
 *  1. every active game offers at least one scheme on a computer, its default first; a game with keys offers Keyboard
 *     and Mouse; Iron Wall (hover aiming) offers Mouse movement and Click and drag; a game without keys only Mouse;
 *  2. a player's choice is kept per game on the device, a choice a game doesn't offer is refused, the Settings
 *     preference reaches every game that offers it (and clears per-game choices), and the default comes back after it;
 *  3. schemes are input mapping only: no sim, replay, grader or server file reads gameControls, the layout, the
 *     arena or the header style; the stage gates only keys (GameKeysOff) and hover aiming (ArcadeCanvasStage);
 *  4. the game timer (Changed with Joe's approval, 15 Nov 2026 (timer bar only by default): the header styles became
 *     one player choice, Settings → Appearance → Game timer): the choices are Bar, Ring and Chip, the default is one
 *     line in gameFrameConfig.ts naming Bar, a player's choice is kept on the device and a choice not offered is
 *     refused, the check stand-in is only through checkOverride, and the bar shows its seconds only in the last 10 s.
 *
 *   bun scripts/game-controls-check.ts
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, m: string) => (ok ? passes++ : failures.push(m));

const store = new Map<string, string>();
(globalThis as unknown as { window: unknown }).window = {
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) },
  location: { pathname: "/", search: "", href: "https://joulz.uk/" },
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent() {
    return true;
  },
};

const C = await import("../src/lib/gameControls");
const { ACTIVE_PUZZLE_TYPES } = await import("../src/lib/duel/registry");
const { DESKTOP_KEYS } = await import("../src/lib/desktopKeys");
const F = await import("../src/config/gameFrameConfig");
const H = await import("../src/lib/gameFrame/headerStyle");

/* 1 */
for (const t of ACTIVE_PUZZLE_TYPES) {
  const offered = C.schemesFor(t);
  check(offered.length >= 1, `${t}: no scheme offered`);
  check(C.schemeFor(t) === offered[0], `${t}: default ${C.schemeFor(t)}, want ${offered[0]}`);
  if (t === "bastion") check(JSON.stringify(offered) === JSON.stringify(["move", "drag"]), `bastion offers ${offered}`);
  else if (DESKTOP_KEYS[t]?.length) check(JSON.stringify(offered) === JSON.stringify(["keys", "mouse"]), `${t} (keys) offers ${offered}`);
  else check(JSON.stringify(offered) === JSON.stringify(["mouse"]), `${t} (no keys) offers ${offered}`);
}

/* 2 */
C.resetGameControlsForTest();
C.setSchemeFor("sudoku", "mouse");
check(C.schemeFor("sudoku") === "mouse", "a choice is kept for its game");
check(JSON.parse(store.get(C.CONTROLS_KEY) ?? "{}").games?.sudoku === "mouse", "the choice is stored on the device");
C.resetGameControlsForTest();
check(C.schemeFor("sudoku") === "mouse", "the choice survives a reload (read from storage)");
C.setSchemeFor("sudoku", "move");
check(C.schemeFor("sudoku") === "mouse", "a scheme the game doesn't offer is refused");
C.setPreferredScheme("mouse");
check(C.schemeFor("matchup") === (C.schemesFor("matchup").includes("mouse") ? "mouse" : C.schemesFor("matchup")[0]), "the preference reaches every game that offers it");
check(C.schemeFor("bastion") === "move", "the preference leaves a game that doesn't offer it on its default");
C.setSchemeFor("sudoku", "keys");
C.setPreferredScheme(null);
check(C.schemeFor("sudoku") === C.schemesFor("sudoku")[0], "clearing the preference clears per-game choices: the default comes back");

/* 3 */
const ROOT = join(import.meta.dir, "..");
const files: string[] = [];
const walk = (d: string) => {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(ts|tsx)$/.test(n)) files.push(p);
  }
};
walk(join(ROOT, "src"));
const presentation = /gameControls|gameFrame\/arena|gameFrame\/headerStyle|gameFrameConfig/;
for (const f of files) {
  const rel = f.slice(ROOT.length + 1);
  const sim = (rel.startsWith("src/lib/arcade/") && !/renderer|\.tsx$/.test(rel)) || /\.server\.ts$/.test(rel) || /src\/lib\/duel\/(grade|replay|tapLog|scoring)/.test(rel);
  if (sim) check(!presentation.test(readFileSync(f, "utf8")), `${rel}: a sim, replay, grader or server file reads the controls, the arena or the header style`);
}
const stage = readFileSync(join(ROOT, "src/components/puzzles/ArcadeCanvasStage.tsx"), "utf8");
check(/hoverAims = useContext\(ControlSchemeContext\) !== "drag"/.test(stage) && /props\.hover && hoverAims/.test(stage), "ArcadeCanvasStage gates only hover aiming on the scheme");
const shell = readFileSync(join(ROOT, "src/components/duel/PhoneShell.tsx"), "utf8");
check(/GameKeysOff\.Provider value=\{scheme === "mouse" \|\| scheme === "drag"\}/.test(shell), "GameLayout gates only the keys on the scheme");
check(/layoutMode === "desktop" \? chosen : null/.test(shell), "schemes apply on a computer only");

/* 4 */
const cfg = readFileSync(join(ROOT, "src/config/gameFrameConfig.ts"), "utf8");
check((cfg.match(/export const DEFAULT_GAME_TIMER: GameTimer = "\w+";/g) ?? []).length === 1, "the default game timer is one line");
check(JSON.stringify(F.GAME_TIMERS) === JSON.stringify(["bar", "ring", "chip"]), `the choices are Bar, Ring and Chip (${F.GAME_TIMERS})`);
check(F.DEFAULT_GAME_TIMER === "bar", "the default is the bar");
for (const s of F.GAME_TIMERS) check(Boolean(F.GAME_TIMER_LABEL[s]), `${s}: a label`);
check(H.gameTimerNow() === F.DEFAULT_GAME_TIMER, "with nothing chosen, the default");
H.setGameTimer("ring");
check(H.gameTimerNow() === "ring" && store.get(H.GAME_TIMER_KEY) === "ring", "a choice is kept on the device");
H.setGameTimer("digital" as never);
check(H.gameTimerNow() === "ring", "a choice not offered is refused");
store.set(H.GAME_TIMER_KEY, "digital");
check(H.gameTimerNow() === F.DEFAULT_GAME_TIMER, "a stored choice no longer offered reads as the default");
const hs = readFileSync(join(ROOT, "src/lib/gameFrame/headerStyle.ts"), "utf8");
check(/checkOverride<string>\("__DUELZ_GAME_TIMER__"\)/.test(hs), "stand-ins only through checkOverride");
check(H.BAR_SECONDS_FROM_MS === 10_000, "the bar shows its seconds in the last 10 s");
check(H.clockText(52) === "0:52" && H.clockText(125) === "2:05", "the chip's clock reads m:ss");
const tb = readFileSync(join(ROOT, "src/components/duel/TimerBar.tsx"), "utf8");
check(/role="timer"/.test(tb) && /aria-label=/.test(tb), "the timer keeps its role and accessible label in every look");

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: game-controls-check: ${failures.length} of ${failures.length + passes}`);
  process.exit(1);
}
console.log(`PASS: game-controls-check: ${ACTIVE_PUZZLE_TYPES.length} games' schemes, the device choice and preference, input mapping only, the game timer's choices and one-line default (${passes} assertions)`);
process.exit(0);
