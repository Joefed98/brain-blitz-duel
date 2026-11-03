/**
 * curling-check (the Sports group, 30 Oct 2026; docs/arcade-standard/curling.md): Curling curlRev 1 and curlRev 2.
 *
 * curlRev 1 (as before):
 *  - the bank: every sheet's witness (scripts/fixtures/curling-witness.json) scores exactly 200 through the server's
 *    replay, unflagged: eight stones each at rest on the button when thrown, every opponent stone out of the house,
 *    holding shot;
 *  - the sheets: two or three opponent stones in the house, apart, the same seed placing the same stones;
 *  - the rules: a throw while a stone travels does nothing; a stone too light to pass the far hog line is removed;
 *    sweeping carries a stone further; no input scores 0, any throw 1+;
 *  - determinism and input repair;
 *  - legacy identity (31 Oct 2026): 24 runs recorded on the tree before curlRev 2 (scripts/fixtures/curling-v1-legacy.json,
 *    scripts/curling-v1-legacy-record.ts; with sweeping) replay on curlRev 1 to the stored score, unflagged.
 * curlRev 2 (31 Oct 2026, Joe's notes: the start along the hog line, side brushing; checked as CURLING_REV_V2 since curlRev 3):
 *  - the bank (src/lib/duel/curlingBankV2.server.ts): every witness (scripts/fixtures/curling-witness-v2.json) scores
 *    exactly 200 through replayCurlingRun(…, 2), unflagged, eight on the button, every opponent out, holding shot; rooms
 *    deal only its sheets on curlRev 2;
 *  - the rules: the stone starts where it was slid to on the hog line (± CURL_START_MAX, an out-of-range start clamped
 *    and flagged); brushing its left bends it left and its right bends it right; brushing carries it further; brushing
 *    no longer halves the curl; with no brushing it slides exactly as on curlRev 1; no input scores 0, any throw 1+;
 *  - a curlRev 1 log is not a curlRev 2 run (its checkpoints carry the old checksum), and stroke sides are clamped.
 * curlRev 3 (1 Nov 2026, "prepare the shot"):
 *  - legacy identity: 24 runs recorded on the tree before curlRev 3 (scripts/fixtures/curling-v2-legacy.json,
 *    scripts/curling-v2-legacy-record.ts; both brush sides, starts off the centre line) replay on curlRev 2 to the
 *    stored score, unflagged; curlRev 1 and 2 keep their parts and stone line;
 *  - the bank (src/lib/duel/curlingBankV3.server.ts): every witness (scripts/fixtures/curling-witness-v3.json) scores
 *    exactly 200 through replayCurlingRun(…, 3), unflagged; rooms deal only its sheets on curlRev 3;
 *  - the rules: the gentler weight line (CURL_VMIN_V3…CURL_VMAX_V3), the same release sliding exactly as on curlRev 2,
 *    the start and brushing as curlRev 2, the re-fitted stone line, the same parts, no input 0, any throw 1+;
 *  - the aids (display only): the draw zone's edges are the first and last weights an unswept stone stops in the
 *    house with (checked through the sim), its tee mark the nearest the tee line, at least 1.5 × curlRev 2's zone; the
 *    aim line is the sim's own stone, tick for tick, for the first third of its path; neither touches the state;
 *  - input repair and a curlRev 2 log flagged as a curlRev 3 run.
 * curlRev 4 (3 Nov 2026, the power bar, three reds, curling's count):
 *  - legacy identity: 24 runs recorded on the tree before curlRev 4 (scripts/fixtures/curling-v3-legacy.json,
 *    scripts/curling-v3-legacy-record.ts) replay on curlRev 3 to the stored score, unflagged; curlRev 3 keeps its
 *    parts, stone line and opponents;
 *  - the sheets: exactly three red stones, OPP_V4_MIN…OPP_V4_MAX cm from the button, apart, the same seed placing the
 *    same stones;
 *  - the bank (src/lib/duel/curlingBankV4.server.ts): every witness (scripts/fixtures/curling-witness-v4.json) scores
 *    exactly 200 through replayCurlingRun(…, 4), unflagged; rooms deal only its sheets on curlRev 4;
 *  - the count: a stone that comes to rest behind a red in the house scores no closeness, the same throw with that red
 *    gone scores; reds out of play never block; the core's line; the weight line, start and an unbrushed slide as
 *    curlRev 3; no input 0, any throw 1+;
 *  - input repair and a curlRev 3 log flagged as a curlRev 4 run.
 *
 *   bun scripts/curling-check.ts
 */
import { readFileSync } from "node:fs";
import { witnessRaw, type Witness, type WitnessV2 } from "./curling-bank";
import {
  curlingCheckpoint,
  curlingGameFor,
  curlingOpponents,
  curlInHouse,
  CURL_AIM,
  CURL_INPUT_SWEEP,
  CURL_INPUT_THROW,
  CURL_START_MAX,
  CURLING_REV,
  CURLING_REV_V1,
  CURLING_REV_V2,
  CURLING_REV_V3,
  CURLING_STD_SPEC,
  CURLING_STD_SPEC_V2,
  CURLING_STD_SPEC_V3,
  CORE_EDGE_V4,
  OPP_V4_MAX,
  OPP_V4_MIN,
  curlCounts,
  curlingOpponentsV4,
  TEAM_MINE,
  CURL_STONE_PTS,
  CURL_VMAX_V3,
  CURL_VMIN_V3,
  CORE_EDGE_V3,
  CORE_FULL_V3,
  IN_HOUSE,
  curlAimPath,
  curlDrawZone,
  curlRelease,
  curlRestY,
  curlStonePoints,
  curlStonePointsFor,
  curlingStdParts,
  cm,
  CURLING_STONES,
  CU,
  HOG_NEAR,
  TEAM_THEIRS,
  type CurlingState,
} from "../src/lib/arcade/curling";
import { decodeCurlingRun, encodeCurlingRun, replayCurlingRun } from "../src/lib/duel/curling";
import { CURLING_BANK } from "../src/lib/duel/curlingBank.server";
import { CURLING_BANK_V2 } from "../src/lib/duel/curlingBankV2.server";
import { CURLING_BANK_V3 } from "../src/lib/duel/curlingBankV3.server";
import { CURLING_BANK_V4 } from "../src/lib/duel/curlingBankV4.server";
import { generateCurling } from "../src/lib/duel/sports.server";

