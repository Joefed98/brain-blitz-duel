/**
 * minigolf-sync-check (Crazy Golf, phase 2 step 4, 15 Nov 2026): the phone's run and the server's replay of it agree
 * exactly, shot for shot, on every hole.
 *
 * The phone records a run as the live stage does (scripts/minigolf-sync/phone.ts: a putt recorded on the next sim
 * tick, the sim stepped from the log, a checkpoint every 300 ticks); the server replays the answer
 * (replayMinigolfRun, the grader's own path). For every case the check requires:
 *
 *  1. Bun = server: the replay is not flagged, finds no desync, reaches the phone's tick, scores the phone's score,
 *     and makes exactly the phone's checkpoint checksums, tick for tick;
 *  2. Chromium (V8, the phone's browser engine and the Worker's) = Bun (JavaScriptCore): the same cases run inside a
 *     browser page record byte-for-byte the same answers (events, checkpoints, end tick, claimed score);
 *  3. coverage: the cases between them roll every hole of golfRev 1 and golfRev 2 and include bank shots (rails and
 *     logs), slopes, hills, sand, tunnels, the windmills' doorways, water, putts that drop (lip-ins at the cup's capture speed), slow rolls, every witness's
 *     200-point route and time-out cuts;
 *  4. a replay of an answer with no run in it (an empty answer, a draft made before the first tick) prints no
 *     "client/server desync" line and scores 0, not flagged (empty Sports runs score 0, 15 Nov 2026);
 *  5. golfRev 3 (the Crazy Golf overhaul, 15 Nov 2026): every hole in the proven hole bank is rolled at every level
 *     (Easy's slow sails, Normal and Hard, Expert's fast ones), with putts and lofted chips (chips over water, sand
 *     and low walls, chips into water and sand, chips off the fence and through the windmills), rolls over the
 *     swells of the last two holes, loop-the-loops gone round and stalled in, bridges crossed, bowls, the composed
 *     witnesses' 200-point routes and time-out cuts, all identical phone to server and Bun to Chromium.
 *
 *   bun scripts/minigolf-sync-check.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { decodeInputEvents, fp, type ArcadeInputEvent } from "../src/lib/arcade/engine";
import { minigolfGameFor, MG_ROLL, MINIGOLF_HOLES, type MinigolfState } from "../src/lib/arcade/minigolf";
import { decodeSportsRun, ilen } from "../src/lib/arcade/sportsKit";
import { replayMinigolfRun } from "../src/lib/duel/minigolf";
import { MINIGOLF_BANK } from "../src/lib/duel/minigolfBank.server";
import { MINIGOLF_BANK_V2 } from "../src/lib/duel/minigolfBankV2.server";
import { MINIGOLF_HOLES_BANK } from "../src/lib/duel/minigolfHolesBank.server";
import { MG_LEVEL_NAMES, type MgLevel } from "../src/lib/arcade/minigolf";
import { playCourseV3, WITNESS_FILE, type WitnessFile } from "./minigolf-holes-bank";
import { phoneRuns, type PhoneRun, type ShotPlan, type SyncCase } from "./minigolf-sync/phone";

const failures: string[] = [];
const fail = (msg: string) => {
  if (failures.length < 40) console.log(`  FAIL ${msg}`);
  failures.push(msg);
};
const ok = (cond: boolean, msg: string) => {
  if (!cond) fail(msg);
};

/* ------------------------------------------------------------------ the cases */

const witness1 = JSON.parse(readFileSync(new URL("./fixtures/minigolf-witness.json", import.meta.url), "utf8")) as Record<string, string>;
const witness2 = JSON.parse(readFileSync(new URL("./fixtures/minigolf-witness-v2.json", import.meta.url), "utf8")) as Record<string, string>;

