/**
 * sound-retheme-check (6 Nov 2026): Joe's recordings for the re-themed games (Spacewalk, Grappler's jungle canopy,
 * Swish's boardwalk, Flightpath's darts stall, Slice's chilli, Eagle Eye's eagle), cut and levelled by
 * scripts/sound-retheme-nov-2026/process.py on sound-nov-2026's method (docs/sound-cues/retheme-nov-2026.md has the
 * before/after table; docs/sound-cues/mapping-retheme-nov-2026.csv maps each file to its slot). A sibling of
 * sound-nov-2026-check, on the same stubbed Web Audio.
 *
 *  1. Every mapped file is in public/sounds and its slot plays it; effects and effect loops are mono 96 kbps, the bed
 *     and the ambience beds stereo 128 kbps, all MPEG-1 Layer III at 44.1 kHz with a LAME tag; every effect at least
 *     120 ms; the manifest's `ms` the file's own length within a frame. Rainbow Bridge's cloud bounce keeps the old
 *     footstep (now `inkbridge.cloudBounce.mp3`, the same bytes), and the slots Joe kept (Flightpath's thud and bull,
 *     Pipeline's flow) are unchanged.
 *  2. Each cue fires at its moment in play: Spacewalk (crossRev 11), Grappler (swingRev 17), Swish (binRev 9),
 *     Flightpath (bullRev 9) and Slice (sliceRev 12) are played by their skill-band bots through the sim with the
 *     game's real sound observer on every tick (the clock stepping 1/60 s a tick, so play caps hold as in a round).
 *     Every new slot must play its own file; moments the sim counts must match their plays exactly; each loop and
 *     ambience bed starts looping while the run is live and is stopped when it ends.
 *  3. The ambience beds respect the settings: none starts with the effects muted or with the music muted.
 *  4. Spacewalk's round bed is music_cross and loops; Eagle Eye's take-off dispatches symscan.eagle, which plays its file.
 *
 *   bun scripts/sound-retheme-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";
import { parseCsv } from "./sound-cue-sheet";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

type Entry = { channel: string; url: string | null; loop?: boolean; ms: number; gapMs?: number };
const manifest = SOUND_MANIFEST as unknown as Record<string, Entry>;

/** An MP3's frames: sample rate, channels and bitrate of each, and the LAME tag's delay and padding. */
interface Mp3Info {
  sampleRate: number;
  stereo: boolean;
  bitrates: Set<number>;
  version: number;
  layer: number;
  frames: number;
  delay: number;
  padding: number;
}
const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const RATES = [44100, 48000, 32000];
function readMp3(bytes: Uint8Array): Mp3Info | null {
  let at = 0;
  if (bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33)
    at = 10 + ((bytes[6]! << 21) | (bytes[7]! << 14) | (bytes[8]! << 7) | bytes[9]!);
  const info: Mp3Info = { sampleRate: 0, stereo: false, bitrates: new Set(), version: 0, layer: 0, frames: 0, delay: 0, padding: 0 };
  let first = true;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff || (bytes[at + 1]! & 0xe0) !== 0xe0) break;
    const version = (bytes[at + 1]! >> 3) & 3;
    const layer = (bytes[at + 1]! >> 1) & 3;
    const bitrate = BITRATES[bytes[at + 2]! >> 4] ?? 0;
    const rate = RATES[(bytes[at + 2]! >> 2) & 3] ?? 0;
    const pad = (bytes[at + 2]! >> 1) & 1;
    const mode = bytes[at + 3]! >> 6;
    if (!bitrate || !rate) return null;
    const size = Math.floor((144000 * bitrate) / rate) + pad;
    const side = mode === 3 ? 17 : 32;
    const tag = String.fromCharCode(...bytes.slice(at + 4 + side, at + 8 + side));
    if (first && (tag === "Xing" || tag === "Info")) {
      const d = at + 4 + side + 120 + 21;
      info.delay = (bytes[d]! << 4) | (bytes[d + 1]! >> 4);
      info.padding = ((bytes[d + 1]! & 0x0f) << 8) | bytes[d + 2]!;
    } else {
      info.frames++;
      info.bitrates.add(bitrate);
      info.sampleRate = rate;
      info.stereo = mode !== 3;
      info.version = version;
      info.layer = layer;
    }
    first = false;
    at += size;
  }
  return info.frames ? info : null;
}