let checks = 0;
const failures: string[] = [];
function ok(cond: boolean, label: string): void {
  checks++;
  if (!cond) failures.push(label);
}
// The fixtures hold each sheet's throw plan; witnessRaw plays it into the log the phone would send.
const witness: Record<string, string> = Object.fromEntries(
  (JSON.parse(readFileSync(new URL("./fixtures/curling-witness.json", import.meta.url), "utf8")) as Witness[]).map((w) => [String(w.seed), witnessRaw(w, CURLING_REV_V1)]),
);
const witnessesV2 = JSON.parse(readFileSync(new URL("./fixtures/curling-witness-v2.json", import.meta.url), "utf8")) as WitnessV2[];
const witnessV2: Record<string, string> = Object.fromEntries(witnessesV2.map((w) => [String(w.seed), witnessRaw(w, CURLING_REV_V2)]));
const witnessesV3 = JSON.parse(readFileSync(new URL("./fixtures/curling-witness-v3.json", import.meta.url), "utf8")) as WitnessV2[];
const witnessV3: Record<string, string> = Object.fromEntries(witnessesV3.map((w) => [String(w.seed), witnessRaw(w, CURLING_REV_V3)]));
const witnessesV4 = JSON.parse(readFileSync(new URL("./fixtures/curling-witness-v4.json", import.meta.url), "utf8")) as WitnessV2[];
const witnessV4: Record<string, string> = Object.fromEntries(witnessesV4.map((w) => [String(w.seed), witnessRaw(w, CURLING_REV)]));

ok(CURLING_REV === 4 && CURLING_REV_V3 === 3 && CURLING_REV_V2 === 2 && CURLING_REV_V1 === 1, "rooms deal curlRev 4; curlRev 3, 2 and 1 replay");

/* ============================== curlRev 1 ============================== */

/* The bank. */
ok(CURLING_BANK.length >= 40 && new Set(CURLING_BANK).size === CURLING_BANK.length, `at least 40 unique bank sheets (${CURLING_BANK.length})`);
let perfect = 0;
for (const seed of CURLING_BANK) {
  const run = replayCurlingRun(seed, witness[String(seed)] ?? "", CURLING_REV_V1);
  if (run.score === 200 && !run.flagged && run.onButton === CURLING_STONES && run.takeouts === run.opponents && run.holding) perfect++;
}
ok(perfect === CURLING_BANK.length, `every bank witness: eight on the button, every opponent out, holding shot, 200 through the server replay (${perfect} of ${CURLING_BANK.length})`);

/* The sheets. */
for (const seed of [...CURLING_BANK, ...CURLING_BANK_V2, ...CURLING_BANK_V3]) {
  const opp = curlingOpponents(seed);
  ok(JSON.stringify(opp) === JSON.stringify(curlingOpponents(seed)), `sheet ${seed}: the same seed places the same stones`);
  ok(opp.length >= 2 && opp.length <= 3 && opp.every((o) => curlInHouse(o.x * CU, o.y * CU)), `sheet ${seed}: two or three opponent stones, all in the house`);
  for (const rev of [CURLING_REV_V1, CURLING_REV_V2, CURLING_REV_V3]) {
    const s = curlingGameFor(rev).init(seed);
    ok(s.team.every((t) => t === TEAM_THEIRS) && s.theirs === opp.length && s.rev === rev, `sheet ${seed} on curlRev ${rev}: only the opponent's stones before the first throw`);
  }
}

/* The rules. */
const rulesFor = (rev: number) => {
  const game = curlingGameFor(rev);
  const throwAt = (s: CurlingState, bx: number, by: number, weight: number, turn: number, sx = 0) => game.step(s, { t: s.tick + 1, k: CURL_INPUT_THROW, a: bx, b: by, c: weight * 2 + turn, d: sx });
  /** Steps until everything settles; `side` brushes every 4th tick with that side (undefined: no brushing). */
  const settle = (s: CurlingState, side?: number, strength = 100) => {
    let x = s;
    while (x.phase !== CURL_AIM && !x.over) x = game.step(x, side !== undefined && x.tick % 4 === 0 ? { t: x.tick + 1, k: CURL_INPUT_SWEEP, a: strength, b: side, c: 0, d: 0 } : null);
    return x;
  };
  return { game, throwAt, settle };
};
{
  const { game, throwAt, settle } = rulesFor(CURLING_REV_V1);
  const s0 = game.init(CURLING_BANK[0]!);
  const travelling = throwAt(s0, 0, 0, 500, 0);
  const again = throwAt(travelling, 50, 0, 900, 1);
  ok(again.thrown === travelling.thrown, "a throw while a stone travels is ignored");
  const light = settle(throwAt(s0, 0, 0, 1, 0));
  ok(light.thrown === 1 && light.live[light.live.length - 1] === 0, "a stone too light for the far hog line is out of play");
  // Sweeping: the same throw, swept all the way, comes to rest further down the sheet (or out of play).
  const plain = settle(throwAt(s0, 0, 300, 300, 0));
  const swept = settle(throwAt(s0, 0, 300, 300, 0), 0);
  const i = plain.y.length - 1;
  ok(swept.live[i] === 0 || swept.y[i]! < plain.y[i]! || plain.live[i] === 0, "sweeping carries the stone further");
  // curlRev 1 starts every stone on the centre line, whatever d says.
  const offCentre = throwAt(s0, 0, 0, 300, 0, 60);
  ok(offCentre.x[offCentre.x.length - 1] === 0, "curlRev 1: every stone starts on the centre line");
  let idle = game.init(CURLING_BANK[0]!);
  while (!idle.over) idle = game.step(idle, null);
  ok(game.score(idle) === 0, "no input scores 0");
  let played = settle(throwAt(game.init(CURLING_BANK[0]!), 200, 0, 1, 0));
  while (!played.over) played = game.step(played, null);
  ok(game.score(played) >= 1, `any throw scores at least 1 (${game.score(played)})`);
}

