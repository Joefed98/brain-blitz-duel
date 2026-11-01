/**
 * arcade-standard-check (29 Oct 2026; src/lib/arcade/arcadeStandard.ts, docs/arcade-standard/README.md): the one check
 * for every arcade game on the arcade scoring standard. Each game has an entry in scripts/arcade-standard/<type>.ts
 * (`entry`, the shape in ./arcade-standard/entry.ts); STANDARD_ROSTER below lists every game the standard covers, and
 * a game whose standard revision rooms deal must have one.
 *
 * For every entry:
 *  1. the parts (core first, key "core") have positive whole maximums summing to exactly 200, unique keys, and the
 *     round maximum is 200; where the sim has a spec, it is the entry's (field, rev, parts) and sums to 200, every
 *     part states an item count when any does (each positive);
 *  2. rooms deal the standard's revision (generatePuzzle) and LIVE_BANDS lists it (with the spec where `liveSpec`);
 *     where `before` is given, the standard is the stamp one above it;
 *  3. every perfect run, through the game's real scoring path, scores exactly 200; where it is split into parts, the
 *     parts are the spec's in order, each at its maximum;
 *  4. a run that played but earned nothing scores at least 1 (or exactly its `want`), a run with no input 0;
 *  5. where `help` is given, the "?" help's SCORE text says the parts total 200 and states every part's maximum and
 *     every feature's label (and the entry's own terms);
 *  6. where `core` is given, the core is a straight line: floor(max × min(v, fullAt) ÷ fullAt) for every v up to its
 *     full-at figure (and a little past), no feature points on the way (a finish part allowed from fullAt);
 *  7. where `older` is given, a state on the revision before the standard has no standard parts;
 *  8. the game's own assertions (`extra`).
 * And for the helper: stdLine and stdSpeed are straight lines (each step adds the same points, ± the floor), stdEach
 * pays so much each up to its cap, and stdFinal gives 0 with no input and at least 1 with any.
 *
 *   bun scripts/arcade-standard-check.ts [types…]
 */
import { readdirSync } from "node:fs";
import { STD_MAX, stdEach, stdFinal, stdLine, stdSpecMax, stdSpeed } from "../src/lib/arcade/arcadeStandard";
import { LIVE_BANDS, type LiveBand } from "../src/lib/arcade/liveBands";
import { generatePuzzle } from "../src/lib/duel/generate.server";
import { PUZZLE_INSTRUCTIONS } from "../src/lib/duel/instructions";
import { roundMaxFor } from "../src/lib/duel/roundMax";
import type { PuzzleType } from "../src/lib/duel/types";
import type { StdEntry } from "./arcade-standard/entry";

/**
 * Every game the arcade scoring standard covers, with the stamp that moves it on (batch A, B, C and Grappler's
 * swingRev 15). Once rooms deal that stamp (or later), the game must have an entry; an entry for a game not listed fails.
 */
