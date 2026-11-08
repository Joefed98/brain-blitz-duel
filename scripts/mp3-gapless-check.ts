/**
 * mp3-gapless-check (7 Nov 2026, audio audit fix 1; docs/audit-nov-2026/audio.md, src/lib/mp3Gapless.ts,
 * docs/audit-nov-2026/audio-fixes.md).
 *
 *  1. Every MP3 in public/sounds has a gapless tag the app can read (readMp3Gapless): MPEG Layer III, an Info/Xing
 *     frame count, a LAME/Lavc tag with an encoder delay, a positive exact length; and the tag's CRC-16 holds (an
 *     edited tag that broke it could be ignored by a strict decoder).
 *  2. The app's reading matches an independent reading of the same bytes (the frame walk the batch checks use: the
 *     frames counted one by one, the rate from the first audio frame).
 *  3. Effect loops (manifest `loop`): the manifest's `ms` is the file's exact length (within one frame).
 *  4. gaplessWindow / gaplessBuffer: a decode of the exact length is left alone ("honoured"); a decode that kept the
 *     priming and padding (the whole decode, with or without the decoder's own 529 samples, with or without the Info
 *     frame decoded as silence), at the file's rate and resampled to 48 kHz, is cut to exactly the sound, sample for
 *     sample; any other length is left alone ("unknown"); a file with no tag is left alone.
 *  5. src/lib/sound.ts decodes in one place, decodeExact (both the first-tap preload and the music loads go through
 *     it), and one of our own files decoded exactly loops whole (no -60 dB edge trim).
 *
 *   bun scripts/mp3-gapless-check.ts
 */
import { readdirSync, readFileSync } from "node:fs";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";
import { gaplessBuffer, gaplessWindow, MP3_DECODER_DELAY, readMp3Gapless, type Mp3Gapless } from "../src/lib/mp3Gapless";

const failures: string[] = [];
let passes = 0;
function check(ok: boolean, message: string): void {
  if (ok) passes++;
  else failures.push(message);
}

/* ------------------------------------------------------------ 1–3. the files */

function crc16Arc(bytes: Uint8Array): number {
  let crc = 0;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xa001 : crc >>> 1;
  }
  return crc;
}

/** Where the first MPEG frame starts: after an ID3v2 tag, if there is one. */
function frameStart(bytes: Uint8Array): number {
  if (bytes[0] !== 0x49 || bytes[1] !== 0x44 || bytes[2] !== 0x33) return 0;
  return 10 + (((bytes[6]! & 0x7f) << 21) | ((bytes[7]! & 0x7f) << 14) | ((bytes[8]! & 0x7f) << 7) | (bytes[9]! & 0x7f));
}

const BITRATES = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
const RATES = [44100, 48000, 32000];
/** MPEG-1 Layer III frames walked one by one: the audio frames after the tag frame, and the first frame's rate. */
function walk(bytes: Uint8Array): { frames: number; rate: number } | null {
  let at = frameStart(bytes);
  let frames = 0;
  let rate = 0;
  while (at + 4 <= bytes.length) {
    if (bytes[at] !== 0xff || (bytes[at + 1]! & 0xe0) !== 0xe0) return null;
    const bitrate = BITRATES[bytes[at + 2]! >> 4] ?? 0;
    const r = RATES[(bytes[at + 2]! >> 2) & 3] ?? 0;
    if (!bitrate || !r) return null;
    rate ||= r;
    frames++;
    at += Math.floor((144000 * bitrate) / r) + ((bytes[at + 2]! >> 1) & 1);
  }
  return { frames: frames - 1, rate };
}

