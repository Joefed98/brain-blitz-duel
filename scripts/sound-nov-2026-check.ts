/**
 * sound-nov-2026-check (3 Nov 2026): Joe's November recordings (docs/sound-cues/mapping-nov-2026.csv,
 * voice-lines-nov-2026.csv), re-cut from the originals and levelled by scripts/sound-nov-2026/process.py
 * (docs/sound-cues/levels-nov-2026.md has the before/after table).
 *
 *  1. Every mapped file is in public/sounds and its cue's manifest slot points at it; effects (and their loops) are mono
 *     96 kbps, beds stereo 128 kbps, voice lines stereo 192 kbps, all MPEG-1 Layer III at 44.1 kHz with a LAME tag (an
 *     exact length and a gapless loop); every effect is at least 120 ms long (the first wiring cut some to 42 ms) and the
 *     manifest's `ms` is the file's own length within a frame.
 *  2. Each cue fires at its moment in play: Iron Wall (bastionRev 3), Moon Climb (ricoRev 3), Blockzone (blockfallRev 2)
 *     and Ringer (alleyRollRev 2) are played by their skill-band bots (several levels and seeds) through the sim, with
 *     the game's real sound observer on every tick and a stubbed Web Audio context recording what starts. Every one of
 *     the game's new slots must play its own file, and the counted moments must match the sim's own counters (shots,
 *     reloads, leaps, pieces locked, balls rolled...).
 *  3. The beds: each game's round music is its own `music_<id>` (Gemstone's `music_matchup`) and starts looping.
 *  4. The voice lines: round8–round11 are the round title's lines for rounds 8–11, and each moment line plays its file
 *     through queueVoice.
 *
 *   bun scripts/sound-nov-2026-check.ts
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { existsSync, readFileSync } from "node:fs";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";
import { parseCsv } from "./sound-cue-sheet";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

type Entry = { channel: string; url: string | null; loop?: boolean; ms: number };
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
  // An ID3v2 tag, if any.
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
      // The LAME extension: 120 bytes after the tag (flags, frames, bytes, TOC, quality) a 9-byte encoder name
      // ("LAME3.100", or "Lavc60.31" from ffmpeg's libmp3lame), then delay and padding at +21 (12 bits each).
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

/* ------------------------------------------------------------- 1. files */

const VOICE_FILES: Record<string, string> = {
  "round_8.mp3": "round8",
  "round_9.mp3": "round9",
  "round_10.mp3": "round10",
  "round_11.mp3": "round11",
  "new_best.mp3": "voice.newBest",
  "photo_finish.mp3": "voice.photoFinish",
  "new_leader.mp3": "voice.newLeader",
  "clean_sweep.mp3": "voice.cleanSweep",
  "draw.mp3": "voice.draw",
};
const [head, ...body] = parseCsv(readFileSync("docs/sound-cues/mapping-nov-2026.csv", "utf8"));
const rows = body.filter((r) => r.length > 1).map((r) => ({ file: r[head!.indexOf("file")]!, cues: r[head!.indexOf("cues")]!.split(";").filter(Boolean) }));
const [vHead, ...vBody] = parseCsv(readFileSync("docs/sound-cues/voice-lines-nov-2026.csv", "utf8"));
for (const r of vBody.filter((r) => r.length > 1)) {
  const slot = VOICE_FILES[r[vHead!.indexOf("file")]!];
  check(!!slot, `voice-lines-nov-2026.csv: ${r[0]} has no slot here`);
  if (slot) rows.push({ file: `${slot}.mp3`, cues: [slot] });
}
check(rows.length === 51, `${rows.length} files mapped, the batch has 51 (42 effects, loops and beds, 9 voice lines)`);
const newCues = new Set<string>();
for (const { file, cues } of rows) {
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
  }
  const music = file.startsWith("music_");
  const voice = cues.some((c) => manifest[c]?.channel === "voice");
  const stereo = music || voice;
  const rate = music ? 128 : voice ? 192 : 96;
  check(mp3.version === 3 && mp3.layer === 1 && mp3.sampleRate === 44100, `${file}: must be MPEG-1 Layer III at 44.1 kHz`);
  check(mp3.stereo === stereo && mp3.bitrates.size === 1 && mp3.bitrates.has(rate), `${file}: must be ${stereo ? "stereo" : "mono"} ${rate} kbps throughout`);
  check(mp3.delay > 0, `${file}: no LAME delay/padding tag`);
  if (!music && !voice) check(ms >= 120, `${file}: ${Math.round(ms)} ms is too short (over-trimmed)`);
}