/** SHA-256 of public/sounds/cross.hop.mp3 on main 48cf4f15, the footstep Rainbow Bridge keeps. */
const OLD_HOP_SHA = "168172e98f5f7903a708b09cac6d8c2558f86b8f13e463b449152c63d51162f7";

/* ------------------------------------------------------------- 1. files */

const [head, ...body] = parseCsv(readFileSync("docs/sound-cues/mapping-retheme-nov-2026.csv", "utf8"));
const col = (name: string) => head!.indexOf(name);
const rows = body
  .filter((r) => r.length > 1)
  .map((r) => ({ file: r[col("file")]!, cues: r[col("cues")]!.split(";").filter(Boolean), source: r[col("source")]!, kind: r[col("kind")]! }));
check(rows.length === 24, `${rows.length} files mapped, the batch has 24 (Joe's 24 uploads)`);
check(new Set(rows.map((r) => r.source)).size === rows.length, "each upload is mapped once");
const newCues = new Set<string>();
for (const { file, cues, kind } of rows) {
  const path = `public/sounds/${file}`;
  if (!existsSync(path)) {
    failures.push(`${file}: missing from public/sounds`);
    continue;
  }
  const mp3 = readMp3(new Uint8Array(readFileSync(path)));
  if (!mp3) {
    failures.push(`${file}: not a readable MP3`);
    continue;
  }
  const ms = ((mp3.frames * 1152 - mp3.delay - mp3.padding) / mp3.sampleRate) * 1000;
  for (const cue of cues) {
    newCues.add(cue);
    const e = manifest[cue];
    check(!!e && e.url === `/sounds/${file}`, `${cue}: must play /sounds/${file} (has ${e?.url})`);
    if (e && e.channel !== "music") check(Math.abs(e.ms - ms) <= 27, `${cue}: manifest ms ${e.ms} is not the file's ${Math.round(ms)} ms`);
    if (e) check(!!e.loop === (kind === "loop" || kind === "ambience"), `${cue}: loop flag must be ${kind === "loop" || kind === "ambience"}`);
    if (e) check(e.channel === (kind === "music" ? "music" : "effects"), `${cue}: channel ${e.channel}`);
  }
  const stereo = kind === "music" || kind === "ambience";
  const rate = stereo ? 128 : 96;
  check(mp3.version === 3 && mp3.layer === 1 && mp3.sampleRate === 44100, `${file}: must be MPEG-1 Layer III at 44.1 kHz`);
  check(mp3.stereo === stereo && mp3.bitrates.size === 1 && mp3.bitrates.has(rate), `${file}: must be ${stereo ? "stereo" : "mono"} ${rate} kbps throughout`);
  check(mp3.delay > 0, `${file}: no LAME delay/padding tag`);
  if (kind === "effect") check(ms >= 120, `${file}: ${Math.round(ms)} ms is too short (over-trimmed)`);
  if (kind === "loop") check(Math.abs(ms - 2000) <= 2, `${file}: the 2 s loop is ${Math.round(ms)} ms`);
  if (kind === "ambience") check(Math.abs(ms - 8000) <= 2, `${file}: the 8 s ambience loop is ${Math.round(ms)} ms`);
}
// Rainbow Bridge's cloud bounce kept the old footstep (the same bytes as cross.hop.mp3 on main before this batch).
check(manifest["inkbridge.cloudBounce"]?.url === "/sounds/inkbridge.cloudBounce.mp3", "inkbridge.cloudBounce: plays inkbridge.cloudBounce.mp3");
{
  const sha = createHash("sha256").update(readFileSync("public/sounds/inkbridge.cloudBounce.mp3")).digest("hex");
  check(sha === OLD_HOP_SHA, "inkbridge.cloudBounce.mp3: not the old cross.hop.mp3 (main 48cf4f15)");
}
// The slots Joe kept (no new file): unchanged.
check(manifest["bullseye.thud"]?.url === null && manifest["bullseye.bull"]?.url === null, "bullseye.thud / bullseye.bull: keep their shared sounds");
check(manifest["pipes.flow"]?.url === "/sounds/pipes.flow.mp3", "pipes.flow: keeps its file");
check(manifest["swing.pteroCatch"]?.url === "/sounds/clayshoot.birdStartle.mp3", "swing.pteroCatch: keeps the library's screech (no new file)");
check(manifest["cross.traffic"]?.url === "/sounds/bastion.drone.mp3", "cross.traffic: keeps the library's drone loop (no new loop)");

