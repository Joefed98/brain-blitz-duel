/**
 * B4 (docs/audit-nov-2026/architecture.md): what a game deals is decided in one place, generate.server.ts
 * `generatePuzzle` (its base stamps, then DEAL_LAYERS in order), with every check's era switch in dealEra.ts and the
 * dealt signature in dealSignature.ts. Proves:
 *   1. every game deals exactly what main dealt before the move (scripts/fixtures/deal-identity.json.gz, recorded on
 *      main 318fd42 by scripts/deal-identity-record.ts): 6 seeds banked and live with nothing pinned, then each of the
 *      23 old pinX switches on its own, three pins together and two pinned score revisions on 2 seeds, and 16 whole
 *      rooms (buildRoomPuzzles: round order, stamps, each round in its context), all digested with key order kept;
 *   2. explicit DealOptions (`generatePuzzle(type, context, { pins })`, `withDealOptions`) deal exactly what the old
 *      pin did, and leave nothing pinned after, even on a throw;
 *   3. the dealt signature: dealtSignature(type) and LIVE_DEAL are each game's live stamps (the deal with nothing
 *      pinned, on three seeds), and no pin is left on.
 * Whole run ~6 min; CI runs it in four parts (`--part=k/4`, ~90 s each).
 */
import { readFileSync } from "node:fs";
import { gunzipSync } from "node:zlib";

import { FIXTURE, PIN_VARIANTS, SEEDS, TYPES, dealDigest, roomDigests, variantDigests, type DealIdentity } from "./deal-identity-lib";
import { DEAL_PIN_NAMES, activeDealPins, setDealPin, withDealOptions, type DealOptions, type DealPin } from "../src/lib/duel/dealEra";
import { LIVE_DEAL, dealtSignature, parseSignature, stampSignature } from "../src/lib/duel/dealSignature";
import { currentPracticeStamp } from "../src/lib/duel/practiceStamps";
import { DEAL_LAYERS, generatePuzzle } from "../src/lib/duel/generate.server";
import { splitPuzzle } from "../src/lib/duel/secrets";
import { withSeededRandom } from "../src/lib/duel/random";

let checks = 0;
const failures: string[] = [];
function ok(cond: unknown, label: string) {
  checks++;
  if (!cond) {
    failures.push(label);
    console.log(`FAIL ${label}`);
  }
}

const fixture = JSON.parse(gunzipSync(readFileSync(FIXTURE)).toString()) as DealIdentity;

/** The explicit options standing for each old pin (the score-revision pins and the combined one included). */
const OPTIONS_FOR: Record<string, DealOptions> = {
  ...Object.fromEntries(DEAL_PIN_NAMES.map((p) => [p, { pins: [p] }])),
  "preStandard+preTopup+preDepth": { pins: ["preStandard", "preTopup", "preDepth"] },
  scoreRev1: { puzzleScoreRev: 1 },
  scoreRev2: { puzzleScoreRev: 2 },
};

type Task = { name: string; run: () => void };
const tasks: Task[] = [];

// 1. Identity with main, one task per variant.
for (const [name, pin] of [["live", null] as const, ...Object.entries(PIN_VARIANTS)]) {
  tasks.push({
    name: `deals ${name}`,
    run: () => {
      const got: Record<string, string> = {};
      variantDigests(name, pin, pin ? SEEDS.pinSeeds : SEEDS.liveSeeds, got);
      const keys = Object.keys(fixture.deals).filter((k) => k.startsWith(`${name}|`));
      const diffs = keys.filter((k) => got[k] !== fixture.deals[k]);
      for (const k of diffs.slice(0, 8)) console.log(`  differs: ${k}`);
      ok(keys.length === TYPES.length * 2 * (pin ? SEEDS.pinSeeds : SEEDS.liveSeeds).length && Object.keys(got).length === keys.length, `${name}: ${keys.length} deals recorded, ${Object.keys(got).length} dealt`);
      ok(diffs.length === 0, `${name}: every deal identical to main (${diffs.length} differ)`);
      ok(activeDealPins().length === 0, `${name}: nothing left pinned (${activeDealPins().join(", ")})`);
    },
  });
}
tasks.push({
  name: "rooms",
  run: () => {
    const got = roomDigests(SEEDS.roomSeeds);
    const diffs = Object.keys(fixture.rooms).filter((k) => got[k] !== fixture.rooms[k]);
    ok(Object.keys(fixture.rooms).length === SEEDS.roomSeeds.length && diffs.length === 0, `rooms: ${SEEDS.roomSeeds.length} whole rooms identical to main (${diffs.length} differ)`);
  },
});