/* Determinism and input repair. */
{
  const seed = CURLING_BANK[1]!;
  const a = replayCurlingRun(seed, witness[String(seed)]!, CURLING_REV_V1);
  const b = replayCurlingRun(seed, witness[String(seed)]!, CURLING_REV_V1);
  ok(JSON.stringify(a.checkpoints) === JSON.stringify(b.checkpoints) && JSON.stringify(curlingCheckpoint(a.state)) === JSON.stringify(curlingCheckpoint(b.state)), "the same log replays the same twice");
  const r = replayCurlingRun(seed, encodeCurlingRun({ seed, claimedScore: 0, events: [{ t: 3, k: 1, a: 99999, b: -99999, c: 99999, d: 0 }], endTick: 0, checkpoints: [] }), CURLING_REV_V1);
  ok(r.inputDiag.clamped === 1 && r.inputDiag.dropped === 0 && r.flagged, "an out-of-range throw is clamped, replayed and flagged");
  // An unstamped round is curlRev 1.
  const u = replayCurlingRun(seed, witness[String(seed)]!, undefined);
  ok(u.score === 200 && !u.flagged && u.state.rev === CURLING_REV_V1, "a round with no curlRev replays as curlRev 1");
}

/* Legacy identity: runs recorded before curlRev 2 replay to the same score, unflagged. */
{
  const legacy = JSON.parse(readFileSync(new URL("./fixtures/curling-v1-legacy.json", import.meta.url), "utf8")) as { seed: number; raw: string; score: number }[];
  ok(legacy.length === 24, `24 legacy curlRev 1 runs (${legacy.length})`);
  let same = 0;
  for (const run of legacy) {
    const r = replayCurlingRun(run.seed, run.raw, CURLING_REV_V1);
    if (r.score === run.score && !r.flagged && r.desyncTick === null) same++;
  }
  ok(same === legacy.length, `every legacy curlRev 1 run replays to its stored score, unflagged, with its recorded checkpoints (${same} of ${legacy.length})`);
  ok(legacy.filter((r) => decodeCurlingRun(r.raw).events.some((e) => e.k === CURL_INPUT_SWEEP)).length >= 10, "the legacy runs include sweeping");
}

/* ============================== curlRev 2 ============================== */

/* The bank. */
ok(CURLING_BANK_V2.length >= 60 && new Set(CURLING_BANK_V2).size === CURLING_BANK_V2.length, `at least 60 unique curlRev 2 bank sheets (${CURLING_BANK_V2.length})`);
ok(witnessesV2.length === CURLING_BANK_V2.length && witnessesV2.every((w, i) => w.seed === CURLING_BANK_V2[i] && w.throws.length === CURLING_STONES && w.throws.every((t) => t.length === 5)), "one five-figure witness plan of eight throws for every curlRev 2 sheet, in bank order");
let perfectV2 = 0;
for (const seed of CURLING_BANK_V2) {
  const run = replayCurlingRun(seed, witnessV2[String(seed)] ?? "", CURLING_REV_V2);
  if (run.score === 200 && !run.flagged && run.onButton === CURLING_STONES && run.takeouts === run.opponents && run.holding && run.state.rev === CURLING_REV_V2) perfectV2++;
}
ok(perfectV2 === CURLING_BANK_V2.length, `every curlRev 2 bank witness: eight on the button, every opponent out, holding shot, 200 through the server replay on curlRev 2 (${perfectV2} of ${CURLING_BANK_V2.length})`);