const cases: SyncCase[] = [];
let n = 0;
const add = (c: Omit<SyncCase, "name">) => cases.push({ ...c, name: `${c.plan} rev${c.rev} ${c.seed} #${n++}${c.cut ? ` cut@${c.cut}` : ""}` });
const cutOf = (i: number) => 600 + ((i * 2654435761) >>> 0) % 6000;
const PLANS: ShotPlan[] = ["random", "aim", "slow", "bank"];

MINIGOLF_BANK_V2.forEach((e, i) => {
  for (const plan of PLANS) add({ seed: e.seed, pars: [...e.pars], rev: 2, plan, rng: 0x5eed + i * 31 + plan.length, cut: 0 });
  add({ seed: e.seed, pars: [...e.pars], rev: 2, plan: "random", rng: 0xc0ffee + i, cut: cutOf(i) });
  if (i % 4 === 0) add({ seed: e.seed, pars: [...e.pars], rev: 2, plan: "ace", rng: 0xace + i, cut: 0 });
  const w = witness2[String(e.seed)];
  if (w) {
    const events = decodeSportsRun(w, 7200).events;
    add({ seed: e.seed, pars: [...e.pars], rev: 2, plan: "witness", rng: 0, cut: 0, events });
    add({ seed: e.seed, pars: [...e.pars], rev: 2, plan: "witness", rng: 0, cut: 150 + (i * 97) % 1200, events });
  }
});
MINIGOLF_BANK.forEach((e, i) => {
  if (i % 3 === 0) for (const plan of (i % 12 === 0 ? ["random", "aim", "ace"] : ["random", "aim"]) as ShotPlan[]) add({ seed: e.seed, pars: [...e.pars], rev: 1, plan, rng: 0xbeef + i, cut: 0 });
  const w = witness1[String(e.seed)];
  if (w && i % 2 === 0) add({ seed: e.seed, pars: [...e.pars], rev: 1, plan: "witness", rng: 0, cut: 0, events: decodeSportsRun(w, 7200).events });
});

// golfRev 3: course j holds each slot's hole j (so every bank hole is rolled), at each level in turn; every plan,
// chips included, and the composed witnesses on every level.
const witness3 = JSON.parse(readFileSync(WITNESS_FILE, "utf8")) as WitnessFile;
const SLOT_MAX = Math.max(...MINIGOLF_HOLES_BANK.map((slot) => slot.length));
const PLANS3: ShotPlan[] = ["random", "aim", "chip", "bank", "slow", "chip"];
const v3Pars = (holes: number[], level: MgLevel) => holes.map((id, i) => MINIGOLF_HOLES_BANK[i]!.find((e) => e.id === id)!.pars[MG_LEVEL_NAMES.indexOf(level)]!);
for (let j = 0; j < SLOT_MAX; j++) {
  const holes = MINIGOLF_HOLES_BANK.map((slot) => slot[j % slot.length]!.id);
  const level = MG_LEVEL_NAMES[j % 4]!;
  const pars = v3Pars(holes, level);
  const seed = 9000 + j;
  add({ seed, pars, rev: 3, plan: PLANS3[j % PLANS3.length]!, rng: 0x3a11 + j, cut: 0, holes, level });
  add({ seed, pars, rev: 3, plan: PLANS3[(j + 3) % PLANS3.length]!, rng: 0x3b22 + j, cut: j % 3 === 0 ? cutOf(j) % 5000 : 0, holes, level });
  if (j % 3 === 0) add({ seed, pars, rev: 3, plan: "ace", rng: 0x3c33 + j, cut: 0, holes, level });
  if (j % 2 === 0)
    for (const lv of MG_LEVEL_NAMES) {
      const pl = v3Pars(holes, lv);
      const events = playCourseV3(holes, pl, lv, witness3).events;
      add({ seed, pars: pl, rev: 3, plan: "witness", rng: 0, cut: 0, events, holes, level: lv });
    }
}

