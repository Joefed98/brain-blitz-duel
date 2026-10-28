/**
 * Synthesised 8-bit sounds (Joe's phone notes, 28 Oct 2026; `docs/sound-cues/batch5-chiptune.md`):
 *
 *   public/sounds/beat.note8bit.mp3   Tempo's note hit: one NES-style 25 % pulse note on C5 with a stepped
 *                                     volume envelope; the observer pitches it per lane up a major pentatonic
 *                                     scale (BEAT_LANE_RATES in src/lib/fx/gameSounds.ts).
 *   public/sounds/music_matchup2.mp3  Gemstone's round bed: an energetic 150 BPM chiptune loop in A minor
 *                                     (Am F C G), triangle bass, pulse arpeggio and lead, noise drums; 32 bars,
 *                                     51.2 s, the last bar's tails folded onto the start so it loops cleanly.
 *
 * Deterministic (seeded noise), rendered to 48 kHz WAV and encoded by ffmpeg (libmp3lame, 192 kb/s stereo, the
 * library's format), then levelled: the note to beat.noteHit.mp3's peak, the bed to the music library's
 * -20 LUFS. Run: `bun scripts/chiptune-sounds.ts` (needs ffmpeg). Presentation only.
 */
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const RATE = 48_000;
const tmp = mkdtempSync(join(tmpdir(), "chiptune-"));

function wav(samples: Float32Array): Buffer {
  const data = Buffer.alloc(samples.length * 2);
  for (let i = 0; i < samples.length; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, samples[i]!)) * 32767), i * 2);
  const head = Buffer.alloc(44);
  head.write("RIFF", 0);
  head.writeUInt32LE(36 + data.length, 4);
  head.write("WAVEfmt ", 8);
  head.writeUInt32LE(16, 16);
  head.writeUInt16LE(1, 20);
  head.writeUInt16LE(1, 22);
  head.writeUInt32LE(RATE, 24);
  head.writeUInt32LE(RATE * 2, 28);
  head.writeUInt16LE(2, 32);
  head.writeUInt16LE(16, 34);
  head.write("data", 36);
  head.writeUInt32LE(data.length, 40);
  return Buffer.concat([head, data]);
}