/* The rules. */
{
  const { game, throwAt, settle } = rulesFor(CURLING_REV_V2);
  const v1 = rulesFor(CURLING_REV_V1);
  const seed = CURLING_BANK_V2[0]!;
  const s0 = game.init(seed);
  // The start: the stone leaves the hog line where it was slid to.
  for (const sx of [-CURL_START_MAX, -40, 0, 55, CURL_START_MAX]) {
    const t = throwAt(s0, 0, 0, 320, 0, sx);
    const i = t.x.length - 1;
    ok(t.x[i]! !== undefined && t.thrown === 1, `curlRev 2: a throw from ${sx} cm`);
    // On the throw's tick the stone is placed on the near hog line at its start, moving towards the broom.
    ok(t.x[i] === sx * CU && t.y[i] === HOG_NEAR * CU && t.vy[i]! < 0 && Math.sign(t.vx[i]!) === Math.sign(0 - sx), `curlRev 2: the stone starts at ${sx} cm on the near hog line`);
  }
  ok(throwAt(s0, 0, 0, 300, 0, 40).vx.at(-1)! < throwAt(s0, 0, 0, 300, 0, 0).vx.at(-1)!, "curlRev 2: from the right of the centre line the same broom is aimed further left");
  // With no brushing a curlRev 2 throw from the centre line slides exactly as on curlRev 1.
  for (const [bx, w, turn] of [[0, 300, 0], [40, 330, 1], [-60, 520, 0], [20, 640, 1]] as const) {
    const a = settle(throwAt(s0, bx, 0, w, turn));
    const b = v1.settle(v1.throwAt(v1.game.init(seed), bx, 0, w, turn));
    ok(JSON.stringify([a.x, a.y, a.live, a.pts, a.four]) === JSON.stringify([b.x, b.y, b.live, b.pts, b.four]), `curlRev 2 unbrushed = curlRev 1 (broom ${bx}, weight ${w}, turn ${turn})`);
  }
  // Brushing (on an empty sheet, a half-second burst of strokes after release): left bends it left, right bends it
  // right, both carry it further than not brushing; carrying only goes less far than curlRev 1's sweep.
  const empty = (s: CurlingState): CurlingState => ({ ...s, x: [], y: [], vx: [], vy: [], team: [], live: [], curl: [], theirs: 0 });
  const burst = (g: typeof game, s: CurlingState, side: number | null, ticks = 30) => {
    let x = s;
    const until = x.tick + ticks;
    let flip = 1;
    while (x.phase !== CURL_AIM && !x.over) {
      const stroke = side !== null && x.tick < until && x.tick % 4 === 0;
      x = g.step(x, stroke ? { t: x.tick + 1, k: CURL_INPUT_SWEEP, a: 60, b: side === 2 ? (flip = -flip) : side, c: 0, d: 0 } : null);
    }
    return x;
  };
  for (const [bx, w, turn, sx] of [[0, 306, 0, 0], [30, 300, 1, -50], [-20, 290, 0, 60]] as const) {
    const e0 = empty(s0);
    const plain = burst(game, throwAt(e0, bx, 0, w, turn, sx), null);
    const left = burst(game, throwAt(e0, bx, 0, w, turn, sx), -1);
    const right = burst(game, throwAt(e0, bx, 0, w, turn, sx), 1);
    const both = burst(game, throwAt(e0, bx, 0, w, turn, sx), 2);
    const carry = burst(game, throwAt(e0, bx, 0, w, turn, sx), 0);
    const v1e = empty(v1.game.init(seed));
    const v1swept = burst(v1.game, v1.throwAt(v1e, bx, 0, w, turn), 0);
    const tag = `(broom ${bx}, weight ${w}, turn ${turn}, start ${sx})`;
    ok([plain, left, right, both, carry].every((x) => x.live[0] === 1), `curlRev 2: the brushing trials stay in play ${tag}`);
    ok(left.x[0]! < plain.x[0]! - 20 * CU && right.x[0]! > plain.x[0]! + 20 * CU, `curlRev 2: brushing its left bends it left, its right right ${tag} (${Math.round((left.x[0]! - plain.x[0]!) / CU)} / ${Math.round((right.x[0]! - plain.x[0]!) / CU)} cm)`);
    ok(left.y[0]! < plain.y[0]! && right.y[0]! < plain.y[0]! && carry.y[0]! < plain.y[0]!, `curlRev 2: brushing carries the stone further ${tag}`);
    ok(carry.y[0]! > v1swept.y[0]! || v1swept.live[0] === 0, `curlRev 2: a little further (less than curlRev 1's sweep) ${tag}`);
    ok(Math.abs(both.x[0]! - plain.x[0]!) < Math.abs(left.x[0]! - plain.x[0]!) / 2, `curlRev 2: brushing both sides in turn bends it little ${tag}`);
  }
  // Brushing never halves the curl (curlRev 1's sweep did): an Out-turn carried stone still curls left of the line.
  {
    const e0 = empty(s0);
    const plainIn = burst(game, throwAt(e0, 0, 0, 306, 0), null);
    const plainOut = burst(game, throwAt(e0, 0, 0, 306, 1), null);
    ok(plainIn.x[0]! > 50 * CU && plainOut.x[0]! < -50 * CU, "curlRev 2: an In-turn curls right, an Out-turn left, about a metre on a draw");
  }
  // A throw while a stone travels does nothing; a too-light stone is out; no input 0; any throw 1+.
  const travelling = throwAt(s0, 0, 0, 500, 0, 30);
  ok(throwAt(travelling, 50, 0, 900, 1, -30).thrown === travelling.thrown, "curlRev 2: a throw while a stone travels is ignored");
  const light = settle(throwAt(s0, 0, 0, 1, 0, 50));
  ok(light.live[light.live.length - 1] === 0, "curlRev 2: a stone too light for the far hog line is out of play");
  let idle = game.init(seed);
  while (!idle.over) idle = game.step(idle, null);
  ok(game.score(idle) === 0, "curlRev 2: no input scores 0");
  let played = settle(throwAt(game.init(seed), 200, 0, 1, 0, -CURL_START_MAX));
  while (!played.over) played = game.step(played, null);
  ok(game.score(played) >= 1, `curlRev 2: any throw scores at least 1 (${game.score(played)})`);
}

/* Determinism and input repair on curlRev 2. */
{
  const seed = CURLING_BANK_V2[1]!;
  const a = replayCurlingRun(seed, witnessV2[String(seed)]!, CURLING_REV_V2);
  const b = replayCurlingRun(seed, witnessV2[String(seed)]!, CURLING_REV_V2);
  ok(JSON.stringify(a.checkpoints) === JSON.stringify(b.checkpoints), "curlRev 2: the same log replays the same twice");
  const r = replayCurlingRun(seed, encodeCurlingRun({ seed, claimedScore: 0, events: [{ t: 3, k: 1, a: 0, b: 0, c: 600, d: 500 }], endTick: 0, checkpoints: [] }), CURLING_REV_V2);
  ok(r.inputDiag.clamped === 1 && r.flagged && r.state.x.at(-1) !== undefined, "curlRev 2: an out-of-range start is clamped, replayed and flagged");
  const side = replayCurlingRun(seed, encodeCurlingRun({ seed, claimedScore: 0, events: [{ t: 3, k: 1, a: 0, b: 0, c: 600, d: 0 }, { t: 30, k: 2, a: 50, b: 7, c: 0, d: 0 }], endTick: 0, checkpoints: [] }), CURLING_REV_V2);
  ok(side.inputDiag.clamped === 1 && side.flagged, "curlRev 2: a stroke's side beyond ±1 is clamped and flagged");
  // A curlRev 1 witness's log, replayed as curlRev 2, desyncs (its checkpoints carry curlRev 1's checksum).
  const v1seed = CURLING_BANK[0]!;
  const cross = replayCurlingRun(v1seed, witness[String(v1seed)]!, CURLING_REV_V2);
  ok(cross.flagged, "a curlRev 1 log is flagged as a curlRev 2 run");
}

/* ============================== curlRev 3 ============================== */