const STANDARD_ROSTER: readonly { type: string; field: string; rev: number; batch: string }[] = [
  { type: "slice", field: "sliceRev", rev: 11, batch: "A" },
  { type: "breaker", field: "brkRev", rev: 11, batch: "A" },
  { type: "tilt", field: "tiltRev", rev: 10, batch: "A" },
  { type: "burst", field: "burstRev", rev: 10, batch: "A" },
  { type: "matchup", field: "matchupRev", rev: 11, batch: "A" },
  { type: "snake", field: "snakeRev", rev: 11, batch: "A" },
  { type: "hover", field: "hoverRev", rev: 10, batch: "A" },
  { type: "skyline", field: "skylineRev", rev: 9, batch: "B" },
  { type: "bintoss", field: "binRev", rev: 9, batch: "B" },
  { type: "bullseye", field: "bullRev", rev: 9, batch: "B" },
  { type: "pinball", field: "pinRev", rev: 6, batch: "B" },
  { type: "rally", field: "rallyRev", rev: 12, batch: "B" },
  { type: "bubble", field: "bubbleRev", rev: 11, batch: "B" },
  { type: "beat", field: "beatRev", rev: 11, batch: "B" },
  { type: "cross", field: "crossRev", rev: 10, batch: "C" },
  { type: "wavefront", field: "wavRev", rev: 12, batch: "C" },
  { type: "flip", field: "flipRev", rev: 10, batch: "C" },
  { type: "inkbridge", field: "inkRev", rev: 12, batch: "C" },
  { type: "orbit", field: "orbitRev", rev: 13, batch: "C" },
  { type: "balltrack", field: "btRev", rev: 8, batch: "C" },
  { type: "swing", field: "swingRev", rev: 15, batch: "D" },
  // Cards & Board (30 Oct 2026): born on the standard (their first revision).
  { type: "minesweeper", field: "minesRev", rev: 1, batch: "Cards & Board" },
  { type: "mahjong", field: "mahjongRev", rev: 2, batch: "Cards & Board" },
  // The Sports group (30 Oct 2026): new games born on the standard (rev 1).
  // Home Run deals homerunRev 3 since 1 Nov 2026 (the swing choice and the pitcher's tell; the same three parts).
  { type: "homerun", field: "homerunRev", rev: 3, batch: "Sports" },
  { type: "freekick", field: "freekickRev", rev: 3, batch: "Sports" },
  // Apex (racing) deals racingRev 2 since 31 Oct 2026 (the lights start, the softer joystick; the same four parts).
  { type: "racing", field: "racingRev", rev: 2, batch: "Sports" },
  // Cards & Board (30 Oct 2026): born on the standard at revision 1.
  // Free Cell's rev 2 (Undo and Reset) and Full House's rev 2 (full at the elite median), 31 Oct 2026: still on the standard.
  { type: "freecell", field: "freecellRev", rev: 2, batch: "Cards" },
  { type: "tripeaks", field: "tripeaksRev", rev: 1, batch: "Cards" },
  { type: "pokersquares", field: "pokerSquaresRev", rev: 2, batch: "Cards" },
  // Five Hands (31 Oct 2026): born on the standard.
  { type: "fivehands", field: "fiveHandsRev", rev: 1, batch: "Cards" },
  // The Sports group (30 Oct 2026): on the standard from their first stamp.
  { type: "minigolf", field: "golfRev", rev: 2, batch: "Sports" }, // golfRev 2 (crazy golf, 31 Oct 2026); golfRev 1 was on the standard too
  { type: "pool", field: "poolRev", rev: 2, batch: "Sports" },
  // Curling deals curlRev 2 since 31 Oct 2026 (the start along the hog line, side brushing; the same parts) and
  // curlRev 3 since 1 Nov 2026 (the weight meter's draw zone, the aim line, a gentler weight line, the core re-fitted).
  { type: "curling", field: "curlRev", rev: 3, batch: "Sports" },
];

const only = process.argv.slice(2).filter((a) => !a.startsWith("--"));
let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}

/* The helper's lines. */
for (const [max, of] of [[150, 90], [140, 10], [130, 7], [30, 20], [20, 6], [15, 4], [10, 8], [8, 16]] as const) {
  ok(stdLine(max, 0, of) === 0 && stdLine(max, of, of) === max && stdLine(max, of + 5, of) === max, `stdLine(${max}, ·, ${of}): 0 at 0, ${max} at ${of} and beyond`);
  for (let g = 1; g <= of; g++) {
    const step = stdLine(max, g, of) - stdLine(max, g - 1, of);
    ok(Math.abs(step - max / of) < 1, `stdLine(${max}, ${g}, ${of}): each step adds about ${(max / of).toFixed(2)} (${step})`);
  }
}
ok(stdLine(50, 3, 0) === 0 && stdLine(50, -2, 10) === 0, "stdLine: 0 with no items and for a negative count");
ok(stdSpeed(10, 20, 20, 40) === 10 && stdSpeed(10, 40, 20, 40) === 0 && stdSpeed(10, 30, 20, 40) === 5 && stdSpeed(10, 10, 20, 40) === 10, "stdSpeed: full at the full mark, 0 at the zero mark, even between (time taken)");
ok(stdSpeed(20, 45, 45, 0) === 20 && stdSpeed(20, 0, 45, 0) === 0 && stdSpeed(20, 30, 45, 0) === 13, "stdSpeed: time left");
ok(stdEach(0, 6, 36) === 0 && stdEach(4, 6, 36) === 24 && stdEach(9, 6, 36) === 36 && stdEach(-1, 6, 36) === 0, "stdEach: so much each, up to the cap");
ok(stdFinal(0, false) === 0 && stdFinal(150, false) === 0 && stdFinal(0, true) === 1 && stdFinal(-8, true) === 1 && stdFinal(137, true) === 137 && stdFinal(230, true) === STD_MAX, "stdFinal: 0 with no input, else 1…200");