// golfRev 3's loops: every loop hole at Normal and Expert on the "loop" plan (rolled at the loop's mouth, soft to hard).
for (const slot of [0, 1, 2, 3, 4]) {
  MINIGOLF_HOLES_BANK[slot]!.filter((e) => e.id % 6 === 0).forEach((e, k) => {
    const holes = MINIGOLF_HOLES_BANK.map((sl, i) => (i === slot ? e.id : sl[0]!.id));
    for (const level of ["normal", "expert"] as const) {
      // The plan rolls at the loop on its hole and plays at random on the others.
      add({ seed: 9500 + slot * 100 + k, pars: v3Pars(holes, level), rev: 3, plan: "loop", rng: 0x700 + slot * 31 + k, cut: 0, holes, level });
    }
  });
}

/* ------------------------------------------------- 1. the phone in Bun vs the server */

const started = Date.now();
const bun = phoneRuns(cases);
const byName = new Map(bun.map((r) => [r.name, r]));
let agreed = 0;
for (let i = 0; i < cases.length; i++) {
  const c = cases[i]!;
  const p = bun[i]!;
  const r = replayMinigolfRun(c.seed, p.answer, c.pars, c.rev, { holes: c.holes, level: c.level });
  const serverSums = r.checkpoints.map((cp) => cp.checksum >>> 0);
  const same =
    !r.flagged &&
    r.desyncTick === null &&
    r.score === p.score &&
    r.replayTick === p.tick &&
    serverSums.length === p.sums.length &&
    serverSums.every((s, k) => s === p.sums[k]);
  if (same) agreed++;
  else
    fail(
      `${c.name}: phone ${p.score} at tick ${p.tick} (${p.sums.length} checkpoints) vs server ${r.score} at ${r.replayTick} ` +
        `(${serverSums.length}), flagged ${r.flagged}, desync ${r.desyncTick}, ${r.reason ?? ""}`,
    );
}
ok(agreed === cases.length, `every phone run replays identically on the server (${agreed} of ${cases.length})`);

/* ------------------------------------------------------------------- 3. coverage */

interface Seen {
  holes: Set<string>;
  bank: number;
  slope: number;
  hill: number;
  sand: number;
  tunnel: number;
  mill: number;
  water: number;
  dropped: number;
  slow: number;
  witness: number;
  cut: number;
  /** golfRev 3: chips flown, chips over water and over sand, chips landing in water and stopped in sand, chips meeting the fence or a sail, rolls over swells. */
  chip: number;
  chipOverWater: number;
  chipOverSand: number;
  chipWet: number;
  chipSand: number;
  chipBank: number;
  swell: number;
  /** golfRev 3's crazy-golf pieces: loops gone round, loops rolled back out of, bridges crossed, bowls rolled through. */
  loop: number;
  loopBack: number;
  bridge: number;
  bowl: number;
}
const seen: Seen = { holes: new Set(), bank: 0, slope: 0, hill: 0, sand: 0, tunnel: 0, mill: 0, water: 0, dropped: 0, slow: 0, witness: 0, cut: 0, chip: 0, chipOverWater: 0, chipOverSand: 0, chipWet: 0, chipSand: 0, chipBank: 0, swell: 0, loop: 0, loopBack: 0, bridge: 0, bowl: 0 };
const seenIds = new Set<string>();