/* Legacy identity: runs recorded on the tree before curlRev 3 replay on curlRev 2 to the same score, unflagged. */
{
  const legacy = JSON.parse(readFileSync(new URL("./fixtures/curling-v2-legacy.json", import.meta.url), "utf8")) as { seed: number; raw: string; score: number }[];
  ok(legacy.length === 24, `24 legacy curlRev 2 runs (${legacy.length})`);
  let same = 0;
  for (const run of legacy) {
    const r = replayCurlingRun(run.seed, run.raw, CURLING_REV_V2);
    if (r.score === run.score && !r.flagged && r.desyncTick === null) same++;
  }
  ok(same === legacy.length, `every legacy curlRev 2 run replays to its stored score, unflagged, with its recorded checkpoints (${same} of ${legacy.length})`);
  const events = legacy.flatMap((r) => decodeCurlingRun(r.raw).events);
  ok(events.some((e) => e.k === CURL_INPUT_SWEEP && e.b === -1) && events.some((e) => e.k === CURL_INPUT_SWEEP && e.b === 1) && events.some((e) => e.k === CURL_INPUT_THROW && e.d !== 0), "the legacy curlRev 2 runs include both brush sides and starts off the centre line");
  // curlRev 2's spec, its parts and its stone line are unchanged.
  ok(CURLING_STD_SPEC_V2.rev === 2 && CURLING_STD_SPEC_V2.parts.map((p) => `${p.key}:${p.max}`).join() === "core:120,takeouts:30,redring:30,hold:20", "curlRev 2's parts are unchanged");
  for (const d of [0, 20, 29, 30, 60, 120, 197, 198, 250])
    ok(curlStonePointsFor(CURLING_REV_V2, cm(d), 0) === curlStonePoints(cm(d), 0) && curlStonePointsFor(CURLING_REV_V1, 0, cm(d)) === curlStonePoints(0, cm(d)), `curlRev 1 and 2 keep their stone line (${d} cm)`);
}

/* The bank. */
ok(CURLING_BANK_V3.length >= 60 && new Set(CURLING_BANK_V3).size === CURLING_BANK_V3.length, `at least 60 unique curlRev 3 bank sheets (${CURLING_BANK_V3.length})`);
ok(witnessesV3.length === CURLING_BANK_V3.length && witnessesV3.every((w, i) => w.seed === CURLING_BANK_V3[i] && w.throws.length === CURLING_STONES && w.throws.every((t) => t.length === 5)), "one five-figure witness plan of eight throws for every curlRev 3 sheet, in bank order");
let perfectV3 = 0;
for (const seed of CURLING_BANK_V3) {
  const run = replayCurlingRun(seed, witnessV3[String(seed)] ?? "", CURLING_REV_V3);
  if (run.score === 200 && !run.flagged && run.onButton === CURLING_STONES && run.takeouts === run.opponents && run.holding && run.state.rev === CURLING_REV_V3) perfectV3++;
}
ok(perfectV3 === CURLING_BANK_V3.length, `every curlRev 3 bank witness: eight on the button, every opponent out, holding shot, 200 through the server replay on curlRev 3 (${perfectV3} of ${CURLING_BANK_V3.length})`);

/* The rules. */
{
  const { game, throwAt, settle } = rulesFor(CURLING_REV_V3);
  const v2 = rulesFor(CURLING_REV_V2);
  const seed = CURLING_BANK_V3[0]!;
  const s0 = game.init(seed);
  const emptied = (s: CurlingState): CurlingState => ({ ...s, x: [], y: [], vx: [], vy: [], team: [], live: [], curl: [], theirs: 0 });
  // The gentler weight line: 1…1000 → CURL_VMIN_V3…CURL_VMAX_V3 cm a tick (curlRev 1 and 2: 13…22).
  const speed = (w: number, rev: number) => {
    const v = curlRelease(0, 0, w, 0, rev);
    return Math.hypot(v.vx, v.vy) / CU;
  };
  ok(Math.abs(speed(0, 3) - CURL_VMIN_V3) < 0.01 && Math.abs(speed(1000, 3) - CURL_VMAX_V3) < 0.01, `curlRev 3: weight 0…1000 releases at ${CURL_VMIN_V3}…${CURL_VMAX_V3} cm a tick (${speed(0, 3).toFixed(2)}…${speed(1000, 3).toFixed(2)})`);
  ok(Math.abs(speed(1000, 2) - 22) < 0.01 && Math.abs(speed(1000, 1) - 22) < 0.01, "curlRev 1 and 2 keep 13…22 cm a tick");
  // The start, the brushing and the rest as on curlRev 2: a stone from the start slid to, bending to the brushed side.
  for (const sx of [-CURL_START_MAX, 0, 55]) {
    const t = throwAt(s0, 0, 0, 320, 0, sx);
    const i = t.x.length - 1;
    ok(t.x[i] === sx * CU && t.y[i] === HOG_NEAR * CU && t.vy[i]! < 0, `curlRev 3: the stone starts at ${sx} cm on the near hog line`);
  }
  {
    const run = (side: number | null) => {
      let x = throwAt(emptied(s0), 0, 0, 315, 0, 0);
      const until = x.tick + 30;
      while (x.phase !== CURL_AIM && !x.over) x = game.step(x, side !== null && x.tick < until && x.tick % 4 === 0 ? { t: x.tick + 1, k: CURL_INPUT_SWEEP, a: 60, b: side, c: 0, d: 0 } : null);
      return x;
    };
    const plain = run(null);
    const left = run(-1);
    const right = run(1);
    ok(plain.live[0] === 1 && left.x[0]! < plain.x[0]! - 20 * CU && right.x[0]! > plain.x[0]! + 20 * CU && left.y[0]! < plain.y[0]!, "curlRev 3: brushing left bends it left, right bends it right, both carry it");
  }
  // Only the weight line changed: a curlRev 3 weight that releases at exactly a curlRev 2 weight's velocity slides the same.
  {
    let matched = 0;
    for (let w2 = 150; w2 <= 650 && matched < 6; w2++) {
      const sp = curlRelease(0, 0, w2, 0, 2);
      for (let w3 = 1; w3 <= 1000; w3++) {
        const v3 = curlRelease(0, 0, w3, 0, 3);
        if (v3.vx !== sp.vx || v3.vy !== sp.vy) continue;
        const a = settle(throwAt(s0, 0, 0, w3, 1, 0));
        const b = v2.settle(v2.throwAt(v2.game.init(seed), 0, 0, w2, 1, 0));
        ok(JSON.stringify([a.x, a.y, a.live]) === JSON.stringify([b.x, b.y, b.live]), `curlRev 3 weight ${w3} slides as curlRev 2 weight ${w2} (the same release)`);
        matched++;
        break;
      }
    }
    ok(matched >= 3, `curlRev 3: at least three weights release exactly as a curlRev 2 weight (${matched})`);
  }
  // The re-fitted core line: full within CORE_FULL_V3 cm of the button, 0 from CORE_EDGE_V3 cm, straight between.
  ok(curlStonePointsFor(CURLING_REV_V3, 0, 0) === CURL_STONE_PTS && curlStonePointsFor(CURLING_REV_V3, cm(CORE_FULL_V3), 0) === CURL_STONE_PTS && curlStonePointsFor(CURLING_REV_V3, cm(CORE_EDGE_V3), 0) === 0 && curlStonePointsFor(CURLING_REV_V3, cm(CORE_EDGE_V3 + 40), 0) === 0, "curlRev 3: the stone line's ends");
  let mono = true;
  for (let d = 0; d < CORE_EDGE_V3 + 20; d += 3) if (curlStonePointsFor(CURLING_REV_V3, 0, cm(d + 3)) > curlStonePointsFor(CURLING_REV_V3, 0, cm(d))) mono = false;
  ok(mono, "curlRev 3: a stone nearer the button never scores less");
  {
    const t = settle(throwAt(emptied(s0), 0, 0, 315, 0, 0));
    ok(t.pts[0] === curlStonePointsFor(CURLING_REV_V3, t.x[0]!, t.y[0]!) && t.live[0] === 1, "curlRev 3: a thrown stone is scored on curlRev 3's line");
  }
  ok(CURLING_STD_SPEC_V3.rev === 3 && CURLING_STD_SPEC_V3.parts.map((p) => `${p.key}:${p.max}`).join() === "core:120,takeouts:30,redring:30,hold:20", "curlRev 3: the same parts and maximums");
  ok(curlingStdParts({ ...s0, rev: 5 }) === null, "a revision past 4 has no parts");
  let idle = game.init(seed);
  while (!idle.over) idle = game.step(idle, null);
  ok(game.score(idle) === 0, "curlRev 3: no input scores 0");
  let played = settle(throwAt(game.init(seed), 200, 0, 1, 0, -CURL_START_MAX));
  while (!played.over) played = game.step(played, null);
  ok(game.score(played) >= 1, `curlRev 3: any throw scores at least 1 (${game.score(played)})`);
}

