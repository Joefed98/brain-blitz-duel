/**
 * MP3 gapless playback that doesn't depend on the browser (audio audit, 7 Nov 2026, fix 1;
 * docs/audit-nov-2026/audio.md "Encoder padding").
 *
 * Every file in public/sounds is an MP3 with a LAME/Lavc tag in its first (Info/Xing) frame: the encoder's delay at
 * the start and its padding at the end. A decoder that reads the tag (ffmpeg; Chrome and Firefox decode with it)
 * drops the delay plus the decoder's own 529 samples and the padding, and gives back exactly the original sound.
 * One that ignores it keeps ~1,100 samples of priming in front and the padding behind: every effect starts 23–25 ms
 * late and every loop gets 12–26 ms of near-silence at its join (the -60 dB edge trim doesn't catch it). Whether
 * iPhone Safari reads the tag is untested, so the app reads it itself: the bytes are parsed before decoding, and if
 * the decoded length is the whole decode (or one of its usual variants) rather than the exact length, the buffer is
 * trimmed to the exact sound. A buffer already the exact length is left alone. Anything else (no tag, an unexpected
 * length) is left as decoded and the caller falls back to its old edge trim.
 *
 * Presentation only: which sound plays when is unchanged.
 */

export type Mp3Gapless = {
  /** The file's own sample rate (Hz). */
  sampleRate: number;
  /** Audio frames, from the Info/Xing frame count (the tag frame itself not counted). */
  frames: number;
  /** Samples per frame: 1152 (MPEG-1 Layer III) or 576 (MPEG-2/2.5). */
  frameSamples: number;
  /** Encoder delay and padding, from the LAME/Lavc tag (samples). */
  delay: number;
  padding: number;
};

/** The decoder delay of an MPEG audio Layer III decoder (samples), dropped with the encoder delay. */
export const MP3_DECODER_DELAY = 529;

const RATES: Record<number, readonly number[]> = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };

/** The gapless numbers of an MP3 file's bytes, or null when there is no LAME-style tag to read. */
export function readMp3Gapless(data: ArrayBuffer | Uint8Array): Mp3Gapless | null {
  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
    let at = 0;
    if (bytes.length > 10 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) {
      const size = ((bytes[6]! & 0x7f) << 21) | ((bytes[7]! & 0x7f) << 14) | ((bytes[8]! & 0x7f) << 7) | (bytes[9]! & 0x7f);
      at = 10 + size + (bytes[5]! & 0x10 ? 10 : 0);
    }
    const end = Math.min(bytes.length - 4, at + 4096);
    while (at < end && !(bytes[at] === 0xff && (bytes[at + 1]! & 0xe0) === 0xe0)) at++;
    if (at >= end) return null;
    const version = (bytes[at + 1]! >> 3) & 3; // 3 MPEG-1, 2 MPEG-2, 0 MPEG-2.5
    const layer = (bytes[at + 1]! >> 1) & 3; // 1 = Layer III
    const rate = RATES[version]?.[(bytes[at + 2]! >> 2) & 3];
    if (layer !== 1 || !rate) return null;
    const mono = bytes[at + 3]! >> 6 === 3;
    const crc = (bytes[at + 1]! & 1) === 0 ? 2 : 0;
    const side = version === 3 ? (mono ? 17 : 32) : mono ? 9 : 17;
    let p = at + 4 + crc + side;
    const tag = String.fromCharCode(bytes[p]!, bytes[p + 1]!, bytes[p + 2]!, bytes[p + 3]!);
    if (tag !== "Info" && tag !== "Xing") return null;
    const flags = (bytes[p + 4]! << 24) | (bytes[p + 5]! << 16) | (bytes[p + 6]! << 8) | bytes[p + 7]!;
    p += 8;
    if (!(flags & 1)) return null;
    const frames = ((bytes[p]! << 24) | (bytes[p + 1]! << 16) | (bytes[p + 2]! << 8) | bytes[p + 3]!) >>> 0;
    p += 4;
    if (flags & 2) p += 4;
    if (flags & 4) p += 100;
    if (flags & 8) p += 4;
    if (p + 24 > bytes.length) return null;
    const encoder = String.fromCharCode(bytes[p]!, bytes[p + 1]!, bytes[p + 2]!, bytes[p + 3]!);
    if (encoder !== "LAME" && encoder !== "Lavc" && encoder !== "Lavf" && encoder !== "L3.9") return null;
    const delay = (bytes[p + 21]! << 4) | (bytes[p + 22]! >> 4);
    const padding = ((bytes[p + 22]! & 0x0f) << 8) | bytes[p + 23]!;
    const frameSamples = version === 3 ? 1152 : 576;
    if (!frames || !delay || frames * frameSamples <= delay + padding) return null;
    return { sampleRate: rate, frames, frameSamples, delay, padding };
  } catch {
    return null;
  }
}

/** What the browser's decoder did with the tag: "honoured" (exact length), "trimmed" (we trimmed it), "unknown". */
export type GaplessOutcome = "honoured" | "trimmed" | "unknown";

/**
 * Where the exact sound sits in a decode of `decodedLength` samples at `decodedRate`: its offset and length (samples
 * at the decoded rate), or null when the length matches no known decoder behaviour. Decoders that ignore the tag
 * give the whole decode (every frame's samples), with or without their own 529-sample delay, and some also decode
 * the Info frame as a silent frame.
 */
export function gaplessWindow(
  info: Mp3Gapless,
  decodedLength: number,
  decodedRate: number,
): { outcome: Exclude<GaplessOutcome, "unknown">; offset: number; length: number } | null {
  const ratio = decodedRate / info.sampleRate;
  const total = info.frames * info.frameSamples;
  const exact = total - info.delay - info.padding;
  const length = Math.round(exact * ratio);
  const tolerance = Math.ceil(2 * ratio) + 2;
  const near = (samples: number) => Math.abs(decodedLength - Math.round(samples * ratio)) <= tolerance;
  if (near(exact)) return { outcome: "honoured", offset: 0, length: decodedLength };
  const f = info.frameSamples;
  const d = MP3_DECODER_DELAY;
  const variants: Array<[number, number]> = [
    [total, info.delay + d],
    [total - d, info.delay],
    [total + f, f + info.delay + d],
    [total + f - d, f + info.delay],
  ];
  for (const [whole, offset] of variants) {
    if (!near(whole)) continue;
    const start = Math.round(offset * ratio);
    return { outcome: "trimmed", offset: start, length: Math.max(0, Math.min(length, decodedLength - start)) };
  }
  return null;
}

/** The decoded buffer trimmed to the exact sound (see the module comment), and what was done. */
export function gaplessBuffer(
  context: BaseAudioContext,
  decoded: AudioBuffer,
  info: Mp3Gapless | null,
): { buffer: AudioBuffer; outcome: GaplessOutcome } {
  if (!info) return { buffer: decoded, outcome: "unknown" };
  const window = gaplessWindow(info, decoded.length, decoded.sampleRate);
  if (!window) return { buffer: decoded, outcome: "unknown" };
  if (window.outcome === "honoured" || window.length <= 0) return { buffer: decoded, outcome: window.outcome };
  try {
    const out = context.createBuffer(decoded.numberOfChannels, window.length, decoded.sampleRate);
    for (let c = 0; c < decoded.numberOfChannels; c++)
      out.getChannelData(c).set(decoded.getChannelData(c).subarray(window.offset, window.offset + window.length));
    return { buffer: out, outcome: "trimmed" };
  } catch {
    return { buffer: decoded, outcome: "unknown" };
  }
}
