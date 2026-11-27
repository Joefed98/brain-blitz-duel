/**
 * Records scripts/fixtures/swing-ladder-legacy-catch.json.gz: swingRev 18 runs the pterodactyl catches, at Normal, Hard
 * and Expert, on the sim as it was before swingRev 19 (D5, 23 Nov 2026), for swing-ladder-check: the main legacy fixture's
 * players outrun or never reach the last quarter's pterodactyl, so these runs prove its catch path is unchanged. Each is
 * a proof-player log from scripts/fixtures/swing-ladder-legacy.json.gz cut where the hero starts the stretch after the
 * pterodactyl comes in, then no input: it hangs (or stands) there until caught, again and again to the end. Run it with
 * the earlier sim copied beside the live one:
 *
 *   git show <commit>:src/lib/arcade/swing.ts > src/lib/arcade/swing.orig.ts
 *   bun scripts/swing-ladder-legacy-catch-record.ts
 *   rm src/lib/arcade/swing.orig.ts
 *
 * (Recorded with swing.ts as on 428cd79a, the D5 branch the ladder was built on.) Each run stores the dealt puzzle, the
 * log, and the earlier sim's final score, restarts, catches and checkpoint checksums.
 */
import { readFileSync, writeFileSync } from "node:fs";
import { gunzipSync, gzipSync } from "node:zlib";
import { packEvents, SWING_LADDER_LEGACY, unpackEvents, type LegacyDeal } from "./swing-ladder-legacy-record";

export const SWING_LADDER_LEGACY_CATCH = new URL("./fixtures/swing-ladder-legacy-catch.json.gz", import.meta.url);
export interface CatchRun { level: string; puzzle: Record<string, unknown>; events: number[][]; score: number; restarts: number; caught: number; sums: number[] }

if (import.meta.main) {
  // The earlier sim, copied in only while recording (see above); loaded only here, so the check can import this file.
  const old = await import("../src/lib/arcade/swing" + ".orig");
  const fixture = JSON.parse(gunzipSync(readFileSync(SWING_LADDER_LEGACY)).toString()) as { deals: LegacyDeal[] };
  const runs: CatchRun[] = [];
  const seen = new Set<string>();
  for (const d of fixture.deals) {
    if (d.level === "easy") continue;
    const p = d.puzzle as unknown as { seed: number; swingRev: number; level?: string };
    if (seen.has(`${d.level}|${p.seed}`)) continue;
    seen.add(`${d.level}|${p.seed}`);
    const game = old.swingGameFor(p.swingRev, p.level);
    const events = unpackEvents(d.runs.find((r) => r.player === "perfect+limits")!.events);
    // Where the cut goes: the tick the proof run starts the stretch after the pterodactyl's.
    let s = game.init(p.seed);
    const byT = new Map(events.map((e) => [e.t, e]));
    let cut = -1;
    while (!game.isOver(s)) {
      s = game.step(s, byT.get(s.tick + 1) ?? null);
      if (cut < 0 && (s.sec ?? 0) >= (s.chaseFrom ?? 999) + 1) cut = s.tick;
    }
    if (cut < 0) continue;
    const kept = events.filter((e) => e.t <= cut);
    let t = game.init(p.seed);
    const at = new Map(kept.map((e) => [e.t, e]));
    const sums: number[] = [];
    while (!game.isOver(t)) {
      t = game.step(t, at.get(t.tick + 1) ?? null);
      if (t.tick % old.SWING_CHECKPOINT_INTERVAL === 0) sums.push(old.swingCheckpoint(t).checksum);
    }
    runs.push({ level: d.level, puzzle: d.puzzle as unknown as Record<string, unknown>, events: packEvents(kept), score: game.score(t), restarts: t.restarts ?? 0, caught: t.caught ?? 0, sums });
    console.log(d.level, p.seed, "cut at", cut, "score", game.score(t), "caught", t.caught ?? 0);
  }
  writeFileSync(SWING_LADDER_LEGACY_CATCH, gzipSync(JSON.stringify({ note: "Grappler swingRev 18 runs the pterodactyl catches (Normal, Hard, Expert), on the sim before swingRev 19: scripts/swing-ladder-legacy-catch-record.ts", runs })));
  console.log(`wrote ${runs.length} runs`);
}