// 2. Explicit options deal exactly what the old pins did.
// Changed with Joe's approval, 13 Nov 2026: minesPreLogic is newer than main's recording and every deal here already
// pins it (deal-identity-lib.ts dealDigest), so it has no recorded variant of its own.
const optionNames = Object.keys(OPTIONS_FOR).filter((name) => name !== "minesPreLogic");
for (let half = 0; half < 2; half++) {
  tasks.push({
    name: `options ${half + 1}/2`,
    run: () => {
      for (const name of optionNames.filter((_, i) => i % 2 === half)) {
        const seed = SEEDS.pinSeeds[0]!;
        let diffs = 0;
        for (const type of TYPES) {
          if (dealDigest(type, seed, true, OPTIONS_FOR[name]) !== fixture.deals[`${name}|${type}|${seed}|b`]) diffs++;
        }
        ok(diffs === 0, `options ${name}: every game deals as the old pin did (${diffs} differ)`);
        ok(activeDealPins().length === 0, `options ${name}: nothing pinned after the call`);
      }
    },
  });
}
tasks.push({
  name: "options rules",
  run: () => {
    // Options replace what is pinned for the call, then restore it.
    const prev = setDealPin("preStandard", true);
    const inner = withDealOptions({ pins: ["preTopup"] }, () => activeDealPins().join(","));
    ok(inner === "preTopup", `options pin exactly their eras (${inner})`);
    ok(activeDealPins().join(",") === "preStandard", "the check's own pin is back after the call");
    setDealPin("preStandard", prev);
    try {
      withDealOptions({ pins: ["preDepth"], puzzleScoreRev: 1 }, () => {
        throw new Error("boom");
      });
    } catch {
      /* expected */
    }
    ok(activeDealPins().length === 0, "nothing left pinned after a throw");
    ok(withDealOptions(undefined, () => 7) === 7 && withDealOptions({}, () => 8) === 8, "no options run as they are");
    ok(DEAL_LAYERS.map((l) => l.name).join(" ") === "standard pipesPlaced puzzleNotes parMoves operatorGaps partialCredit wordNov7", "the layers in their order");
    const names = new Set<DealPin>(DEAL_PIN_NAMES);
    // Changed with Joe's approval, 13 Nov 2026: Minefield's minesPreLogic is the 24th era switch.
    ok(names.size === 24, `24 era switches (${names.size})`);
  },
});

// 3. The dealt signature.
tasks.push({
  name: "signature",
  run: () => {
    let wrong = 0;
    for (const type of TYPES) {
      for (const seed of SEEDS.liveSeeds.slice(0, 3)) {
        const sig = stampSignature(splitPuzzle(withSeededRandom(seed, () => generatePuzzle(type, { unblockRow: null, bankSeed: seed }))).pub);
        if (sig !== dealtSignature(type)) {
          wrong++;
          console.log(`  ${type}: deals "${sig}", signature "${dealtSignature(type)}"`);
        }
      }
      if (currentPracticeStamp(type) !== dealtSignature(type)) wrong++;
      if (stampSignature(LIVE_DEAL[type] ?? {}) !== dealtSignature(type)) wrong++;
    }
    ok(wrong === 0, `every game's dealt signature, practice stamp and LIVE_DEAL agree with its live deal (${wrong} wrong)`);
    ok(Object.keys(LIVE_DEAL).length === TYPES.length, `LIVE_DEAL lists every game (${Object.keys(LIVE_DEAL).length} of ${TYPES.length})`);
    ok(JSON.stringify(parseSignature("aRev=2 speedPar=1")) === '{"aRev":2,"speedPar":1}' && JSON.stringify(parseSignature("")) === "{}", "parseSignature");
    ok(dealtSignature("not-a-game") === "", "an unknown id has no signature");
  },
});

const partArg = process.argv.find((a) => a.startsWith("--part="));
const [k, n] = partArg ? partArg.slice(7).split("/").map(Number) : [1, 1];
const mine = tasks.filter((_, i) => i % n! === k! - 1);
for (const task of mine) {
  const started = Date.now();
  task.run();
  console.log(`  ${task.name}: ${Date.now() - started} ms`);
}

console.log(failures.length ? `FAIL: ${failures.length} of ${checks} checks failed` : `deal-identity-check${partArg ? ` ${k}/${n}` : ""}: ${checks} passed`);
process.exit(failures.length ? 1 : 0);
