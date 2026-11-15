/**
 * app-moments-check (15 Nov 2026, the effects pass; display only). No browser, ~2 s. Fails unless:
 *  1. the countdown's lightning varies: 200 strikes (GO and 3-2-1) draw from fresh seeds, so their bolts, fork counts,
 *     lengths and timing are not all alike and no two share a shape; every strike stays inside its time (GO under 900 ms,
 *     the 3-2-1 strikes under COUNT_STRIKE_MS); 3-2-1 sends its own request kind (GO's single "strike" unchanged) and
 *     nothing with the celebrations off, reduced motion or the battery saver; RoundIntro sends one per number;
 *  2. the room moments: Prepare to Duel's and Final Round's richer parts and every round's backdrop are marked rich,
 *     the (look, backdrop) pairs differ for rounds 1–30, and RoomMomentFx draws rich parts only with the celebrations on
 *     and full effects; the lineup and the round numeral likewise, every lineup / numeral keyframe ending visible;
 *  3. the reveal heading says what the board shows: "Your answer", "The solution" or both, for every active puzzle
 *     reveal (none left to the fallback), the Solution / Yours switch deciding it when it has both columns, and the
 *     games whose board depends on the outcome (Heave, Gridlock, Gradient) following it;
 *  4. the in-match screens' entrance (useMomentEnter) is on all eight screens, its keyframes end visible, and it is
 *     off with the celebrations off; the app moments (badge, pass level, reward claim, season, challenge, tournament
 *     result, trophy, rating count-up) are wired to the kit and the page fade is opacity only;
 *  5. the phone's status panel hides the board's own figures only while it shows, and the room's "finished" strip is
 *     placed under the timer bar on puzzles and above it on arcade play screens.
 *
 *   bun scripts/app-moments-check.tsx
 */
import { readFileSync } from "node:fs";
import { Window } from "happy-dom";

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => (ok ? passes++ : failures.push(message));
const read = (p: string) => readFileSync(p, "utf8");

const win = new Window({ url: "https://joulz.uk/" });
let reduced = false;
Object.defineProperty(win, "matchMedia", {
  configurable: true,
  value: (query: string) => ({ matches: /prefers-reduced-motion:\s*reduce/.test(query) ? reduced : false, media: query, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} }),
});
for (const key of ["window", "document", "navigator", "localStorage", "matchMedia", "requestAnimationFrame", "cancelAnimationFrame"] as const) {
  const value = (win as unknown as Record<string, unknown>)[key];
  Object.defineProperty(globalThis, key, { configurable: true, writable: true, value: typeof value === "function" ? (value as (...a: unknown[]) => unknown).bind(win) : value });
}
const beta = win as unknown as { __DUELZ_BETA_CONFIG__?: Record<string, unknown> };
beta.__DUELZ_BETA_CONFIG__ = { FX_CELEBRATIONS: true };

const C = await import("../src/lib/fx/celebrations");
const { CelebrationScene } = await import("../src/lib/fx/celebrationCanvas");
const { setBatterySaver } = await import("../src/lib/battery");

/* 1. The lightning. */
{
  const scene = new CelebrationScene() as unknown as {
    strike(w: number, h: number, now: number, small?: boolean): void;
    bolt: Float32Array;
    bolts: number;
    branches: Uint8Array;
    strikeLen: number;
    strikeIn: number;
    flickerAt: number;
  };
  const shapes = new Set<string>();
  const counts = new Set<number>();
  const forks = new Set<number>();
  const lens = new Set<number>();
  const ins = new Set<number>();
  let flickers = 0;
  for (let i = 0; i < 200; i++) {
    const small = i % 4 !== 3;
    scene.strike(390, 844, 1000 + i * 1000, small);
    shapes.add(Array.from(scene.bolt.slice(0, 66), (v) => v.toFixed(1)).join(","));
    counts.add(scene.bolts);
    for (let n = 0; n < scene.bolts; n++) forks.add(scene.branches[n]!);
    lens.add(scene.strikeLen);
    ins.add(scene.strikeIn);
    if (scene.flickerAt > 0) flickers++;
    check(scene.bolts >= 1 && scene.bolts <= (small ? 2 : 3), `strike ${i}: ${scene.bolts} bolts`);
    check(small ? scene.strikeLen <= C.COUNT_STRIKE_MS : scene.strikeLen >= C.STRIKE_MIN_MS && scene.strikeLen <= C.STRIKE_MS, `strike ${i}: ${scene.strikeLen} ms`);
    check(scene.strikeLen < 900, `strike ${i}: within the 900 ms rule`);
  }
  check(shapes.size === 200, `every strike its own bolt (${shapes.size} shapes of 200)`);
  check(counts.size >= 2, `bolt counts vary (${[...counts]})`);
  check(forks.size >= 3, `fork counts vary (${[...forks]})`);
  check(lens.size >= 20 && ins.size >= 10, `lengths and in-times vary (${lens.size}, ${ins.size})`);
  check(flickers > 40 && flickers < 180, `some strikes re-strike, not all (${flickers})`);

  const log = C.logCelebrations(true);
  C.countdownStrike(3);
  check(log.some((r) => r.kind === "countStrike"), "3-2-1 sends a countStrike");
  check(!log.some((r) => r.kind === "strike"), "3-2-1 never sends GO's strike");
  log.length = 0;
  beta.__DUELZ_BETA_CONFIG__ = { FX_CELEBRATIONS: false };
  C.countdownStrike(2);
  check(log.length === 0, "no 3-2-1 strike with the celebrations off");
  beta.__DUELZ_BETA_CONFIG__ = { FX_CELEBRATIONS: true };
  reduced = true;
  C.countdownStrike(2);
  check(log.length === 0, "no 3-2-1 strike under reduced motion");
  reduced = false;
  setBatterySaver(true);
  C.countdownStrike(1);
  check(log.length === 0, "no 3-2-1 strike with the battery saver");
  setBatterySaver(false);
  C.logCelebrations(false);
  const intro = read("src/components/duel/RoundIntro.tsx");
  check(/countdownStrike\(secondsLeft\);\s*\}, \[counting, secondsLeft, startedAt, celebrate\]\)/.test(intro), "RoundIntro sends one strike per number while counting");
}