/** Steps the server's game over a run and notes what its rolls went through (observation only). */
function observe(c: SyncCase, p: PhoneRun) {
  const game = minigolfGameFor(c.pars, c.rev, { holes: c.holes, level: c.level });
  const events = new Map<number, ArcadeInputEvent>(decodeInputEvents(p.answer.split("|")[2] ?? "").map((e) => [e.t, e]));
  let s: MinigolfState = game.init(c.seed);
  let slowPutt = false;
  const flags = { bank: false, slope: false, hill: false, sand: false, tunnel: false, mill: false, water: false, one: false, slow: false, chip: false, chipOverWater: false, chipOverSand: false, chipWet: false, chipSand: false, chipBank: false, swell: false, loop: false, loopBack: false, bridge: false, bowl: false };
  while (!game.isOver(s) && s.tick < p.tick) {
    const prev = s;
    const ev = events.get(s.tick + 1) ?? null;
    s = game.step(s, ev);
    if (prev.phase !== MG_ROLL && s.phase === MG_ROLL) slowPutt = (ev?.c ?? 999) <= 120;
    if (s.phase === MG_ROLL || prev.phase === MG_ROLL) {
      const h = s.course[prev.hole]!;
      seen.holes.add(`rev${c.rev}:${prev.hole}`);
      if (c.rev >= 3) {
        seenIds.add(`${h.holeId}:${c.level}`);
        const flying = prev.air > 0;
        if (flying) {
          flags.chip = true;
          if (h.ponds.some((pd) => ilen(s.x - pd.x, s.y - pd.y) < pd.r - fp(2))) flags.chipOverWater = true;
          if ((h.sands ?? []).some((sd) => ilen(s.x - sd.x, s.y - sd.y) < sd.r) && s.air > 0) flags.chipOverSand = true;
          if (s.bounces > prev.bounces) flags.chipBank = true;
          if (s.waters > prev.waters) flags.chipWet = true;
          if (s.sandStops > prev.sandStops) flags.chipSand = true;
        }
        if (!flying && (h.swells ?? []).some((w) => !w.bowl && ilen(s.x - w.x, s.y - w.y) < w.r)) flags.swell = true;
        if (!flying && (h.swells ?? []).some((w) => w.bowl && ilen(s.x - w.x, s.y - w.y) < w.r)) flags.bowl = true;
        if (s.loops > prev.loops) flags.loop = true;
        if (s.loopBacks > prev.loopBacks) flags.loopBack = true;
        if (!flying && (h.bridges ?? []).some((b) => s.x >= b.x0 && s.x <= b.x1 && s.y >= b.y0 && s.y <= b.y1)) flags.bridge = true;
      }
      if (s.bounces > prev.bounces) flags.bank = true;
      if (s.waters > prev.waters) flags.water = true;
      if (s.tunnels > prev.tunnels) flags.tunnel = true;
      if (h.slopes.some((r) => s.x >= r.x0 && s.x <= r.x1 && s.y >= r.y0 && s.y <= r.y1)) flags.slope = true;
      if ((h.hills ?? []).some((hl) => ilen(s.x - hl.x, s.y - hl.y) < hl.r)) flags.hill = true;
      if ((h.sands ?? []).some((sd) => ilen(s.x - sd.x, s.y - sd.y) < sd.r)) flags.sand = true;
      for (const m of h.windmills ?? []) {
        const across = m.across ? s.y - m.y : s.x - m.x;
        const along = m.across ? s.x - m.x : s.y - m.y;
        if (Math.abs(across) < fp(12) && Math.abs(along) < fp(42)) flags.mill = true;
      }
      if (prev.phase === MG_ROLL && s.phase !== MG_ROLL && s.holed[prev.hole] === 1) flags.one = true;
      if (prev.phase === MG_ROLL && s.phase !== MG_ROLL && slowPutt) flags.slow = true;
    }
  }
  if (flags.bank) seen.bank++;
  if (flags.slope) seen.slope++;
  if (flags.hill) seen.hill++;
  if (flags.sand) seen.sand++;
  if (flags.tunnel) seen.tunnel++;
  if (flags.mill) seen.mill++;
  if (flags.water) seen.water++;
  if (flags.one) seen.dropped++;
  if (flags.slow) seen.slow++;
  for (const k of ["chip", "chipOverWater", "chipOverSand", "chipWet", "chipSand", "chipBank", "swell", "loop", "loopBack", "bridge", "bowl"] as const) if (flags[k]) seen[k]++;
  if (c.plan === "witness") seen.witness++;
  if (c.cut > 0) seen.cut++;
}
cases.forEach((c, i) => observe(c, bun[i]!));
for (const rev of [1, 2, 3]) for (let h = 0; h < MINIGOLF_HOLES; h++) ok(seen.holes.has(`rev${rev}:${h}`), `a roll on golfRev ${rev}'s hole ${h + 1}`);
// golfRev 3: every bank hole rolled, and at each level every hole with a windmill (its sails turn at the level's speed).
{
  const missing = MINIGOLF_HOLES_BANK.flat().filter((e) => !MG_LEVEL_NAMES.some((lv) => seenIds.has(`${e.id}:${lv}`)));
  ok(missing.length === 0, `golfRev 3: every bank hole rolled (${MINIGOLF_HOLES_BANK.flat().length - missing.length} of ${MINIGOLF_HOLES_BANK.flat().length}; missing ${missing.slice(0, 5).map((e) => e.id).join(", ")})`);
  for (const lv of MG_LEVEL_NAMES) ok([...seenIds].some((k) => k.endsWith(`:${lv}`)), `golfRev 3: rolls at ${lv}`);
}
const want: [keyof Omit<Seen, "holes">, number, string][] = [
  ["bank", 100, "bank shots (a rail, log, rock or planter hit)"],
  ["slope", 20, "rolls over a slope"],
  ["hill", 20, "rolls over a hill"],
  ["sand", 20, "rolls through sand"],
  ["tunnel", 20, "tunnels ridden"],
  ["mill", 40, "rolls through a windmill's doorway"],
  ["water", 20, "balls in the water"],
  ["dropped", 100, "putts that drop in the cup"],
  ["slow", 50, "slow rolls"],
  ["witness", 60, "witness routes"],
  ["cut", 60, "time-out cuts"],
  ["chip", 100, "golfRev 3 chips flown"],
  ["chipOverWater", 20, "chips carried over water"],
  ["chipOverSand", 10, "chips carried over sand"],
  ["chipWet", 10, "chips landing in water"],
  ["chipSand", 5, "chips stopped dead in sand"],
  ["chipBank", 20, "chips off the fence, a gate or a sail"],
  ["swell", 60, "rolls over the last holes' swells"],
  ["loop", 20, "loop-the-loops gone round"],
  ["loopBack", 10, "loops stalled in and rolled back out of"],
  ["bridge", 20, "bridges crossed"],
  ["bowl", 60, "rolls through a bowl round the cup"],
];
for (const [key, min, what] of want) ok(seen[key] >= min, `coverage: ${seen[key]} runs with ${what} (want ${min}+)`);