function ffmpeg(args: string[]): string {
  return execFileSync("ffmpeg", ["-hide_banner", "-nostdin", ...args], { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
}

/** ffmpeg's analysis log (it writes to stderr) for one filter over a file. */
function measure(file: string, filter: string): string {
  return execFileSync("sh", ["-c", `ffmpeg -hide_banner -nostdin -i '${file}' -af ${filter} -f null - 2>&1`], { encoding: "utf8" });
}

function encode(samples: Float32Array, out: string, gainDb: number): void {
  const src = join(tmp, "src.wav");
  writeFileSync(src, wav(samples));
  ffmpeg(["-y", "-i", src, "-af", `volume=${gainDb.toFixed(2)}dB`, "-ac", "2", "-ar", String(RATE), "-c:a", "libmp3lame", "-b:a", "192k", "-map_metadata", "-1", "-fflags", "+bitexact", "-flags:a", "+bitexact", out]);
}

let seed = 0x5eed;
function noise(): number {
  seed = (seed + 0x6d2b79f5) | 0;
  let t = Math.imul(seed ^ (seed >>> 15), seed | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return (((t ^ (t >>> 14)) >>> 0) / 4294967296) * 2 - 1;
}

const midiHz = (m: number) => 440 * 2 ** ((m - 69) / 12);
const pulse = (phase: number, duty: number) => (phase % 1 < duty ? 1 : -1);
const triangle = (phase: number) => 1 - 4 * Math.abs((phase % 1) - 0.5);
/** NES-style volume: 16 steps. */
const stepped = (v: number) => Math.round(Math.max(0, Math.min(1, v)) * 15) / 15;

/* ---------------------------------------------------------------- the note */
{
  const len = Math.round(RATE * 0.14);
  const out = new Float32Array(len);
  const hz = midiHz(72);
  for (let i = 0; i < len; i++) {
    const t = i / RATE;
    // A 2 ms attack, then a stepped decay; the first 15 ms an octave up, the 8-bit "ping".
    const env = stepped(Math.min(1, t / 0.002) * Math.exp(-t / 0.045));
    const f = t < 0.015 ? hz * 2 : hz;
    out[i] = 0.6 * env * pulse(f * t, 0.25);
  }
  const file = "public/sounds/beat.note8bit.mp3";
  encode(out, file, 0);
  const peak = (f: string) => Number(/max_volume: (-?[\d.]+) dB/.exec(measure(f, "volumedetect"))?.[1]);
  encode(out, file, peak("public/sounds/beat.noteHit.mp3") - peak(file));
  console.log(`${file}: peak ${peak(file)} dB`);
}

/* ------------------------------------------------------------- the round bed */
{
  const BPM = 150;
  const beat = 60 / BPM;
  const step = beat / 4; // a sixteenth
  const BARS = 32;
  const total = BARS * 4 * beat;
  const len = Math.round(total * RATE);
  const mix = new Float32Array(len + RATE); // a second of tail, folded back onto the start
  const add = (at: number, dur: number, voice: (t: number) => number, gain: number) => {
    const s0 = Math.round(at * RATE);
    const n = Math.round(dur * RATE);
    for (let i = 0; i < n && s0 + i < mix.length; i++) mix[s0 + i]! += gain * voice(i / RATE);
  };

  // Am F C G, roots in MIDI (A2, F2, C3, G2).
  const CHORDS = [
    { root: 45, tones: [57, 60, 64] },
    { root: 41, tones: [53, 57, 60] },
    { root: 48, tones: [60, 64, 67] },
    { root: 43, tones: [55, 59, 62] },
  ];
  // The lead: two four-bar phrases on an eighth-note grid (0 = rest, -1 = hold).
  const PHRASE_A = [
    76, 0, 81, 0, 84, 83, 81, 0,
    77, 0, 81, 0, 84, 0, 81, 79,
    76, 0, 79, 0, 84, 0, 86, 88,
    86, 0, 83, 0, 79, 0, 83, 86,
  ];
  const PHRASE_B = [
    88, 0, 86, 84, 83, 0, 81, 0,
    84, 0, 81, 0, 77, 0, 81, 84,
    88, 0, 91, 0, 88, 86, 84, 0,
    83, 0, 86, 0, 81, -1, -1, 0,
  ];

  for (let bar = 0; bar < BARS; bar++) {
    const chord = CHORDS[bar % 4]!;
    const barAt = bar * 4 * beat;
    const section = Math.floor(bar / 8); // 0 groove, 1 lead, 2 busy arp, 3 lead up an octave
    // Drums: kick on every beat (four on the floor), snare on 2 and 4, closed hats on the eighths, an open hat on the off-beats.
    for (let b = 0; b < 4; b++) {
      const at = barAt + b * beat;
      add(at, 0.16, (t) => Math.sin(2 * Math.PI * (55 * t + 90 * 0.03 * (1 - Math.exp(-t / 0.03)))) * Math.exp(-t / 0.07), 0.55);
      if (b % 2 === 1)
        add(at, 0.14, (t) => (0.7 * noise() + 0.3 * triangle(190 * t)) * stepped(Math.exp(-t / 0.05)), 0.32);
      for (let h = 0; h < 2; h++) {
        const open = h === 1 && section >= 1;
        let last = 0;
        add(at + h * beat / 2, open ? 0.09 : 0.03, (t) => {
          const n = noise();
          const hp = n - last; // a crude high-pass: hats sit above the snare
          last = n;
          return hp * Math.exp(-t / (open ? 0.03 : 0.008));
        }, 0.12);
      }
    }
    // A snare fill into each eight-bar section.
    if (bar % 8 === 7)
      for (let s = 12; s < 16; s++) add(barAt + s * step, 0.08, (t) => noise() * Math.exp(-t / 0.03), 0.2);
    // Bass: triangle eighths pumping root and octave.
    for (let e = 0; e < 8; e++) {
      const m = chord.root + (e % 2 ? 12 : 0);
      const hz = midiHz(m);
      add(barAt + e * beat / 2, beat / 2 * 0.9, (t) => triangle(hz * t) * Math.min(1, (beat / 2 * 0.9 - t) / 0.01), 0.42);
    }
    // Arpeggio: 12.5 % pulse sixteenths up and down the chord, an octave higher in the busy section.
    const arp = [0, 1, 2, 3, 2, 1];
    const lift = section === 2 ? 24 : 12;
    for (let s = 0; s < 16; s++) {
      const k = arp[s % arp.length]!;
      const m = (k === 3 ? chord.tones[0]! + 12 : chord.tones[k]!) + lift;
      const hz = midiHz(m);
      add(barAt + s * step, step * 0.85, (t) => pulse(hz * t, 0.125) * stepped(Math.exp(-t / 0.06)), section === 0 ? 0.07 : 0.055);
    }
    // Lead: 25 % pulse with a little vibrato in sections 1 and 3 (an octave up in 3).
    if (section === 1 || section === 3) {
      const phrase = (bar % 8) < 4 ? PHRASE_A : PHRASE_B;
      const up = section === 3 ? 12 : 0;
      for (let e = 0; e < 8; e++) {
        const idx = (bar % 4) * 8 + e;
        const m = phrase[idx]!;
        if (m <= 0) continue;
        let hold = 1;
        while (phrase[idx + hold] === -1) hold++;
        const dur = hold * beat / 2 * 0.92;
        const hz = midiHz(m + up);
        let ph = 0;
        add(barAt + e * beat / 2, dur, (t) => {
          ph += (hz * (1 + 0.006 * Math.sin(2 * Math.PI * 6 * Math.max(0, t - 0.08)))) / RATE;
          return pulse(ph, 0.25) * stepped(Math.min(1, t / 0.004) * (0.75 + 0.25 * Math.exp(-t / 0.1)) * Math.min(1, (dur - t) / 0.015));
        }, section === 3 ? 0.13 : 0.15);
      }
    }
  }
  // Fold the tail onto the start so the loop has no seam.
  for (let i = len; i < mix.length; i++) mix[i - len]! += mix[i]!;
  const bed = mix.subarray(0, len);
  let peak = 0;
  for (const v of bed) peak = Math.max(peak, Math.abs(v));
  for (let i = 0; i < bed.length; i++) bed[i]! /= peak * 1.12;
  const file = "public/sounds/music_matchup2.mp3";
  encode(bed, file, 0);
  const lufs = (f: string) => Number(/I:\s+(-?[\d.]+) LUFS/.exec(measure(f, "ebur128").split("Summary:").pop() ?? "")?.[1]);
  const gain = -20 - lufs(file);
  encode(bed, file, gain);
  console.log(`${file}: ${total.toFixed(1)} s, ${lufs(file)} LUFS`);
}