/* The preparation aids (display only): the draw zone and the aim line. */
{
  const seed = CURLING_BANK_V3[0]!;
  const game = curlingGameFor(CURLING_REV_V3);
  const s0 = game.init(seed);
  const before = JSON.stringify(s0);
  const emptied = (s: CurlingState): CurlingState => ({ ...s, x: [], y: [], vx: [], vy: [], team: [], live: [], curl: [], theirs: 0 });
  const aims = [[0, 0, 0, 0], [0, -60, 0, 0], [0, 60, 40, 1], [50, -20, -50, 0], [-100, 120, 0, 1], [100, -140, 30, 0]] as const;
  let wider = 0;
  for (const [sx, bx, by, turn] of aims) {
    const z = curlDrawZone(sx, bx, by, turn, CURLING_REV_V3);
    const z2 = curlDrawZone(sx, bx, by, turn, CURLING_REV_V2);
    const tag = `(start ${sx}, target ${bx},${by}, turn ${turn})`;
    ok(z !== null && z.lo <= z.tee && z.tee <= z.hi, `the draw zone exists with its tee mark inside ${tag}`);
    if (!z) continue;
    const y = (w: number) => curlRestY(sx, bx, by, w, turn, CURLING_REV_V3);
    ok(Math.abs(y(z.lo)) <= cm(IN_HOUSE) && Math.abs(y(z.hi)) <= cm(IN_HOUSE) && y(z.lo - 1) > cm(IN_HOUSE) && (z.hi === 1000 || y(z.hi + 1) < -cm(IN_HOUSE)), `the zone's edges are the first and last weights that stop in the house ${tag}`);
    ok(Math.abs(y(z.tee)) <= Math.abs(y(z.tee - 1)) && Math.abs(y(z.tee)) <= Math.abs(y(z.tee + 1)), `the tee mark stops nearest the tee line ${tag}`);
    // Through the real sim: unswept throws at the zone's edges and mark come to rest where the zone says.
    for (const w of [z.lo, z.tee, z.hi]) {
      let t = game.step(emptied(s0), { t: s0.tick + 1, k: CURL_INPUT_THROW, a: bx, b: by, c: w * 2 + turn, d: sx });
      while (t.phase !== CURL_AIM && !t.over) t = game.step(t, null);
      ok(t.y[0] === y(w) && t.live[0] === 1 && Math.abs(t.y[0]!) <= cm(IN_HOUSE), `the zone's rest point is the sim's, in the house's depth (weight ${w}) ${tag}`);
    }
    if (z2 && z.hi - z.lo >= 1.5 * (z2.hi - z2.lo)) wider++;
  }
  ok(wider === aims.length, `curlRev 3's draw zone is at least 1.5 × curlRev 2's on every aim (${wider} of ${aims.length})`);
  // The aim line: the first third (by distance) of the stone's real unswept path at the zone's mark.
  const z = curlDrawZone(30, -40, 0, 0, CURLING_REV_V3)!;
  const path = curlAimPath(s0, 30, -40, 0, z.tee, 0);
  let t = game.step(s0, { t: s0.tick + 1, k: CURL_INPUT_THROW, a: -40, b: 0, c: z.tee * 2, d: 30 });
  const i = t.x.length - 1;
  // The throw's tick moves nothing yet; each later tick moves the stone once (the path's points, tick for tick).
  const real: { x: number; y: number }[] = [{ x: t.x[i]! / CU, y: t.y[i]! / CU }];
  while (t.phase !== CURL_AIM && !t.over) {
    t = game.step(t, null);
    if (t.live[i]) real.push({ x: t.x[i]! / CU, y: t.y[i]! / CU });
  }
  ok(path.length > 10 && path.every((p, k) => k < real.length && Math.abs(p.x - real[k]!.x) < 1e-9 && Math.abs(p.y - real[k]!.y) < 1e-9), `the aim line follows the sim's own stone, tick for tick (${path.length} points)`);
  const length = (ps: { x: number; y: number }[]) => ps.slice(1).reduce((a, p, k) => a + Math.hypot(p.x - ps[k]!.x, p.y - ps[k]!.y), 0);
  const share = length(path) / length(real);
  ok(share > 0.32 && share < 0.37, `the aim line is the first third of the path (${(share * 100).toFixed(1)} %)`);
  ok(JSON.stringify(s0) === before, "working out the zone and the aim line leaves the state untouched");
}