/* --------------------------------------------- 2. the same runs inside Chromium (V8) */

const CHROMIUM = [process.env["PLAYWRIGHT_CHROMIUM"], "/opt/pw-browsers/chromium", "/usr/bin/chromium"].find((p) => p && existsSync(p));
const built = await Bun.build({ entrypoints: [new URL("./minigolf-sync/phone.ts", import.meta.url).pathname], target: "browser", format: "esm" });
if (!built.success || !built.outputs[0]) fail(`bundle: ${built.logs.map((l) => l.message).join("; ")}`);
else {
  const code = (await built.outputs[0].text()).replace(/^export\s*\{([^}]*)\};?\s*$/m, (_m, names: string) => {
    const pairs = names.split(",").map((part) => part.trim().split(/\s+as\s+/));
    return `globalThis.__mgSync = { ${pairs.map(([local, exported]) => `${exported ?? local}: ${local}`).join(", ")} };`;
  });
  const { chromium } = await import("playwright");
  const browser = await chromium.launch(CHROMIUM ? { executablePath: CHROMIUM } : {});
  try {
    const page = await browser.newPage();
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(String(e.message ?? e)));
    await page.setContent("<!doctype html><title>minigolf sync</title>");
    await page.addScriptTag({ content: code });
    const v8 = (await page.evaluate((cs) => (globalThis as unknown as { __mgSync: { phoneRuns: (c: unknown) => unknown } }).__mgSync.phoneRuns(cs), cases)) as PhoneRun[];
    ok(errors.length === 0, `no page errors in Chromium (${errors[0] ?? ""})`);
    ok(v8.length === cases.length, `Chromium ran every case (${v8.length} of ${cases.length})`);
    let same = 0;
    for (const r of v8) {
      const b = byName.get(r.name);
      if (b && b.answer === r.answer) same++;
      else if (b) fail(`${r.name}: Chromium recorded a different run from Bun (tick ${r.tick} vs ${b.tick}, score ${r.score} vs ${b.score})`);
    }
    ok(same === cases.length, `Chromium (V8) and Bun record byte-for-byte the same answers (${same} of ${cases.length})`);
    // The browser's answers through the server's replay too (identical strings, so this is belt and braces).
    let replayed = 0;
    v8.forEach((r, i) => {
      const c = cases[i]!;
      const s = replayMinigolfRun(c.seed, r.answer, c.pars, c.rev, { holes: c.holes, level: c.level });
      if (!s.flagged && s.desyncTick === null && s.score === r.score) replayed++;
    });
    ok(replayed === cases.length, `every Chromium run replays identically on the server (${replayed} of ${cases.length})`);
  } finally {
    await browser.close();
  }
}

