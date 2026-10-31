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

console.log(
  `sound-batch6-check: ${rows.length} files, ${listed.size} slots, ${(totalBytes / 1e6).toFixed(2)} MB; ${passes} assertions.`,
);
if (failures.length) {
  for (const f of failures) console.log(`FAIL ${f}`);
  console.log(`FAIL sound-batch6-check: ${failures.length} failure(s)`);
  process.exit(1);
}
console.log("PASS sound-batch6-check");