/* ------------------------------------------------------------- stubbed audio */

// A fake clock for sound.ts's idle timer (it calls the global setTimeout when it arms).
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
  rateTargets: number[];
}
const sources: FakeSource[] = [];
let suspends = 0;
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
    const record: FakeSource = { url: "", loop: false, started: false, stopped: false, rateTargets: [] };
    const source = {
      ...node(),
      buffer: null as { url: string } | null,
      loop: false,
      loopStart: 0,
      loopEnd: 0,
      playbackRate: { ...param(), setTargetAtTime: (v: number) => void record.rateTargets.push(v) },
      onended: null,
      addEventListener: (type: string, fn: () => void) => void (type === "ended" && ended.push(fn)),
      start() {
        record.url = source.buffer?.url ?? "";
        record.loop = source.loop;
        record.started = true;
        sources.push(record);
        // A one-shot ends at once here; a loop plays until stopped.
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
    suspends++;
    this.state = "suspended";
    return Promise.resolve();
  }
  resume() {
    this.state = "running";
    return Promise.resolve();
  }
  addEventListener() {}
}
const docListeners = new Map<string, (() => void)[]>();
const winListeners = new Map<string, (() => void)[]>();
const fakeDoc = {
  visibilityState: "visible",
  addEventListener: (type: string, fn: () => void) => docListeners.set(type, [...(docListeners.get(type) ?? []), fn]),
  removeEventListener() {},
};
const store = new Map<string, string>();
const fakeWin = Object.assign(new EventTarget(), {
  AudioContext: FakeAudioContext,
  location: { search: "" },
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => store.set(k, v), removeItem: (k: string) => store.delete(k) },
  setTimeout: (fn: () => void, ms?: number) => (globalThis.setTimeout as (f: () => void, m?: number) => number)(fn, ms),
  clearTimeout: (id: number) => globalThis.clearTimeout(id),
  devicePixelRatio: 2,
});
const winAdd = fakeWin.addEventListener.bind(fakeWin);
fakeWin.addEventListener = ((type: string, fn: () => void, opts?: unknown) => {
  winListeners.set(type, [...(winListeners.get(type) ?? []), fn]);
  winAdd(type, fn as EventListener, opts as AddEventListenerOptions);
}) as typeof fakeWin.addEventListener;
Object.assign(globalThis, {
  window: fakeWin,
  document: fakeDoc,
  fetch: async (url: string) => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(url).buffer }),
});
const setVisible = (visible: boolean) => {
  fakeDoc.visibilityState = visible ? "visible" : "hidden";
  for (const fn of docListeners.get("visibilitychange") ?? []) fn();
};

// queueVoice times voice lines on Date.now(): it follows the fake clock here.
const EPOCH = Date.now();
Date.now = () => EPOCH + now;
const sound = await import("../src/lib/sound");
sound.unlockAudio();
sound.installSoundCueBridge();
const want = [...newCues].filter((c) => manifest[c]?.channel === "effects");
for (let i = 0; i < 400 && !want.every((id) => sound.soundDiagnostics().loaded.includes(id)); i++) await flush();
check(want.every((id) => sound.soundDiagnostics().loaded.includes(id)), `every new effect decodes (${want.filter((id) => !sound.soundDiagnostics().loaded.includes(id)).join(", ")})`);
const plays = (file: string) => sources.filter((x) => x.url === `/sounds/${file}`).length;
const settle = async () => {
  for (let i = 0; i < 2; i++) await flush();
};