/* ------------------------------------------------------------- stubbed audio */

// A fake clock: sound.ts's idle timer, play caps (performance.now) and voice timing (Date.now) all follow it.
let now = 0;
let timerId = 0;
const timers = new Map<number, { at: number; fn: () => void }>();
const realSetTimeout = globalThis.setTimeout;
Object.assign(globalThis, {
  setTimeout: (fn: () => void, ms = 0) => {
    timers.set(++timerId, { at: now + ms, fn });
    return timerId;
  },
  clearTimeout: (id: number) => void timers.delete(id),
});
Object.defineProperty(globalThis, "performance", { value: { now: () => now }, configurable: true, writable: true });
const flush = () => new Promise<void>((resolve) => realSetTimeout(resolve, 0));
async function advance(ms: number): Promise<void> {
  const end = now + ms;
  for (;;) {
    await flush();
    const due = [...timers.entries()].filter(([, t]) => t.at <= end).sort((a, b) => a[1].at - b[1].at)[0];
    if (!due) break;
    timers.delete(due[0]);
    now = due[1].at;
    due[1].fn();
  }
  now = end;
  await flush();
}

interface FakeSource {
  url: string;
  loop: boolean;
  started: boolean;
  stopped: boolean;
}
const sources: FakeSource[] = [];
const param = () => ({ value: 1, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
const node = () => ({ connect: (next: unknown) => next ?? node(), disconnect() {} });
class FakeAudioContext {
  state = "running";
  get currentTime() {
    return now / 1000;
  }
  sampleRate = 44100;
  destination = node();
  createGain() {
    return { ...node(), gain: param() };
  }
  createBiquadFilter() {
    return { ...node(), frequency: param(), type: "" };
  }
  createOscillator() {
    return { ...node(), frequency: param(), type: "", start() {}, stop() {}, addEventListener() {} };
  }
  createBuffer(_c: number, length: number, sampleRate: number) {
    return { duration: length / sampleRate, length, numberOfChannels: 1, sampleRate, getChannelData: () => new Float32Array(length) };
  }
  createBufferSource() {
    const ended: (() => void)[] = [];
    const record: FakeSource = { url: "", loop: false, started: false, stopped: false };
    const source = {
      ...node(),
      buffer: null as { url: string } | null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      playbackRate: param(),
      onended: null,
      addEventListener: (type: string, fn: () => void) => void (type === "ended" && ended.push(fn)),
      start() {
        record.url = source.buffer?.url ?? "";
        record.loop = source.loop;
        record.started = true;
        sources.push(record);
        if (!source.loop) void Promise.resolve().then(() => ended.forEach((fn) => fn()));
      },
      stop() {
        if (record.stopped) return;
        record.stopped = true;
        void Promise.resolve().then(() => ended.forEach((fn) => fn()));
      },
    };
    return source;
  }
  decodeAudioData(bytes: ArrayBuffer) {
    const url = new TextDecoder().decode(bytes);
    const length = 44100;
    const data = new Float32Array(length).fill(0.5);
    return Promise.resolve({ duration: 1, length, numberOfChannels: 1, sampleRate: 44100, url, getChannelData: () => data });
  }
  suspend() {
    this.state = "suspended";
    return Promise.resolve();
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  addEventListener() {}
}
const fakeDoc = { visibilityState: "visible", addEventListener() {}, removeEventListener() {} };
const store = new Map<string, string>();
const fakeWin = Object.assign(new EventTarget(), {
  AudioContext: FakeAudioContext,
  location: { search: "" },
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
  setTimeout: (fn: () => void, ms?: number) => (globalThis.setTimeout as (f: () => void, m?: number) => number)(fn, ms),
  clearTimeout: (id: number) => globalThis.clearTimeout(id),
  devicePixelRatio: 2,
});
Object.assign(globalThis, {
  window: fakeWin,
  document: fakeDoc,
  fetch: async (url: string) => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer }),
});
const EPOCH = Date.now();
Date.now = () => EPOCH + now;
const sound = await import("../src/lib/sound");
sound.unlockAudio();
sound.installSoundCueBridge();
const want = [...newCues].filter((c) => manifest[c]?.channel === "effects");
for (let i = 0; i < 400 && !want.every((id) => sound.soundDiagnostics().loaded.includes(id)); i++) await flush();
check(want.every((id) => sound.soundDiagnostics().loaded.includes(id)), `every new effect decodes (${want.filter((id) => !sound.soundDiagnostics().loaded.includes(id)).join(", ")})`);
const plays = (file: string) => sources.filter((x) => x.url === `/sounds/${file}`).length;
const live = (file: string) => sources.filter((x) => x.url === `/sounds/${file}` && x.loop && !x.stopped).length;
const settle = async () => {
  for (let i = 0; i < 2; i++) await flush();
};

/* ------------------------------------------------------------- 2. cues in play */

const { GAME_BY_TYPE } = await import("./arcade-skill-bands/games");
const { Human } = await import("./arcade-skill-bands/human");
const gs = await import("../src/lib/fx/gameSounds");
const bits = (n: number) => {
  let c = 0;
  for (let b = n; b; b &= b - 1) c++;
  return c;
};

/** A one-shot's moment count from the state before a tick and after (null: a capped or replaced cue, proved to play). */
type Count = ((p: any, s: any) => number) | null;
interface GameRun {
  type: string;
  rev: number;
  levels: readonly string[];
  seeds: number;
  observer: () => { frame: (s: any, running: boolean) => void; stop: () => void };
  /** Each new one-shot's file and, where the sim counts the moment itself, how many it counted this tick. */
  counted: Record<string, Count>;
  /**
   * Loops and ambience beds: null plays for the whole live run, a function plays exactly while it is true (both
   * checked every half second of play), "seen" must start in some run (the sliding vines: whenever one slides on screen).
   */
  loops: Record<string, ((s: any) => boolean) | null | "seen">;
}
const ALL = ["weak", "average", "good", "great", "elite", "perfect"] as const;
const GAME_RUNS: GameRun[] = [
  {
    type: "cross",
    rev: 11,
    levels: ALL,
    seeds: 3,
    observer: gs.crossSounds,
    counted: {
      "cross.lifeLost.mp3": (p, s) => (s.lives < p.lives ? 1 : 0),
      "cross.crossed.mp3": (p, s) => (s.lives >= p.lives && s.crossings > p.crossings ? 1 : 0),
      // The hop is capped (90 ms) and left out on a frame a pass-by moment sounds.
      "cross.hop.mp3": null,
      "cross.pastBikes.mp3": null,
      "cross.pastRoadworks.mp3": null,
      "cross.streakUp.mp3": (p, s) => ((s.streakPts ?? 0) > (p.streakPts ?? 0) ? 1 : 0),
      "cross.closeCall.mp3": (p, s) => ((s.closeCalls ?? 0) > (p.closeCalls ?? 0) ? 1 : 0),
      // Capped at one per 600 ms: at most one play a tick that crosses a freighter lane.
      "cross.freighter.mp3": null,
    },
    loops: {},
  },
  {
    type: "swing",
    rev: 17,
    levels: ["average", "great", "elite"],
    seeds: 2,
    observer: gs.swingSounds,
    counted: {
      "swing.vineCreak.mp3": (p, s) => ((s.restarts ?? 0) === (p.restarts ?? 0) && s.ended !== 2 && p.rope < 0 && s.rope >= 0 ? 1 : 0),
      "swing.release.mp3": null,
      "swing.land.mp3": (p, s) => ((s.restarts ?? 0) === (p.restarts ?? 0) && (p.ledgeOn ?? -1) < 0 && (s.ledgeOn ?? -1) >= 0 ? 1 : 0),
      "swing.gate.mp3": (p, s) => bits(s.gatesLit ?? 0) - bits(p.gatesLit ?? 0) > 0 ? 1 : 0,
      "swing.streak.mp3": (p, s) => ((s.streakPaid ?? 0) > (p.streakPaid ?? 0) ? 1 : 0),
      "swing.splash.mp3": (p, s) => (s.ended !== 2 && (s.restarts ?? 0) > (p.restarts ?? 0) && !((s.caught ?? 0) > (p.caught ?? 0)) ? 1 : 0),
      "swing.pterodactyl.mp3": (p, s) => ((s.chaseX ?? 0) !== 0 && (p.chaseX ?? 0) === 0 ? 1 : 0),
    },
    loops: {
      "swing.jungle.mp3": null,
      "swing.wings.mp3": (s) => (s.chaseX ?? 0) !== 0,
      "swing.slideVine.mp3": "seen",
    },
  },
  {
    type: "bintoss",
    rev: 9,
    levels: ALL,
    seeds: 2,
    observer: gs.binTossSounds,
    counted: {
      // Each windy throw as it comes into hand (the first one on the run's first frame, counted there).
      "bintoss.wind.mp3": (p, s) => (p.phase !== 0 && s.phase === 0 && (s.winds[s.throwIndex] ?? 0) !== 0 ? 1 : 0),
    },
    loops: { "bintoss.ambience.mp3": null },
  },
  {
    type: "bullseye",
    rev: 9,
    levels: ["average", "elite"],
    seeds: 2,
    observer: gs.bullseyeSounds,
    counted: {},
    loops: { "bullseye.ambience.mp3": null },
  },
  {
    type: "slice",
    rev: 12,
    levels: ["average", "elite"],
    seeds: 2,
    observer: gs.sliceSounds,
    // At most one per 150 ms.
    counted: { "slice.chilli.mp3": null },
    loops: {},
  },
];
const report: string[] = [];
const TICK_MS = 1000 / 60;
for (const run of GAME_RUNS) {
  const spec = GAME_BY_TYPE.get(run.type as never)! as any;
  const { bot } = (await import(`./arcade-skill-bands/bots/${run.type}.ts`)) as { bot: (ctx: any) => { events?: any[] } };
  const files = Object.keys(run.counted);
  const before = Object.fromEntries([...files, ...Object.keys(run.loops)].map((f) => [f, plays(f)]));
  const sums: Record<string, number> = {};
  const loopRuns: Record<string, number> = {};
  for (let n = 0; n < run.seeds; n++) {
    for (const level of run.levels) {
      const seed = spec.seedForRev?.(n, run.rev) ?? spec.seedFor(n);
      const game = spec.gameFor(run.rev, seed);
      const events = bot({ game, seed, rev: run.rev, human: new Human(run.type as never, seed, level) }).events ?? [];
      const obs = run.observer();
      const byTick = new Map(events.map((e: any) => [e.t, e]));
      let s = game.init(seed);
      const counts = Object.fromEntries(files.map((f) => [f, plays(f)]));
      const moments: Record<string, number> = {};
      // The first throw in hand is announced on the run's first frame.
      if (run.type === "bintoss" && (s.winds[s.throwIndex] ?? 0) !== 0) moments["bintoss.wind.mp3"] = 1;
      obs.frame(s, true);
      const loopSeen = new Set<string>();
      const loopWrong: string[] = [];
      while (!game.isOver(s) && s.tick < game.runTicks) {
        const p = s;
        s = game.step(s, byTick.get(s.tick + 1) ?? null);
        now += TICK_MS;
        for (const [f, count] of Object.entries(run.counted)) if (count) moments[f] = (moments[f] ?? 0) + count(p, s);
        obs.frame(s, true);
        if (s.tick % 30 === 0) {
          await settle();
          for (const [f, when] of Object.entries(run.loops)) {
            if (s.ended !== undefined && s.ended !== 0) continue;
            if (live(f) > 0) loopSeen.add(f);
            if (when !== "seen") {
              const on = when === null || when(s);
              if (live(f) !== (on ? 1 : 0)) loopWrong.push(`${f} ${on ? "silent" : "playing"} at tick ${s.tick}`);
            }
          }
        }
      }
      obs.frame(s, false);
      obs.stop();
      await settle();
      await advance(1000);
      for (const [f, k] of Object.entries(moments)) {
        sums[f] = (sums[f] ?? 0) + k;
        const got = plays(f) - counts[f]!;
        check(got === k, `${run.type} seed ${seed} ${level}: ${f} played ${got} times for ${k} moments`);
      }
      check(loopWrong.length === 0, `${run.type} seed ${seed} ${level}: ${loopWrong.slice(0, 3).join("; ")}`);
      for (const f of Object.keys(run.loops)) {
        if (run.loops[f] === null) check(loopSeen.has(f), `${run.type} seed ${seed} ${level}: ${f} not looping while the run is live`);
        if (loopSeen.has(f)) loopRuns[f] = (loopRuns[f] ?? 0) + 1;
        check(live(f) === 0, `${run.type} seed ${seed} ${level}: ${f} still looping after the run`);
      }
    }
  }
  for (const f of files) {
    const k = plays(f) - before[f]!;
    check(k > 0, `${run.type}: ${f} never played in ${run.seeds * run.levels.length} bot runs`);
    report.push(`${f.padEnd(26)} ${String(k).padStart(5)} plays${sums[f] !== undefined ? ` (sim count ${sums[f]})` : ""}`);
  }
  for (const f of Object.keys(run.loops)) {
    const k = plays(f) - before[f]!;
    check(k > 0 && (loopRuns[f] ?? 0) > 0, `${run.type}: loop ${f} never started in ${run.seeds * run.levels.length} bot runs`);
    report.push(`${f.padEnd(26)} looped in ${loopRuns[f] ?? 0} of ${run.seeds * run.levels.length} runs`);
  }
}
// Every earlier swing course keeps the assault zap on its gates: swingRev 16 sounds no swing.gate.
{
  const spec = GAME_BY_TYPE.get("swing" as never)! as any;
  const { bot } = (await import("./arcade-skill-bands/bots/swing.ts")) as { bot: (ctx: any) => { events?: any[] } };
  const seed = spec.seedForRev(0, 16);
  const game = spec.gameFor(16, seed);
  const events = bot({ game, seed, rev: 16, human: new Human("swing" as never, seed, "elite") }).events ?? [];
  const byTick = new Map(events.map((e: any) => [e.t, e]));
  const obs = gs.swingSounds();
  const gate = plays("swing.gate.mp3");
  const vine = plays("swing.vineCreak.mp3");
  const jungle = plays("swing.jungle.mp3");
  let s = game.init(seed);
  let lit = 0;
  obs.frame(s, true);
  while (!game.isOver(s) && s.tick < game.runTicks) {
    const p = s;
    s = game.step(s, byTick.get(s.tick + 1) ?? null);
    now += TICK_MS;
    lit += bits(s.gatesLit ?? 0) > bits(p.gatesLit ?? 0) ? 1 : 0;
    obs.frame(s, true);
    if (s.tick % 30 === 0) await settle();
  }
  obs.stop();
  await settle();
  check(lit > 0, "swingRev 16: the elite bot lit no gate (the check needs one)");
  check(plays("swing.gate.mp3") === gate && plays("swing.vineCreak.mp3") === vine && plays("swing.jungle.mp3") === jungle, "swingRev 16 (the cave) plays none of the jungle's sounds");
  report.push(`swingRev 16: ${lit} gates lit, no jungle sound`);
}

/* ------------------------------------------------------------- 3. settings */

{
  const spec = GAME_BY_TYPE.get("bintoss" as never)! as any;
  const seed = spec.seedFor(0);
  const game = spec.gameFor(9, seed);
  const tryBed = async (label: string, expect: boolean) => {
    const obs = gs.binTossSounds();
    const n = plays("bintoss.ambience.mp3");
    const s = game.init(seed);
    obs.frame(s, true);
    await settle();
    obs.frame({ ...s, tick: s.tick + 1 }, true);
    await settle();
    check((plays("bintoss.ambience.mp3") > n) === expect, `ambience with ${label}: ${expect ? "must" : "must not"} play`);
    obs.stop();
    await advance(1000);
  };
  sound.setMusicMuted(true);
  await tryBed("the music muted", false);
  sound.setMusicMuted(false);
  sound.setMuted(true);
  await tryBed("the effects muted", false);
  sound.setMuted(false);
  sound.setMusicVolume(0);
  await tryBed("the music at zero", false);
  sound.setMusicVolume(1);
  await tryBed("both on", true);
}

/* ------------------------------------------------------------- 4. bed and Eagle Eye */

const { roundMusicFor } = await import("../src/lib/fx/theme");
check(roundMusicFor("cross" as never, "arcade") === "music_cross", `cross: round music is ${roundMusicFor("cross" as never, "arcade")}`);
check(roundMusicFor("freekick" as never, "arcade") === "music_freekick" && roundMusicFor("minigolf" as never, "arcade") === "music_minigolf", "Top Bins and Crazy Golf keep their own beds");
{
  const n = plays("music_cross.mp3");
  sound.startMusic("music_cross" as never);
  for (let i = 0; i < 100 && plays("music_cross.mp3") === n; i++) await flush();
  const started = sources.filter((x) => x.url === "/sounds/music_cross.mp3").at(-1);
  check(plays("music_cross.mp3") > n && !!started?.loop, "music_cross: starts and loops");
  report.push(`${"music_cross.mp3".padEnd(26)} starts, looping`);
  sound.stopMusic(0);
  await advance(1000);
}
{
  const art = readFileSync("src/puzzles/eagleEyeArt.tsx", "utf8");
  check(/soundCue\("symscan\.takeoff"\);\s*\n(?:\s*\/\/[^\n]*\n)*\s*soundCue\("symscan\.eagle"\);/.test(art), "Eagle Eye: the take-off dispatches symscan.eagle with symscan.takeoff");
  const { soundCue } = await import("../src/lib/fx/soundCues");
  const n = plays("symscan.eagle.mp3");
  soundCue("symscan.eagle");
  await settle();
  check(plays("symscan.eagle.mp3") === n + 1, "symscan.eagle: the cue plays its file");
  report.push(`${"symscan.eagle.mp3".padEnd(26)} plays on the take-off cue`);
}

for (const line of report) console.log(`  ${line}`);
if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL ${f}`);
  console.log(`\nFAIL sound-retheme-check: ${failures.length} failures, ${passes} passes`);
  process.exit(1);
}
console.log(`\nPASS sound-retheme-check: ${passes} checks`);