/* Determinism and input repair on curlRev 3. */
{
  const seed = CURLING_BANK_V3[1]!;
  const a = replayCurlingRun(seed, witnessV3[String(seed)]!, CURLING_REV_V3);
  const b = replayCurlingRun(seed, witnessV3[String(seed)]!, CURLING_REV_V3);
  ok(JSON.stringify(a.checkpoints) === JSON.stringify(b.checkpoints), "curlRev 3: the same log replays the same twice");
  const r = replayCurlingRun(seed, encodeCurlingRun({ seed, claimedScore: 0, events: [{ t: 3, k: 1, a: 0, b: 0, c: 600, d: 500 }], endTick: 0, checkpoints: [] }), CURLING_REV_V3);
  ok(r.inputDiag.clamped === 1 && r.flagged, "curlRev 3: an out-of-range start is clamped, replayed and flagged");
  // A curlRev 2 witness's log, replayed as curlRev 3, desyncs (its weights release at other speeds).
  const v2seed = CURLING_BANK_V2[0]!;
  ok(replayCurlingRun(v2seed, witnessV2[String(v2seed)]!, CURLING_REV_V3).flagged, "a curlRev 2 log is flagged as a curlRev 3 run");
  ok(!replayCurlingRun(v2seed, witnessV2[String(v2seed)]!, CURLING_REV_V2).flagged, "and replays unflagged as curlRev 2");
}

/* ============================== curlRev 4 ============================== */

/* Legacy identity: runs recorded on the tree before curlRev 4 replay on curlRev 3 to the same score, unflagged. */
{
  const legacy = JSON.parse(readFileSync(new URL("./fixtures/curling-v3-legacy.json", import.meta.url), "utf8")) as { seed: number; raw: string; score: number }[];
  ok(legacy.length === 24, `24 legacy curlRev 3 runs (${legacy.length})`);
  let same = 0;
  for (const run of legacy) {
    const r = replayCurlingRun(run.seed, run.raw, CURLING_REV_V3);
    if (r.score === run.score && !r.flagged && r.desyncTick === null) same++;
  }
  ok(same === legacy.length, `every legacy curlRev 3 run replays to its stored score, unflagged, with its recorded checkpoints (${same} of ${legacy.length})`);
  const events = legacy.flatMap((r) => decodeCurlingRun(r.raw).events);
  ok(events.some((e) => e.k === CURL_INPUT_SWEEP && e.b === -1) && events.some((e) => e.k === CURL_INPUT_SWEEP && e.b === 1) && events.some((e) => e.k === CURL_INPUT_THROW && e.d !== 0), "the legacy curlRev 3 runs include both brush sides and starts off the centre line");
  ok(CURLING_STD_SPEC_V3.rev === 3 && CURLING_STD_SPEC_V3.parts.map((p) => `${p.key}:${p.max}`).join() === "core:120,takeouts:30,redring:30,hold:20", "curlRev 3's parts are unchanged");
  for (const seed of CURLING_BANK_V3.slice(0, 10)) ok(curlingGameFor(CURLING_REV_V3).init(seed).theirs === curlingOpponents(seed).length, `curlRev 3 keeps its opponents (${seed})`);
}

/* The sheets. */
for (const seed of [...CURLING_BANK_V4, ...CURLING_BANK_V3.slice(0, 20), 1, 2, 3, 12345]) {
  const opp = curlingOpponentsV4(seed);
  ok(JSON.stringify(opp) === JSON.stringify(curlingOpponentsV4(seed)), `curlRev 4 sheet ${seed}: the same seed places the same stones`);
  const d = opp.map((o) => Math.hypot(o.x, o.y));
  ok(opp.length === 3 && d.every((v) => v >= OPP_V4_MIN && v <= OPP_V4_MAX) && opp.every((o) => curlInHouse(o.x * CU, o.y * CU)), `curlRev 4 sheet ${seed}: exactly three red stones in the house (${d.map(Math.round).join(", ")} cm)`);
  ok(opp.every((a, i) => opp.every((b, j) => i === j || Math.hypot(a.x - b.x, a.y - b.y) >= 40)), `curlRev 4 sheet ${seed}: the reds apart`);
  const s = curlingGameFor(CURLING_REV).init(seed);
  ok(s.theirs === 3 && s.team.every((t) => t === TEAM_THEIRS) && s.rev === CURLING_REV, `curlRev 4 sheet ${seed}: three reds before the first throw`);
}

/* The bank. */
ok(CURLING_BANK_V4.length >= 60 && new Set(CURLING_BANK_V4).size === CURLING_BANK_V4.length, `at least 60 unique curlRev 4 bank sheets (${CURLING_BANK_V4.length})`);
ok(witnessesV4.length === CURLING_BANK_V4.length && witnessesV4.every((w, i) => w.seed === CURLING_BANK_V4[i] && w.throws.length === CURLING_STONES && w.throws.every((t) => t.length === 5)), "one five-figure witness plan of eight throws for every curlRev 4 sheet, in bank order");
let perfectV4 = 0;
for (const seed of CURLING_BANK_V4) {
  const run = replayCurlingRun(seed, witnessV4[String(seed)] ?? "", CURLING_REV);
  if (run.score === 200 && !run.flagged && run.onButton === CURLING_STONES && run.counted === CURLING_STONES && run.takeouts === 3 && run.holding && run.state.rev === CURLING_REV) perfectV4++;
}
ok(perfectV4 === CURLING_BANK_V4.length, `every curlRev 4 bank witness: eight on the button and counting, all three reds out, holding shot, 200 through the server replay on curlRev 4 (${perfectV4} of ${CURLING_BANK_V4.length})`);
for (let i = 0; i < 50; i++) {
  const p = generateCurling();
  ok(CURLING_BANK_V4.includes(p.seed) && p.curlRev === CURLING_REV, `rooms deal a curlRev 4 bank sheet on curlRev 4 (${p.seed})`);
}