const manifest = SOUND_MANIFEST as Record<string, { url: string | null; ms: number; loop?: boolean; channel: string }>;
const files = readdirSync("public/sounds").filter((f) => f.endsWith(".mp3"));
check(files.length > 300, `public/sounds: ${files.length} MP3s, expected the library's 355`);
const infos = new Map<string, Mp3Gapless>();
for (const file of files) {
  const bytes = new Uint8Array(readFileSync(`public/sounds/${file}`));
  const info = readMp3Gapless(bytes);
  if (!info) {
    failures.push(`${file}: no gapless tag the app can read`);
    continue;
  }
  infos.set(file, info);
  const exact = info.frames * info.frameSamples - info.delay - info.padding;
  check(info.delay >= 576 && exact > 0, `${file}: delay ${info.delay}, exact length ${exact}`);
  // The tag CRC: CRC-16/ARC over the frame's first 190 bytes with the CRC field zeroed (ffmpeg's mp3enc).
  const f0 = frameStart(bytes);
  const side = (bytes[f0 + 3]! >> 6) === 3 ? 17 : 32;
  const flagsAt = f0 + 4 + side + 4;
  const flags = (bytes[flagsAt]! << 24) | (bytes[flagsAt + 1]! << 16) | (bytes[flagsAt + 2]! << 8) | bytes[flagsAt + 3]!;
  const ext = flagsAt + 4 + (flags & 1 ? 4 : 0) + (flags & 2 ? 4 : 0) + (flags & 4 ? 100 : 0) + (flags & 8 ? 4 : 0);
  const head = bytes.slice(f0, f0 + 190);
  if (ext + 34 - f0 < 190) head.set([0, 0], ext + 34 - f0);
  check(crc16Arc(head) === ((bytes[ext + 34]! << 8) | bytes[ext + 35]!), `${file}: the LAME tag's CRC doesn't hold`);
  const walked = walk(bytes);
  check(!!walked && walked.frames === info.frames && walked.rate === info.sampleRate,
    `${file}: tag says ${info.frames} frames at ${info.sampleRate} Hz, the frames say ${walked?.frames} at ${walked?.rate}`);
}
for (const [id, e] of Object.entries(manifest)) {
  const file = e.url?.match(/^\/sounds\/(.+)$/)?.[1];
  const info = file && infos.get(file);
  if (!info || !e.loop || e.channel === "music") continue;
  const ms = ((info.frames * info.frameSamples - info.delay - info.padding) / info.sampleRate) * 1000;
  check(Math.abs(ms - e.ms) <= (1152 / info.sampleRate) * 1000, `${id}: manifest ms ${e.ms}, the loop is ${ms.toFixed(0)} ms`);
}

/* --------------------------------------------------- 4. window and buffer */

type FakeBuffer = { length: number; sampleRate: number; numberOfChannels: number; data: Float32Array[]; getChannelData(c: number): Float32Array };
function fakeBuffer(channels: number, length: number, sampleRate: number, fill: (c: number, i: number) => number): FakeBuffer {
  const data = Array.from({ length: channels }, (_, c) => Float32Array.from({ length }, (_, i) => fill(c, i)));
  return { length, sampleRate, numberOfChannels: channels, data, getChannelData: (c) => data[c]! };
}
const fakeContext = {
  createBuffer: (channels: number, length: number, sampleRate: number) => fakeBuffer(channels, length, sampleRate, () => 0),
} as unknown as BaseAudioContext;

// blockfall.lock.mp3 per the audit: 20 frames, delay 576, its raw decode 23,040 samples, gapless 21,018.
const lock = infos.get("blockfall.lock.mp3");
check(!!lock && lock.frames === 20 && lock.delay === 576 && lock.frames * 1152 - lock.delay - lock.padding === 21018,
  `blockfall.lock.mp3: ${JSON.stringify(lock)} (the audit's phone test reads 21,018 samples, 0.4766 s)`);