/* 2. Room moments. */
{
  const M = await import("../src/lib/fx/roomMoments");
  const css = read("src/styles.css");
  const rich = (spec: { parts: { part: string; rich?: boolean }[] }, names: string[]) => names.every((n) => spec.parts.some((p) => p.part === n && p.rich));
  check(rich(M.PREPARE_SPEC, ["floor", "ember", "sweep", "charge"]), "Prepare to Duel's richer parts are marked rich");
  check(rich(M.FINAL_SPEC, ["bd-rays", "spark", "shock"]), "Final Round's richer parts are marked rich");
  check(M.ROUND_BACKDROPS.every((b) => b.every((p) => p.rich)), "every backdrop part is rich");
  const pairs = new Set<string>();
  for (let r = 1; r <= 30; r++) {
    const spec = M.roundMomentSpec(r, 31);
    pairs.add(`${spec.effect}|${spec.parts.filter((p) => p.rich).map((p) => p.part).join(",")}`);
    check(M.momentEndMs(spec) <= spec.phaseMs, `round ${r}: inside its title`);
  }
  check(pairs.size === 30, `rounds 1–30 each a different look and backdrop (${pairs.size})`);
  check(M.roundMomentSpec(8, 8) === M.FINAL_SPEC, "the last round is still Final Round");
  for (const part of [...M.PREPARE_SPEC.parts, ...M.FINAL_SPEC.parts, ...M.ROUND_BACKDROPS.flat()].filter((p) => p.rich))
    check(css.includes(`[data-part="${part.part}"]`), `${part.part} has its CSS`);
  const fx = read("src/components/duel/RoomMomentFx.tsx");
  const hookSrc = read("src/components/fx/useMomentEnter.ts");
  check(/export function useRichMoments\(\): boolean \{\s*const on = useCelebrationsOn\(\);\s*return on && !arcadeReducedEffects\(\);/.test(hookSrc), "the rich moments' one switch: celebrations on and full effects");
  check(/const rich = useRichMoments\(\);/.test(fx) && /\(rich \|\| !p\.rich\)/.test(fx), "RoomMomentFx draws rich parts only with the rich moments on");
  const start = read("src/components/duel/DuelStart.tsx");
  check(/const on = useRichMoments\(\);\s*const elapsed = useMomentElapsed\(startedAt\);\s*if \(!on \|\| players\.length < 2\) return null;/.test(start), "the lineup only with the celebrations on and two or more players");
  check(/players=\{players\s*\.filter\(\(p\) => p\.status !== "left"\)/.test(read("src/routes/duel.$code.tsx")), "the room passes its players (left ones out)");
  const title = read("src/components/duel/RoundTitle.tsx");
  check(/const rich = useRichMoments\(\);/.test(title) && /\{rich \? \(\s*<span\s*className="round-title-ghost"/.test(title), "the round numeral only with the celebrations on and full effects");
  const moments = read("src/polish-layout/moments.css");
  for (const name of ["lineup-rise", "lineup-from-left", "lineup-from-right", "lineup-vs", "round-ghost-in", "round-ghost-final", "moment-rise", "moment-fade"]) {
    const body = moments.match(new RegExp(`@keyframes ${name} \\{([\\s\\S]*?)\\n\\}`))?.[1] ?? "";
    const end = body.match(/100% \{([^}]*)\}/)?.[1] ?? "";
    check(body.length > 0, `${name} defined`);
    check(!/opacity:\s*0[;\s]/.test(end) && !/scale\(0\)/.test(end), `${name} ends visible (reduced motion shows the end)`);
    check(![...body.matchAll(/([a-z-]+)\s*:/g)].some((m) => m[1] !== "opacity" && m[1] !== "transform"), `${name} animates transform and opacity only`);
  }
}

/* 3. The reveal heading. */
{
  const R = await import("../src/lib/duel/revealHeading");
  const { ACTIVE_PUZZLE_TYPES } = await import("../src/lib/duel/registry");
  const { ARCADE_REVEAL_RENDERERS } = await import("../src/lib/arcade/revealRenderers");
  const { SOLUTION_SWITCH_TYPES } = await import("../src/components/duel/SolutionSwitch");
  const source = read("src/lib/duel/revealHeading.ts");
  const engine = ["tendrop", "whack", "stroop", "clayshoot", "minesweeper"];
  const puzzleReveal = ACTIVE_PUZZLE_TYPES.filter((t) => !(t in ARCADE_REVEAL_RENDERERS) || engine.includes(t));
  check(puzzleReveal.length >= 40, `puzzle reveals found (${puzzleReveal.length})`);
  for (const type of puzzleReveal) {
    const named = new RegExp(`"${type}"`).test(source) || SOLUTION_SWITCH_TYPES.has(type);
    check(named, `${type}: its reveal is classified (not left to the fallback)`);
  }
  const p = (type: string, extra: Record<string, unknown> = {}) => ({ type, ...extra }) as never;
  check(R.revealHeading(p("sudoku"), true, null) === R.HEADING_YOURS, "Box Six: your answer (its board is yours)");
  check(R.revealHeading(p("iceslide"), false, null) === R.HEADING_SOLUTION, "Skid: the solution");
  check(R.revealHeading(p("kakuro"), false, null) === R.HEADING_BOTH, "Kakuro: both");
  check(R.revealHeading(p("shikaku"), true, { found: true, view: "solution" }) === R.HEADING_SOLUTION, "switch on Solution: the solution");
  check(R.revealHeading(p("shikaku"), true, { found: true, view: "yours" }) === R.HEADING_YOURS, "switch on Yours: your answer");
  check(R.revealHeading(p("push"), true, null) === R.HEADING_YOURS && R.revealHeading(p("push"), false, null) === R.HEADING_SOLUTION, "Heave follows the outcome");
  check(R.revealHeading(p("unblock"), false, null) === R.HEADING_SOLUTION, "Gridlock unsolved: the solution playing back");
  check(R.revealHeading(p("tiles", { tilesRev: 4 }), true, null) === R.HEADING_YOURS, "Gradient: your answer");
  const reveal = read("src/components/duel/AnswerReveal.tsx");
  check(/revealHeading\(puzzle, myCorrect, switchState\)/.test(reveal) && !/def\.revealHeading \?\?/.test(reveal), "the reveal draws the heading from what's shown, never the old fixed string");
  check(/onChange=\{setSwitchState\}/.test(reveal), "the switch tells the reveal its view");
}

/* 4. Entrances and app moments. */
{
  for (const f of ["duel/AnswerReveal", "duel/FinalResult", "duel/Podium", "duel/RoundResult", "duel/RoundResultsTable", "duel/Standings", "duel/DuelOverall", "async/AsyncResults"]) {
    const src = read(`src/components/${f}.tsx`);
    check(/const enter = useMomentEnter\("(rise|fade)"\);/.test(src) && /\{\.\.\.enter\}/.test(src), `${f}: the shared entrance`);
  }
  for (const f of ["duel/FinalResult", "duel/Podium", "duel/Standings", "duel/AnswerReveal"])
    check(/useMomentEnter\("fade"\)/.test(read(`src/components/${f}.tsx`)), `${f}: fade only (it measures its rows or its hero)`);
  const hook = read("src/components/fx/useMomentEnter.ts");
  check(/return on && !arcadeReducedEffects\(\) \? \{ "data-moment-enter": kind \} : \{\};/.test(hook), "the entrance is off with the celebrations off or reduced effects");
  check(/if \(!on \|\| key === null/.test(hook) && /inGame: false/.test(hook), "app moments: off with the celebrations off, never a haptic");
  const wired: [string, RegExp][] = [
    ["src/components/badges/BadgeMoment.tsx", /useAppMoment\("newBest", "\[data-badge-moment\]", shown\)/],
    ["src/components/pass/PassLevelNotice.tsx", /useAppMoment\("newBest", "\[data-pass-level-notice\]", shown\)/],
    ["src/components/pass/PassScreen.tsx", /useAppMoment\("win", `\[data-pass-cell=/],
    ["src/components/seasons/SeasonNotice.tsx", /useAppMoment\("win", "\[data-season-notice\]"/],
    ["src/components/app/PracticeChallenges.tsx", /useAppMoment\("match", "\[data-challenge-moment\]"/],
    ["src/components/tournaments/TournamentEvent.tsx", /useAppMoment\("win", "\[data-tournament-result\]"/],
    ["src/components/tournaments/TournamentHub.tsx", /useAppMoment\("newBest", `\[data-trophy-event=/],
    ["src/components/rated/RatedMatchScreens.tsx", /countUpText\(el, Math\.round\(to - change\), Math\.round\(to\), \{ format: ratingText/],
  ];
  for (const [file, re] of wired) check(re.test(read(file)), `${file.split("/").pop()}: its moment is wired to the kit`);
  const moments = read("src/polish-layout/moments.css");
  check(/\[data-page-enter\] \{\s*animation: moment-fade/.test(moments), "page transitions fade (opacity only)");
  check(/const pageEnter = Boolean\(useMomentEnter\("fade"\)\["data-moment-enter"\]\) && !gameScreen/.test(read("src/components/duel/PhoneShell.tsx")), "never on a game screen");
}

/* 5. Phone panel and the finished strip. */
{
  const gfx = read("src/polish-layout/game-fx.css");
  check(/\[data-round-layout\]\[data-phone-status\] \.game-goal-text,\s*\[data-round-layout\]\[data-phone-status\] \[data-goal-progress\],\s*\[data-round-layout\]\[data-phone-status\] \[data-game-stage\] \[data-hud-pills\]\[data-phone-mirrored\] \{\s*visibility: hidden;/.test(gfx), "the board's own figures are hidden only while the phone panel shows them (pills under the board stay)");
  const panel = read("src/components/duel/ArenaGamePanel.tsx");
  check(/export const PHONE_STATUS_MIN_PX = 72;/.test(panel) && /const shown = room >= PHONE_STATUS_MIN_PX;/.test(panel), "the panel shows only where there is room");
  check(/plate\.closest\("\[data-arena\]"\)/.test(panel), "never in the arena (the side panel has it)");
  check(/\[data-frame="puzzle"\] > \.game-frame-header \[data-header-left\] > \[data-finished-ping\] \{\s*inset: auto 12px auto 12px;\s*top: calc\(100% \+ 2px\);/.test(gfx), "a puzzle's finished strip sits under the header (below the timer bar)");
  check(/\[data-frame="arcade"\] > \.game-frame-header \[data-header-left\] > \[data-finished-ping\] \{\s*bottom: 10px;/.test(gfx), "an arcade's strip ends above the bar");
  check(/keep\.push\(box\(el, "timer bar"\)\)/.test(read("scripts/room-extras-check.ts")), "room-extras-check keeps the strip off the timer bar");
}

/* 6. Short phones (15 Nov 2026, Joe): the shared rows go compact so the game's own reveal keeps its size. */
{
  const reveal = read("src/components/duel/AnswerReveal.tsx");
  const gfx = read("src/polish-layout/game-fx.css");
  check(/export const SHORT_REVEAL_QUERY = "\(max-height: 720px\)";/.test(reveal), "short reveals are the 720 px-tall class and below");
  check(/const payoffInline = practice && shortReveal && !\(ARCADE_REVEAL_RENDERERS\[puzzle\.type\] && !PUZZLE_REVEAL_ENGINE_TYPES\.has\(puzzle\.type\)\);/.test(reveal), "only practice's puzzle reveals move their stars (rooms show none; arcade keeps its own layout)");
  check(/answersReady && !payoffInline \? \(\s*<RevealPayoff/.test(reveal), "the stars' own row is left out where they move inline");
  check(/<div data-reveal-lines="" className="reveal-lines shrink-0">\s*\{myScore !== null && answersReady \? \(\s*<RevealPayoff[^]*?\{revealLines\}\s*<\/div>\s*\) : \(\s*revealLines\s*\)\}/.test(reveal), "short: stars, score line and best in one block; tall: the lines exactly as before");
  check(/\.reveal-lines \.fx-star \{\s*width: 18px;\s*height: 18px;/.test(gfx), "the inline stars are smaller");
  check(/@media \(max-height: 720px\) \{[^}]*\[data-answer-reveal\]\[data-answer-reveal\],\s*\[data-answer-reveal\] > \.flex-col \{\s*gap: 6px;/.test(gfx), "the reveal's gaps tighten on short screens");
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL: app-moments-check: ${failures.length} of ${failures.length + passes}`);
  process.exit(1);
}
console.log(`PASS: app-moments-check: varied lightning, room moments, the reveal heading, entrances and app moments, the phone panel, the finished strip and short-phone reveals (${passes} assertions)`);
process.exit(0);