/* The rules: curling's count, the core's line, the rest as curlRev 3. */
{
  const { game, throwAt, settle } = rulesFor(CURLING_REV);
  const v3 = rulesFor(CURLING_REV_V3);
  const seed = CURLING_BANK_V4[0]!;
  const s0 = game.init(seed);
  // The count on hand-placed sheets: a red at 20 cm blocks a stone at rest 40 cm out; at 60 cm it does not; a red
  // outside the house never blocks; a tie does not count.
  const sheet = (redAt: number, mineAt: number) => ({ x: [cm(redAt), cm(mineAt)], y: [0, 0], live: [1, 1], team: [TEAM_THEIRS, TEAM_MINE] });
  ok(!curlCounts(sheet(20, 40), 1) && curlCounts(sheet(60, 40), 1) && curlCounts(sheet(250, 240), 1) && !curlCounts(sheet(40, 40), 1), "curlRev 4: a stone counts only when nearer the button than every red in the house (a tie does not)");
  ok(curlCounts({ ...sheet(20, 40), live: [0, 1] }, 1), "curlRev 4: a red out of play never blocks");
  // Through the sim: the same throw scores nothing behind a red, and its closeness with no red.
  const emptied = (s: CurlingState): CurlingState => ({ ...s, x: [], y: [], vx: [], vy: [], team: [], live: [], curl: [], theirs: 0 });
  const free = settle(throwAt(emptied(s0), -60, 0, 300, 0, 0));
  const at = { x: free.x[0]!, y: free.y[0]! };
  const dFree = Math.hypot(at.x, at.y) / CU;
  ok(free.live[0] === 1 && free.pts[0]! > 0 && dFree > 40 && dFree < 110, `curlRev 4: a throw on an empty sheet comes to rest ${Math.round(dFree)} cm out and scores ${free.pts[0]}`);
  // A red nearer the button on the button's far side: the stone's path never meets it.
  const k = (dFree - 25) / dFree;
  const red = { x: Math.round(-at.x * k), y: Math.round(-at.y * k) };
  const blocked = settle(throwAt({ ...emptied(s0), x: [red.x], y: [red.y], vx: [0], vy: [0], team: [TEAM_THEIRS], live: [1], curl: [0], theirs: 1 }, -60, 0, 300, 0, 0));
  ok(blocked.x[1] === at.x && blocked.y[1] === at.y && blocked.pts[0] === 0, `curlRev 4: the same throw behind a red in the house scores no closeness (${blocked.pts[0]})`);
  ok(curlStonePointsFor(CURLING_REV, 0, 0) === CURL_STONE_PTS && curlStonePointsFor(CURLING_REV, cm(CORE_FULL_V3), 0) === CURL_STONE_PTS && curlStonePointsFor(CURLING_REV, cm(CORE_EDGE_V4), 0) === 0, "curlRev 4: the stone line's ends");
  ok(free.pts[0] === curlStonePointsFor(CURLING_REV, at.x, at.y), "curlRev 4: a counting stone is scored on curlRev 4's line");
  // The weight line, the start and an unbrushed slide are curlRev 3's.
  for (const [bx, w, turn, sx] of [[0, 300, 0, 0], [40, 420, 1, 30], [-60, 640, 0, -50]] as const) {
    const a = settle(throwAt(emptied(s0), bx, 0, w, turn, sx));
    const b = v3.settle(v3.throwAt(emptied(v3.game.init(seed)), bx, 0, w, turn, sx));
    ok(JSON.stringify([a.x, a.y, a.live]) === JSON.stringify([b.x, b.y, b.live]), `curlRev 4 slides as curlRev 3 (broom ${bx}, weight ${w}, turn ${turn}, start ${sx})`);
  }
  ok(CURLING_STD_SPEC.rev === 4 && CURLING_STD_SPEC.parts.map((p) => `${p.key}:${p.max}`).join() === "core:150,takeouts:20,redring:20,hold:10" && CURLING_STD_SPEC.parts.reduce((a, p) => a + p.max, 0) === 200, "curlRev 4: core 150, takeouts 20, red ring 20, holding shot 10: 200");
  let idle = game.init(seed);
  while (!idle.over) idle = game.step(idle, null);
  ok(game.score(idle) === 0, "curlRev 4: no input scores 0");
  let played = settle(throwAt(game.init(seed), 200, 0, 1, 0, -CURL_START_MAX));
  while (!played.over) played = game.step(played, null);
  ok(game.score(played) >= 1, `curlRev 4: any throw scores at least 1 (${game.score(played)})`);
}

/* Determinism and input repair on curlRev 4. */
{
  const seed = CURLING_BANK_V4[1]!;
  const a = replayCurlingRun(seed, witnessV4[String(seed)]!, CURLING_REV);
  const b = replayCurlingRun(seed, witnessV4[String(seed)]!, CURLING_REV);
  ok(JSON.stringify(a.checkpoints) === JSON.stringify(b.checkpoints), "curlRev 4: the same log replays the same twice");
  const r = replayCurlingRun(seed, encodeCurlingRun({ seed, claimedScore: 0, events: [{ t: 3, k: 1, a: 0, b: 0, c: 600, d: 500 }], endTick: 0, checkpoints: [] }), CURLING_REV);
  ok(r.inputDiag.clamped === 1 && r.flagged, "curlRev 4: an out-of-range start is clamped, replayed and flagged");
  const v3seed = CURLING_BANK_V3[0]!;
  ok(replayCurlingRun(v3seed, witnessV3[String(v3seed)]!, CURLING_REV).flagged, "a curlRev 3 log is flagged as a curlRev 4 run");
  ok(!replayCurlingRun(v3seed, witnessV3[String(v3seed)]!, CURLING_REV_V3).flagged, "and replays unflagged as curlRev 3");
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL: ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} curling checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} curling checks`);