const info: Mp3Gapless = { sampleRate: 44100, frames: 20, frameSamples: 1152, delay: 576, padding: 917 };
const total = 23040;
const exact = total - 576 - 917;
for (const rate of [44100, 48000]) {
  const ratio = rate / 44100;
  const r = (n: number) => Math.round(n * ratio);
  const honoured = gaplessWindow(info, r(exact), rate);
  check(honoured?.outcome === "honoured" && honoured.offset === 0, `${rate} Hz: an exact decode must be left alone`);
  const cases: Array<[string, number, number]> = [
    ["whole decode", total, 576 + MP3_DECODER_DELAY],
    ["whole decode less the decoder delay", total - MP3_DECODER_DELAY, 576],
    ["whole decode with the tag frame as silence", total + 1152, 1152 + 576 + MP3_DECODER_DELAY],
    ["the same less the decoder delay", total + 1152 - MP3_DECODER_DELAY, 1152 + 576],
  ];
  for (const [what, length, offset] of cases) {
    const w = gaplessWindow(info, r(length), rate);
    check(w?.outcome === "trimmed" && w.offset === r(offset) && w.length === r(exact),
      `${rate} Hz, ${what}: window ${JSON.stringify(w)}, expected offset ${r(offset)} length ${r(exact)}`);
    // The buffer: a ramp, so the copy can be checked sample for sample.
    const decoded = fakeBuffer(2, r(length), rate, (c, i) => i + c * 0.5);
    const { buffer, outcome } = gaplessBuffer(fakeContext, decoded as unknown as AudioBuffer, info);
    const out = buffer as unknown as FakeBuffer;
    check(outcome === "trimmed" && out.length === r(exact) && out.numberOfChannels === 2,
      `${rate} Hz, ${what}: buffer ${outcome} ${out.length}`);
    check(out.data[0]![0] === r(offset) && out.data[1]![out.length - 1] === r(offset) + r(exact) - 1 + 0.5,
      `${rate} Hz, ${what}: the trimmed buffer isn't the decode's samples from the offset`);
  }
  for (const odd of [r(exact) + 300, r(total) + 700, 10]) {
    check(gaplessWindow(info, odd, rate) === null, `${rate} Hz: a ${odd}-sample decode must be left alone`);
    const decoded = fakeBuffer(1, odd, rate, () => 0);
    const { buffer, outcome } = gaplessBuffer(fakeContext, decoded as unknown as AudioBuffer, info);
    check(outcome === "unknown" && buffer === (decoded as unknown as AudioBuffer), `${rate} Hz: ${odd} samples must come back as decoded`);
  }
}
const plain = fakeBuffer(1, 1000, 48000, () => 0) as unknown as AudioBuffer;
check(gaplessBuffer(fakeContext, plain, null).buffer === plain, "no tag: the decode must come back as it is");
check(readMp3Gapless(new Uint8Array(64)) === null && readMp3Gapless(new ArrayBuffer(0)) === null, "non-MP3 bytes must read as no tag");

/* ------------------------------------------------------------ 5. wiring */

const sound = readFileSync("src/lib/sound.ts", "utf8");
check((sound.match(/decodeAudioData\(/g) ?? []).length === 1, "sound.ts must decode in one place (decodeExact)");
check(/async function decodeExact[\s\S]{0,400}readMp3Gapless\(bytes\)[\s\S]{0,200}decodeAudioData\(bytes\)/.test(sound),
  "decodeExact must read the tag before decodeAudioData (which detaches the bytes)");
check((sound.match(/await decodeExact\(/g) ?? []).length === 2, "both the preload and the music loads must decode through decodeExact");
check(/if \(exact && url\.startsWith\("\/sounds\/"\)\) loopPoints\.delete\(id\);\s*else loopPoints\.set\(id, detectLoopPoints\(buffer\)\);/.test(sound),
  "an exact decode of one of our files must loop whole; anything else keeps the edge trim");

if (failures.length) {
  console.error(`mp3-gapless-check: FAIL (${failures.length} failures, ${passes} passed)`);
  for (const f of failures.slice(0, 60)) console.error(`  - ${f}`);
  process.exit(1);
}
console.log(`mp3-gapless-check: PASS (${passes} checks, ${files.length} files)`);