const dir = new URL("./arcade-standard/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".ts") && f !== "entry.ts").sort();
const entries: StdEntry[] = [];
for (const f of files) {
  const e = ((await import(new URL(f, dir).href)) as { entry?: StdEntry }).entry;
  ok(!!e && f === `${e.type}.ts`, `${f}: exports \`entry\` for its own game`);
  if (e) entries.push(e);
}

/* The roster: every game dealt on its standard revision has an entry; every entry is on the roster. */
const have = new Set(entries.map((e) => e.type));
let onStandard = 0;
for (const r of STANDARD_ROSTER) {
  const dealt = (generatePuzzle(r.type as PuzzleType) as unknown as Record<string, unknown>)[r.field];
  const live = typeof dealt === "number" && dealt >= r.rev;
  if (live) onStandard++;
  ok(!live || have.has(r.type), `${r.type} (batch ${r.batch}): rooms deal ${r.field} ${String(dealt)}, so it needs an entry in scripts/arcade-standard/`);
  ok(!have.has(r.type) || live, `${r.type} (batch ${r.batch}): has an entry but rooms deal ${r.field} ${String(dealt)}, not the standard's ${r.rev}`);
}
for (const e of entries) {
  const r = STANDARD_ROSTER.find((x) => x.type === e.type);
  ok(!!r, `${e.type}: on STANDARD_ROSTER`);
  ok(!r || (r.field === e.field && r.rev === e.rev), `${e.type}: the roster's ${r?.field} ${r?.rev} is the entry's ${e.field} ${e.rev}`);
}

const summary: string[] = [];
for (const e of entries) {
  if (only.length && !only.includes(e.type)) continue;
  const t = e.type;
  const t0 = Date.now();

  /* 1. The parts. */
  const sum = stdSpecMax(e.parts);
  ok(sum === STD_MAX, `${t}: the parts' maximums sum to ${STD_MAX} (${sum})`);
  ok(e.parts[0]?.key === "core", `${t}: the first part is the core (key "core", got ${e.parts[0]?.key})`);
  ok(e.parts.every((p) => Number.isInteger(p.max) && p.max > 0), `${t}: every part's maximum is a positive whole number`);
  ok(new Set(e.parts.map((p) => p.key)).size === e.parts.length, `${t}: part keys are unique`);
  ok(roundMaxFor(t as PuzzleType) === STD_MAX, `${t}: the round maximum is ${STD_MAX}`);
  if (e.parts.some((p) => p.of !== undefined)) {
    ok(e.parts.every((p) => p.of !== undefined && p.of > 0), `${t}: every part has a positive item count`);
  }
  if (e.spec) {
    ok(stdSpecMax(e.spec) === STD_MAX, `${t}: the sim's spec sums to ${STD_MAX} (${stdSpecMax(e.spec)})`);
    ok(e.spec.field === e.field && e.spec.rev === e.rev, `${t}: the sim's spec is ${e.spec.field} ${e.spec.rev}, the entry ${e.field} ${e.rev}`);
    ok(JSON.stringify(e.spec.parts.map((p) => [p.key, p.max])) === JSON.stringify(e.parts.map((p) => [p.key, p.max])), `${t}: the entry's parts are the sim's spec`);
  }

  /* 2. The stamp. */
  const dealt = (generatePuzzle(t as PuzzleType) as unknown as Record<string, unknown>)[e.field];
  ok(dealt === e.rev, `${t}: rooms deal ${e.field} ${e.rev} (got ${String(dealt)})`);
  const live = (LIVE_BANDS as Record<string, LiveBand>)[t];
  ok(live?.field === e.field && live.rev === e.rev, `${t}: LIVE_BANDS lists ${e.field} ${e.rev} (has ${live?.field} ${live?.rev})`);
  if (e.liveSpec) ok((live as { std?: unknown } | undefined)?.std === e.spec, `${t}: LIVE_BANDS carries the standard spec`);
  if (e.before !== undefined) ok(e.rev === e.before + 1, `${t}: ${e.field} ${e.rev} is one above the stamp dealt before it (${e.before})`);

  /* 3. Perfect runs. */
  const perfect = await e.perfect();
  ok(perfect.length > 0, `${t}: at least one perfect run`);
  for (const r of perfect) {
    ok(r.score === STD_MAX, `${t}: perfect run (${r.label}) scores ${STD_MAX} (got ${r.score})`);
    if (r.parts) {
      ok(JSON.stringify(Object.keys(r.parts)) === JSON.stringify(e.parts.map((p) => p.key)), `${t}: perfect run (${r.label})'s parts are the spec's, in order (${Object.keys(r.parts).join(", ")})`);
      for (const p of e.parts) ok(r.parts[p.key] === p.max, `${t}: perfect run (${r.label})'s ${p.key} is its maximum ${p.max} (got ${r.parts[p.key]})`);
    }
    if (r.partMaxes) for (const p of e.parts) ok(r.partMaxes[p.key] === p.max, `${t}: perfect run (${r.label})'s ${p.key} states the maximum ${p.max} (${r.partMaxes[p.key]})`);
  }

  /* 4. Played and idle runs. */
  if (e.played) {
    const played = await e.played();
    ok(played.length > 0, `${t}: at least one played run that earned nothing`);
    for (const r of played) {
      if (r.want !== undefined) ok(r.score === r.want, `${t}: ${r.label} scores ${r.want} (got ${r.score})`);
      else ok(r.score >= 1, `${t}: ${r.label} played and scores at least 1 (got ${r.score})`);
    }
  }
  if (e.idle) {
    const idle = await e.idle();
    ok(idle.length > 0, `${t}: at least one run with no input`);
    for (const r of idle) ok(r.score === 0, `${t}: ${r.label} had no input and scores 0 (got ${r.score})`);
  }

  /* 5. The help. */
  if (e.help) {
    const help = PUZZLE_INSTRUCTIONS[t as PuzzleType]?.score ?? "";
    ok(help.includes(`total ${STD_MAX}`), `${t}: the help says the parts total ${STD_MAX}: ${help}`);
    for (const p of e.parts) ok(help.includes(String(p.max)), `${t}: the help states ${p.label}'s maximum ${p.max}`);
    for (const p of e.parts.slice(1)) ok(help.includes(p.label), `${t}: the help names ${p.label}`);
    for (const term of e.help.terms ?? []) ok(help.includes(term), `${t}: the help says "${term}"`);
  }

  /* 6. The core's straight line. */
  if (e.core) {
    const coreMax = e.parts[0]!.max;
    const { fullAt, at, parts: partsOf } = e.core;
    const finish = new Set(e.core.finishParts ?? []);
    let lineOk = true;
    for (let v = 0; v <= fullAt + 3; v++) {
      const parts = partsOf(at(v));
      const core = parts?.find((p) => p.key === "core");
      const want = Math.floor((coreMax * Math.min(v, fullAt)) / fullAt);
      if (!core || core.points !== want) {
        lineOk = false;
        failures.push(`${t}: core at ${v} is ${core?.points ?? "missing"}, the straight line gives ${want}`);
        break;
      }
      const features = parts!.filter((p) => p.key !== "core" && (v < fullAt || !finish.has(p.key))).reduce((a, p) => a + p.points, 0);
      if (features !== 0) {
        lineOk = false;
        failures.push(`${t}: a core-only state at ${v} earned ${features} feature points`);
        break;
      }
    }
    ok(lineOk, `${t}: the core is a straight line to ${coreMax} at ${fullAt}`);
  }

  /* 7. Older revisions. */
  if (e.older) ok(e.older(), `${t}: a state on the revision before the standard has no standard parts`);

  /* 8. The game's own. */
  await e.extra?.(ok);

  summary.push(`${t} ${e.field} ${e.rev}: ${e.parts.map((p) => `${p.key} ${p.max}`).join(" + ")} = ${sum}`);
  console.log(`  ${t} ${e.field} ${e.rev}: ${e.parts.map((p) => `${p.label} ${p.max}`).join(" + ")} = ${sum}; ${perfect.length} perfect run(s) (${Date.now() - t0} ms)`);
}

if (failures.length) {
  for (const f of failures) console.log(`  - ${f}`);
  console.log(`FAIL arcade-standard-check: ${failures.length} of ${checks} checks failed`);
  process.exit(1);
}
console.log(
  `PASS arcade-standard-check: ${checks} checks — ${summary.length} of ${STANDARD_ROSTER.length} rostered games on the standard (${onStandard} dealt on it), each core + features = ${STD_MAX} and a perfect run 200; the helper's lines straight`,
);
