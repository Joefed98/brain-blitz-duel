/**
 * sound-batch6-check (31 Oct 2026): sound batch 6, the Sports and Cards & Board games' recordings
 * (docs/sound-cues/batch6-mapping.csv, docs/sound-cues/batch6-sports-cards.md).
 *
 *  1. Every mapping row's file is in public/sounds and every cue it names is a manifest slot pointing at it;
 *     every manifest slot on a batch-6 file is listed against that file.
 *  2. Every file is within its length budget (length_s) plus 150 ms (the batch's rule for an effect whose
 *     body runs past its budget) and one MP3 frame. The length is read from the file itself: the Xing/Info
 *     frame count less the LAME tag's encoder delay and padding.
 *  3. Loops: every loop = yes row's effect slots are `loop: true` (ensureLoop trims their edges) and its music
 *     slots are on the music channel (round beds always loop); no one-shot's slot is a loop.
 *  4. Format: MPEG-1 Layer III at 44.1 kHz, one bitrate throughout; music and the stereo loops (crowd, engines)
 *     stereo at 128 kbps, every other file mono at 96 kbps.
 *  5. The upload folder is gone (originals stay out of the shipped app).
 *  6. With the battery update's audio power (src/lib/sound.ts, src/lib/battery.ts; a stubbed Web Audio context and a
 *     fake clock): a batch-6 loop (the crowd) and a batch-6 bed (Home Run's) keep the context running through a 20 s
 *     run (no idle suspend mid-run); hiding the app suspends it and returning resumes it with the same loop and bed
 *     sources (paused, never stopped or restarted); once they stop, the context is suspended after the idle delay, and
 *     the next loop wakes it; Racing's engine pitch reaches the playing loop.
 *
 *   bun scripts/sound-batch6-check.ts
 */
import { existsSync, readFileSync, statSync } from "node:fs";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";
import { parseCsv } from "./sound-cue-sheet";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

const OVER_S = 0.15;
const FRAME_S = 1152 / 44100;
const STEREO = new Set(["sports_crowd_loop", "racing_idle_loop", "racing_drive_loop"]);

type Entry = { channel: string; url: string | null; loop?: boolean };
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

const [head, ...body] = parseCsv(readFileSync("docs/sound-cues/batch6-mapping.csv", "utf8"));
const col = (name: string) => head!.indexOf(name);
for (const name of ["slot", "file", "game", "event", "length_s", "loop", "cues"]) check(col(name) >= 0, `batch6-mapping.csv: no ${name} column`);
const rows = body.filter((r) => r.length > 1);
check(rows.length === 86, `batch6-mapping.csv: ${rows.length} rows, the batch has 86 files`);

let totalBytes = 0;
const listed = new Set<string>();
for (const r of rows) {
  const slot = r[col("slot")]!;
  const file = r[col("file")]!;
  const budget = Number(r[col("length_s")]);
  const loop = r[col("loop")] === "yes";
  const cues = r[col("cues")]!.split(";").filter(Boolean);
  const path = `public/sounds/${file}`;
  check(file === `${slot}.mp3`, `${slot}: its file must be public/sounds/${slot}.mp3`);
  if (!existsSync(path)) {
    failures.push(`${slot}: no file ${path}`);
    continue;
  }
  totalBytes += statSync(path).size;
  check(cues.length > 0, `${slot}: no cue plays it`);
  for (const cue of cues) {
    listed.add(cue);
    const e = manifest[cue];
    if (!e) {
      failures.push(`${slot}: cue ${cue} is not a manifest slot`);
      continue;
    }
    check(e.url === `/sounds/${file}`, `${cue}: must play /sounds/${file} (has ${e.url})`);
    if (e.channel === "music") check(loop, `${cue}: a music bed's file must be a loop row`);
    else check(!!e.loop === loop, `${cue}: ${loop ? "a loop file's slot must be loop: true" : "a one-shot's slot must not be a loop"}`);
  }
  const mp3 = readMp3(new Uint8Array(readFileSync(path)));
  if (!mp3) {
    failures.push(`${slot}: not a readable MP3`);
    continue;
  }
  const seconds = (mp3.frames * 1152 - mp3.delay - mp3.padding) / mp3.sampleRate;
  check(mp3.version === 3 && mp3.layer === 1, `${slot}: must be MPEG-1 Layer III`);
  check(mp3.sampleRate === 44100, `${slot}: ${mp3.sampleRate} Hz, must be 44.1 kHz`);
  check(mp3.bitrates.size === 1, `${slot}: must be one bitrate throughout`);
  const stereo = slot.startsWith("music_") || STEREO.has(slot);
  check(mp3.stereo === stereo, `${slot}: must be ${stereo ? "stereo" : "mono"}`);
  check(mp3.bitrates.has(stereo ? 128 : 96), `${slot}: must be ${stereo ? 128 : 96} kbps`);
  check(mp3.delay > 0, `${slot}: no LAME delay/padding tag (needed for an exact length and a gapless loop)`);
  check(
    seconds <= budget + OVER_S + FRAME_S,
    `${slot}: ${seconds.toFixed(3)} s is over its ${budget} s budget plus ${OVER_S * 1000} ms`,
  );
  check(seconds > 0.05, `${slot}: ${seconds.toFixed(3)} s is too short to be a sound`);
}
for (const [id, e] of Object.entries(manifest)) {
  const file = e.url?.match(/^\/sounds\/(.+)$/)?.[1];
  if (file && rows.some((r) => r[col("file")] === file)) check(listed.has(id), `manifest ${id} plays ${file} but batch6-mapping.csv doesn't list it`);
}
check(!existsSync("sound-uploads"), "sound-uploads/ must not be committed (the originals stay out of the app)");