/* ------------------------------------------------------------- 2. cues in play */

const { GAME_BY_TYPE } = await import("./arcade-skill-bands/games");
const { Human } = await import("./arcade-skill-bands/human");
const gs = await import("../src/lib/fx/gameSounds");

interface GameRun {
  type: string;
  rev: number;
  observer: () => { frame: (s: any, running: boolean) => void; stop: () => void };
  /** Each new effect's file and, where the sim counts the moment itself, how many it counted this tick (from the state
   * before the tick and after). */
  counted: Record<string, ((p: any, s: any) => number) | null>;
}
const GAME_RUNS: GameRun[] = [
  {
    type: "bastion",
    rev: 3,
    observer: gs.bastionTankSounds,
    counted: {
      "bastion.cannon.mp3": (p, s) => s.shots - p.shots,
      "bastion.reload.mp3": (p, s) => s.reloads - p.reloads,
      "bastion.fastReload.mp3": (p, s) => s.fast - p.fast,
      "bastion.jam.mp3": (p, s) => s.jams - p.jams,
      "bastion.loaded.mp3": null,
      "bastion.hit.mp3": null,
      "bastion.weak.mp3": null,
      "bastion.kill.mp3": null,
      "bastion.miss.mp3": null,
      "bastion.baseHit.mp3": null,
      "bastion.wave.mp3": null,
      "bastion.drone.mp3": null,
      "bastion.droneDown.mp3": null,
    },
  },
  {
    type: "ricochet",
    rev: 3,
    observer: gs.ninjaSounds,
    counted: {
      "ricochet.leap.mp3": null,
      "ricochet.doubleJump.mp3": null,
      "ricochet.land.mp3": null,
      "ricochet.hit.mp3": (p, s) => s.hits - p.hits,
      "ricochet.slip.mp3": null,
      "ricochet.scroll.mp3": (p, s) => s.scrolls - p.scrolls,
      // A grab on the tick of a hit sounds only the hit (the knock takes the ninja off the lantern).
      "ricochet.lanternGrab.mp3": (p, s) => (s.hits > p.hits ? 0 : s.rides - p.rides),
      "ricochet.lanternRide.mp3": null,
      "ricochet.ledge.mp3": null,
      "ricochet.flow.mp3": null,
    },
  },
  {
    type: "blockfall",
    rev: 2,
    observer: gs.blockfallSounds,
    counted: {
      "blockfall.move.mp3": null,
      "blockfall.turn.mp3": null,
      "blockfall.lock.mp3": null,
      "blockfall.clear.mp3": null,
      "blockfall.bigClear.mp3": null,
      "blockfall.topOut.mp3": null,
    },
  },
  {
    type: "alleyroll",
    rev: 2,
    observer: gs.alleyRollSounds,
    counted: {
      "alleyroll.roll.mp3": null,
      "alleyroll.rolling.mp3": null,
      "alleyroll.ramp.mp3": null,
      "alleyroll.ring.mp3": null,
      "alleyroll.pocket.mp3": null,
      "alleyroll.goldCup.mp3": null,
      "alleyroll.gutter.mp3": null,
      "alleyroll.streak.mp3": null,
    },
  },
];
const LEVELS = ["weak", "average", "good", "great", "elite", "perfect"] as const;
const RUNS = 3; // seeds per level
const report: string[] = [];
for (const run of GAME_RUNS) {
  const spec = GAME_BY_TYPE.get(run.type as never)!;
  const { bot } = (await import(`./arcade-skill-bands/bots/${run.type}.ts`)) as { bot: (ctx: any) => { events?: any[] } };
  const files = Object.keys(run.counted);
  const before = Object.fromEntries(files.map((f) => [f, plays(f)]));
  const sums: Record<string, number> = {};
  for (let n = 0; n < RUNS; n++) {
    for (const level of LEVELS) {
      const seed = spec.seedFor(n);
      const game = spec.gameFor(run.rev, seed);
      const t0 = Date.now();
      const events = bot({ game, seed, rev: run.rev, human: new Human(run.type as never, seed, level) }).events ?? [];
      const t1 = Date.now();
      const obs = run.observer();
      // The log played back as the server does: each event on its own tick.
      const byTick = new Map(events.map((e: any) => [e.t, e]));
      let s = game.init(seed);
      obs.frame(s, true);
      const counts = Object.fromEntries(files.map((f) => [f, plays(f)]));
      const moments: Record<string, number> = {};
      while (!game.isOver(s) && s.tick < game.runTicks) {
        const p = s;
        s = game.step(s, byTick.get(s.tick + 1) ?? null);
        for (const [f, count] of Object.entries(run.counted)) if (count) moments[f] = (moments[f] ?? 0) + count(p, s);
        obs.frame(s, true);
        if (s.tick % 60 === 0) await settle();
      }
      obs.frame(s, false);
      obs.stop();
      await settle();
      if (process.env.SOUND_NOV_TIMES) console.log(`  ${run.type} ${level} seed ${seed}: bot ${t1 - t0} ms, play ${Date.now() - t1} ms`);
      for (const [f, n] of Object.entries(moments)) {
        sums[f] = (sums[f] ?? 0) + n;
        // Per run: the observer sounds each counted moment once.
        const got = plays(f) - counts[f]!;
        check(got === n, `${run.type} seed ${seed} ${level}: ${f} played ${got} times for ${n} moments`);
      }
    }
  }
  for (const f of files) {
    const n = plays(f) - before[f]!;
    check(n > 0, `${run.type}: ${f} never played in ${RUNS * LEVELS.length} bot runs`);
    report.push(`${f.padEnd(26)} ${String(n).padStart(5)} plays${sums[f] !== undefined ? ` (sim count ${sums[f]})` : ""}`);
  }
}

