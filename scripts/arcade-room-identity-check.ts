/**
 * Room identity for the 200-point arcade expansions (26 Oct 2026, the arcade rule): every player in a room
 * plays the same seed, and the run's spawns, pickups and feature schedules must come from that seed alone,
 * never from how a player has played. Each expanded game exports `roomIdentity` from
 * `scripts/room-identity/<type>.ts`: its stamp, a few very different input logs for a seed (idle, random,
 * weak and elite bots …) and `scheduleOf`, which replays a log on the stamp and lists every seeded spawn,
 * pickup and feature appearance with its tick. For every game and seed the lists must agree over the ticks
 * every log's run lived (a run that ended early is compared up to its last tick).
 *
 *   bun scripts/arcade-room-identity-check.ts            # 12 room seeds a game
 *   ROOM_IDENTITY_SEEDS=40 bun scripts/arcade-room-identity-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { readdirSync } from "node:fs";
import { roomSeed } from "./arcade-skill-bands/games";

const SEEDS = Number(process.env.ROOM_IDENTITY_SEEDS ?? 12);
let failures = 0;
let passes = 0;
const fail = (msg: string) => {
  failures++;
  console.log(`FAIL ${msg}`);
};

interface Entry {
  t: number;
  what: string;
}
interface RoomIdentity {
  type: string;
  rev: number;
  /** The seed a room deals for room seed index n (defaults to the room seed itself). */
  seedFor?: (n: number) => number;
  /** Very different input logs for a seed (`{ name, log }`, or bare logs). */
  logs: (seed: number) => unknown[];
  scheduleOf: (seed: number, rev: number, log: unknown) => { entries: Entry[]; endTick: number } | Entry[];
}

const dir = new URL("./room-identity/", import.meta.url);
const files = readdirSync(dir).filter((f) => f.endsWith(".ts")).sort();
if (files.length === 0) fail("no scripts/room-identity/*.ts modules");

for (const file of files) {
  const mod = (await import(new URL(file, dir).href)) as { roomIdentity?: RoomIdentity };
  const id = mod.roomIdentity;
  if (!id) {
    fail(`${file}: exports no roomIdentity`);
    continue;
  }
  let compared = 0;
  let entries = 0;
  for (let n = 0; n < SEEDS; n++) {
    const seed = id.seedFor ? id.seedFor(n) : roomSeed(n);
    const logs = id.logs(seed).map((l: any, i) => (l && typeof l === "object" && "log" in l && "name" in l ? l : { name: `log ${i}`, log: l }));
    const runs = logs.map(({ name, log }) => {
      const out = id.scheduleOf(seed, id.rev, log);
      const list = Array.isArray(out) ? out : out.entries;
      const end = Array.isArray(out) ? (list.at(-1)?.t ?? 0) : out.endTick;
      return { name, list, end };
    });
    if (runs.length < 3) {
      fail(`${id.type} seed ${seed}: fewer than three input logs to compare`);
      continue;
    }
    const upTo = Math.min(...runs.map((r) => r.end));
    const base = runs[0]!.list.filter((e) => e.t <= upTo).map((e) => `${e.t}:${e.what}`);
    entries += base.length;
    for (const r of runs.slice(1)) {
      const got = r.list.filter((e) => e.t <= upTo).map((e) => `${e.t}:${e.what}`);
      compared++;
      const at = base.findIndex((e, i) => got[i] !== e);
      if (got.length !== base.length || at >= 0) {
        const i = at >= 0 ? at : Math.min(base.length, got.length);
        fail(`${id.type} rev ${id.rev} seed ${seed}: "${r.name}" sees ${got[i] ?? "nothing"} where "${runs[0]!.name}" sees ${base[i] ?? "nothing"} (entry ${i}, up to tick ${upTo})`);
      }
    }
  }
  if (entries === 0) fail(`${id.type}: no schedule entries at all (the schedule lists nothing)`);
  else {
    passes++;
    console.log(`PASS ${id.type} rev ${id.rev}: ${SEEDS} seeds, ${compared} log pairs, ${entries} schedule entries agree`);
  }
}

console.log(failures ? `\nFAIL: ${failures} failure(s)` : `\nPASS: ${passes} game(s), every player in a room sees the same spawns, pickups and schedules`);
process.exit(failures ? 1 : 0);
