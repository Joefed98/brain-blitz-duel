/**
 * Game controls and the header-style switch (phase 2 step 4 pass 2, 15 Nov 2026; src/lib/gameControls.ts,
 * src/config/gameFrameConfig.ts). No browser, ~1 s. Fails unless:
 *  1. every active game offers at least one scheme on a computer, its default first; a game with keys offers Keyboard
 *     and Mouse; Iron Wall (hover aiming) offers Mouse movement and Click and drag; a game without keys only Mouse;
 *  2. a player's choice is kept per game on the device, a choice a game doesn't offer is refused, the Settings
 *     preference reaches every game that offers it (and clears per-game choices), and the default comes back after it;
 *  3. schemes are input mapping only: no sim, replay, grader or server file reads gameControls, the layout, the
 *     arena or the header style; the stage gates only keys (GameKeysOff) and hover aiming (ArcadeCanvasStage);
 *  4. the header style: the default is one line in gameFrameConfig.ts naming one of HEADER_STYLES, every style has a
 *     timer look, and a production build reads only the config (the check stand-in and the dev picker are behind
 *     checkOverride and import.meta.env.DEV).
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
check((cfg.match(/export const GAME_HEADER_STYLE: HeaderStyle = "\w+";/g) ?? []).length === 1, "the default header style is one line");
check(F.HEADER_STYLES.includes(F.GAME_HEADER_STYLE), "the default is one of the styles");
check(F.HEADER_STYLES.length >= 4, "the default and at least three alternatives");
for (const s of F.HEADER_STYLES) check(Boolean(H.TIMER_LOOK[s]), `${s}: a timer look`);
check(H.headerStyleNow() === F.GAME_HEADER_STYLE, "with no stand-in, the config's style");
const hs = readFileSync(join(ROOT, "src/lib/gameFrame/headerStyle.ts"), "utf8");
check(/checkOverride<string>\("__DUELZ_HEADER_STYLE__"\)/.test(hs) && /import\.meta\.env\.DEV && typeof window/.test(hs), "stand-ins only through checkOverride and development builds");
check(H.clockText(52) === "0:52" && H.clockText(125) === "2:05", "the digital clock reads m:ss");

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: game-controls-check: ${failures.length} of ${failures.length + passes}`);
  process.exit(1);
}
console.log(`PASS: game-controls-check: ${ACTIVE_PUZZLE_TYPES.length} games' schemes, the device choice and preference, input mapping only, the header style's one-line default (${passes} assertions)`);
process.exit(0);