/* ------------------------------------------------------------- 3. beds */

const { roundMusicFor } = await import("../src/lib/fx/theme");
for (const [type, bed] of [["ricochet", "music_ricochet"], ["bastion", "music_bastion"], ["blockfall", "music_blockfall"], ["alleyroll", "music_alleyroll"], ["matchup", "music_matchup"]] as const) {
  check(roundMusicFor(type as never, "arcade") === bed, `${type}: round music is ${roundMusicFor(type as never, "arcade")}, not ${bed}`);
  const n = plays(`${bed}.mp3`);
  sound.startMusic(bed as never);
  for (let i = 0; i < 100 && plays(`${bed}.mp3`) === n; i++) await flush();
  const started = sources.filter((x) => x.url === `/sounds/${bed}.mp3`).at(-1);
  check(plays(`${bed}.mp3`) > n && !!started?.loop, `${bed}: starts and loops`);
  report.push(`${(bed + ".mp3").padEnd(26)} starts, looping`);
  sound.stopMusic(0);
  await advance(1000);
}

/* ------------------------------------------------------------- 4. voices */

const title = readFileSync("src/components/duel/RoundTitle.tsx", "utf8");
check(/round >= 1 && round <= 11\s*\?\s*\(`round\$\{round\}`/.test(title), "RoundTitle: rounds 1–11 announce round1–round11");
for (const id of ["round8", "round9", "round10", "round11", "voice.newBest", "voice.photoFinish", "voice.newLeader", "voice.cleanSweep", "voice.draw"]) {
  const file = manifest[id]!.url!.replace("/sounds/", "");
  const n = plays(file);
  sound.queueVoice(id as never);
  for (let i = 0; i < 100 && plays(file) === n; i++) await advance(50);
  check(plays(file) === n + 1, `${id}: queueVoice plays ${file}`);
  report.push(`${file.padEnd(26)} plays through queueVoice`);
  await advance(6000);
}

for (const line of report) console.log(`  ${line}`);
if (failures.length) {
  for (const f of failures.slice(0, 40)) console.log(`FAIL ${f}`);
  console.log(`\nFAIL sound-nov-2026-check: ${failures.length} failures, ${passes} passes`);
  process.exit(1);
}
console.log(`\nPASS sound-nov-2026-check: ${passes} checks`);
