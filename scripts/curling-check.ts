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
 * curlRev 2 (31 Oct 2026, Joe's notes: the start along the hog line, side brushing):
 *  - the bank (src/lib/duel/curlingBankV2.server.ts): every witness (scripts/fixtures/curling-witness-v2.json) scores
 *    exactly 200 through replayCurlingRun(…, 2), unflagged, eight on the button, every opponent out, holding shot; rooms
 *    deal only its sheets on curlRev 2;
 *  - the rules: the stone starts where it was slid to on the hog line (± CURL_START_MAX, an out-of-range start clamped
 *    and flagged); brushing its left bends it left and its right bends it right; brushing carries it further; brushing
 *    no longer halves the curl; with no brushing it slides exactly as on curlRev 1; no input scores 0, any throw 1+;
 *  - a curlRev 1 log is not a curlRev 2 run (its checkpoints carry the old checksum), and stroke sides are clamped.
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
  CURLING_STONES,
  CU,
  HOG_NEAR,
  TEAM_THEIRS,
  type CurlingState,
} from "../src/lib/arcade/curling";
import { decodeCurlingRun, encodeCurlingRun, replayCurlingRun } from "../src/lib/duel/curling";
import { CURLING_BANK } from "../src/lib/duel/curlingBank.server";
import { CURLING_BANK_V2 } from "../src/lib/duel/curlingBankV2.server";
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
const witnessV2: Record<string, string> = Object.fromEntries(witnessesV2.map((w) => [String(w.seed), witnessRaw(w, CURLING_REV)]));

ok(CURLING_REV === 2 && CURLING_REV_V1 === 1, "rooms deal curlRev 2; curlRev 1 is the first revision");

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
for (const seed of [...CURLING_BANK, ...CURLING_BANK_V2]) {
  const opp = curlingOpponents(seed);
  ok(JSON.stringify(opp) === JSON.stringify(curlingOpponents(seed)), `sheet ${seed}: the same seed places the same stones`);
  ok(opp.length >= 2 && opp.length <= 3 && opp.every((o) => curlInHouse(o.x * CU, o.y * CU)), `sheet ${seed}: two or three opponent stones, all in the house`);
  for (const rev of [CURLING_REV_V1, CURLING_REV]) {
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
  const run = replayCurlingRun(seed, witnessV2[String(seed)] ?? "", CURLING_REV);
  if (run.score === 200 && !run.flagged && run.onButton === CURLING_STONES && run.takeouts === run.opponents && run.holding && run.state.rev === CURLING_REV) perfectV2++;
}
ok(perfectV2 === CURLING_BANK_V2.length, `every curlRev 2 bank witness: eight on the button, every opponent out, holding shot, 200 through the server replay on curlRev 2 (${perfectV2} of ${CURLING_BANK_V2.length})`);
for (let i = 0; i < 50; i++) {
  const p = generateCurling();
  ok(CURLING_BANK_V2.includes(p.seed) && p.curlRev === CURLING_REV, `rooms deal a curlRev 2 bank sheet on curlRev 2 (${p.seed})`);
}

/* The rules. */
{
  const { game, throwAt, settle } = rulesFor(CURLING_REV);
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
  const a = replayCurlingRun(seed, witnessV2[String(seed)]!, CURLING_REV);
  const b = replayCurlingRun(seed, witnessV2[String(seed)]!, CURLING_REV);
  ok(JSON.stringify(a.checkpoints) === JSON.stringify(b.checkpoints), "curlRev 2: the same log replays the same twice");
  const r = replayCurlingRun(seed, encodeCurlingRun({ seed, claimedScore: 0, events: [{ t: 3, k: 1, a: 0, b: 0, c: 600, d: 500 }], endTick: 0, checkpoints: [] }), CURLING_REV);
  ok(r.inputDiag.clamped === 1 && r.flagged && r.state.x.at(-1) !== undefined, "curlRev 2: an out-of-range start is clamped, replayed and flagged");
  const side = replayCurlingRun(seed, encodeCurlingRun({ seed, claimedScore: 0, events: [{ t: 3, k: 1, a: 0, b: 0, c: 600, d: 0 }, { t: 30, k: 2, a: 50, b: 7, c: 0, d: 0 }], endTick: 0, checkpoints: [] }), CURLING_REV);
  ok(side.inputDiag.clamped === 1 && side.flagged, "curlRev 2: a stroke's side beyond ±1 is clamped and flagged");
  // A curlRev 1 witness's log, replayed as curlRev 2, desyncs (its checkpoints carry curlRev 1's checksum).
  const v1seed = CURLING_BANK[0]!;
  const cross = replayCurlingRun(v1seed, witness[String(v1seed)]!, CURLING_REV);
  ok(cross.flagged, "a curlRev 1 log is flagged as a curlRev 2 run");
}

if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL: ${f}`);
  console.log(`FAIL: ${failures.length} of ${checks} curling checks`);
  process.exit(1);
}
console.log(`PASS: ${checks} curling checks`);