/* ------------------------------------------------------------- 6. audio power */

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

const sound = await import("../src/lib/sound");
sound.unlockAudio();
for (let i = 0; i < 200 && !sound.soundDiagnostics().loaded.includes("homerun.crowd"); i++) await flush();
check(sound.soundDiagnostics().loaded.includes("homerun.crowd"), "power: the crowd loop's file decodes");
const live = (url: string) => sources.filter((x) => x.url === url && x.started && !x.stopped);
// A run: the crowd loop and Home Run's bed.
sound.ensureCueLoop("homerun.crowd", 0.26);
sound.startMusic("music_homerun" as never);
for (let i = 0; i < 50 && live("/sounds/music_homerun.mp3").length === 0; i++) await flush();
const crowd = live("/sounds/sports_crowd_loop.mp3");
const bed = live("/sounds/music_homerun.mp3");
check(crowd.length === 1 && crowd[0]!.loop, "power: the crowd loop plays, looping");
check(bed.length === 1 && bed[0]!.loop, "power: Home Run's bed plays, looping");
await advance(20_000);
const midRun = sound.audioPowerState();
check(midRun.state === "running" && suspends === 0, `power: 20 s into a run with a loop and a bed the context is still running (${midRun.state}, ${suspends} suspends)`);
// Hidden: everything pauses with the context; back: it carries on with the same sources.
setVisible(false);
await advance(100);
check(sound.audioPowerState().state === "suspended", "power: hidden suspends the context");
setVisible(true);
await advance(100);
check(sound.audioPowerState().state === "running", "power: returning resumes the context");
check(!crowd[0]!.stopped && !bed[0]!.stopped && live("/sounds/sports_crowd_loop.mp3").length === 1 && live("/sounds/music_homerun.mp3").length === 1, "power: the same loop and bed carry on after hide and return (never stopped or restarted)");
await advance(20_000);
check(sound.audioPowerState().state === "running", "power: still running 20 s after returning while they play");
// Racing's engine pitch reaches its playing loop.
sound.ensureCueLoop("racing.drive", 0.3);
const drive = live("/sounds/racing_drive_loop.mp3")[0];
sound.setCueLoopRate("racing.drive", 1.2);
check(!!drive && drive.rateTargets.includes(1.2), "power: setCueLoopRate glides the playing engine loop");
// The run ends: everything stops, the context sleeps after the idle delay, and the next loop wakes it.
sound.stopCueLoop("homerun.crowd", 0);
sound.stopCueLoop("racing.drive", 0);
sound.stopMusic(0);
await advance(sound.IDLE_SUSPEND_MS + 1000);
const idle = sound.audioPowerState();
check(idle.state === "suspended" && idle.idle && idle.live === 0, `power: silent after the run, suspended after the idle delay (${idle.state}, ${idle.live} live)`);
sound.ensureCueLoop("curling.slide", 0.32);
await advance(10);
check(sound.audioPowerState().state === "running" && live("/sounds/curling_slide_loop.mp3").length === 1, "power: the next loop wakes the context and plays");
sound.stopCueLoop("curling.slide", 0);

console.log(
  `sound-batch6-check: ${rows.length} files, ${listed.size} slots, ${(totalBytes / 1e6).toFixed(2)} MB; ${passes} assertions.`,
);
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL sound-batch6-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log("PASS sound-batch6-check");