/* ------------------------------------------------- 4. answers with no run in them */

{
  const e = MINIGOLF_BANK_V2[0]!;
  const original = console.error;
  const lines: string[] = [];
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  let results: ReturnType<typeof replayMinigolfRun>[] = [];
  try {
    results = ["", null, `${e.seed}|0||0|`].map((a) => replayMinigolfRun(e.seed, a as string, e.pars, 2));
  } finally {
    console.error = original;
  }
  ok(!lines.some((l) => l.includes("desync")), `no "client/server desync" line for an answer with no run in it (${lines.length} printed)`);
  // Changed with Joe's approval, 15 Nov 2026 (empty Sports runs score 0): was "flagged, the first unmatched checkpoint
  // at tick 300".
  ok(
    results.every((r) => r.score === 0 && !r.flagged && r.desyncTick === null && r.replayTick === 7200),
    "an answer with no run in it scores 0, not flagged, no mismatch",
  );
  // A real disagreement is still logged: one checkpoint changed in a played run.
  const p = bun.find((r) => r.sums.length > 2)!;
  const c = cases[bun.indexOf(p)]!;
  const parts = p.answer.split("|");
  const cps = parts[4]!.split(",");
  const [t, sum] = cps[1]!.split(":");
  cps[1] = `${t}:${(Number(sum) ^ 1) >>> 0}`;
  parts[4] = cps.join(",");
  lines.length = 0;
  console.error = (...args: unknown[]) => {
    lines.push(args.map(String).join(" "));
  };
  let tampered: ReturnType<typeof replayMinigolfRun>;
  try {
    tampered = replayMinigolfRun(c.seed, parts.join("|"), c.pars, c.rev, { holes: c.holes, level: c.level });
  } finally {
    console.error = original;
  }
  ok(tampered.flagged && tampered.desyncTick === Number(t), `a changed checkpoint is still caught at its tick (${tampered.desyncTick})`);
  ok(lines.some((l) => l.includes("[minigolf] client/server desync")), "and still logged as a desync");
}

const secs = ((Date.now() - started) / 1000).toFixed(1);
if (failures.length) {
  console.log(`FAIL: minigolf-sync: ${failures.length} problem(s)`);
  process.exit(1);
}
console.log(
  `PASS: minigolf-sync: ${cases.length} runs (${Object.entries(seen)
    .filter(([k]) => k !== "holes")
    .map(([k, v]) => `${k} ${v}`)
    .join(", ")}; every hole of golfRev 1 and 2, every golfRev 3 bank hole at every level) recorded as the phone records them replay identically on the server, ` +
    `checkpoint for checkpoint; Chromium (V8) and Bun record the same answers byte for byte; an answer with no run in it ` +
    `logs no desync and scores 0, not flagged (${secs} s).`,
);
