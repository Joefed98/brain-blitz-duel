/**
 * Sound wiring, 18 Nov 2026: points every manifest slot Joe has recorded (docs/sound-cues/sounds-batch-*.csv and
 * sounds-retakes.csv) at its file in src/lib/fx/manifest.ts, with `ms` its exact length (the file's LAME tag), and adds
 * the slots the batches marked "to add" (one entry each in the section ADDED_HEAD names). A slot served by the
 * NEW_GAME_SOUNDS switch (src/lib/fx/newGameSounds.data.ts: Joe's file under the placeholder's name) is left to the
 * switch. Not wired (Joe, 18 Nov 2026): hover.gate, hover.star, hover.thrust, bastion.weakTing (their rows are TO RECORD).
 *
 *   bun scripts/sound-wiring-nov18/wire.ts [--check]
 *
 * --check changes nothing and fails if the manifest is not as this script writes it.
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { soundBatchRows } from "../../src/lib/offline/soundBatches";
import { readMp3Gapless, MP3_DECODER_DELAY } from "../../src/lib/mp3Gapless";
import { NEW_GAME_SOUND_FILES } from "../../src/lib/fx/newGameSounds";

const MANIFEST = "src/lib/fx/manifest.ts";
const ADDED_HEAD = "  // Joe's sound batches, wired 18 Nov 2026 (scripts/sound-wiring-nov18/wire.ts): the slots the batches marked";
/** The announcer's lines (src/lib/fx/announcer.ts), each its own file. */
export const ANNOUNCER_VOICES = [
  "great", "brilliant", "superb", "amazing", "outstanding", "incredible",
  "sensational", "unbelievable", "phenomenal", "perfect", "legendary", "flawless",
] as const;

export function exactMs(path: string): number {
  const tag = readMp3Gapless(new Uint8Array(readFileSync(path)));
  if (!tag) throw new Error(`${path}: no LAME tag`);
  return Math.round(((tag.frames * tag.frameSamples - tag.delay - tag.padding - MP3_DECODER_DELAY) / tag.sampleRate) * 1000);
}

interface Want {
  slot: string;
  url: string;
  ms: number;
  loop: boolean;
  channel: "effects" | "music" | "voice";
}

export function wanted(): Want[] {
  const out = new Map<string, Want>();
  for (const r of soundBatchRows()) {
    if (r.toRecord || r.file.includes(".base.")) continue;
    // The switch's: the slot's placeholder, or a recording several slots share under its own name (word.key.mp3 for
    // Strikeout's and Cryptogrid's keys).
    if (NEW_GAME_SOUND_FILES[r.slot] || SWITCH_URLS.has(`/sounds/${r.file}`)) continue;
    const channel = r.slot.startsWith("music_") ? "music" : "effects";
    out.set(r.slot, { slot: r.slot, url: `/sounds/${r.file}`, ms: channel === "music" ? 0 : exactMs(`public/sounds/${r.file}`), loop: r.loop, channel });
  }
  for (const v of ANNOUNCER_VOICES) {
    const slot = `voice.${v}`;
    if (!existsSync(`public/sounds/${slot}.mp3`)) throw new Error(`public/sounds/${slot}.mp3 missing (scripts/sound-wiring-nov18/process.py --write)`);
    out.set(slot, { slot, url: `/sounds/${slot}.mp3`, ms: exactMs(`public/sounds/${slot}.mp3`), loop: false, channel: "voice" });
  }
  return [...out.values()];
}

const SWITCH_URLS = new Set(Object.values(NEW_GAME_SOUND_FILES).map((f) => f.url));
const keyOf = (slot: string) => (/^[A-Za-z_][A-Za-z0-9_]*$/.test(slot) ? slot : JSON.stringify(slot));

export function wire(src: string): { text: string; changed: string[]; added: string[] } {
  const lines = src.split("\n");
  const end = lines.findIndex((l) => l.startsWith("} satisfies Record<string, SoundEntry>;"));
  const changed: string[] = [];
  const added: string[] = [];
  // Drop an earlier run's added block, so the script can run again.
  const head = lines.indexOf(ADDED_HEAD);
  if (head >= 0) lines.splice(head, end - head);
  const stop = lines.findIndex((l) => l.startsWith("} satisfies Record<string, SoundEntry>;"));
  const missing: Want[] = [];
  for (const w of wanted()) {
    const re = new RegExp(`^  ${keyOf(w.slot).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}: \\{(.*)\\},(\\s*//.*)?$`);
    const at = lines.findIndex((l, i) => i < stop && re.test(l));
    if (at < 0) {
      missing.push(w);
      continue;
    }
    const before = lines[at]!;
    let line = before.replace(/url: (null|"[^"]*")/, `url: ${JSON.stringify(w.url)}`);
    if (w.channel !== "music") line = line.replace(/ms: \d+/, `ms: ${w.ms}`);
    if (line !== before) {
      lines[at] = line;
      changed.push(w.slot);
    }
  }
  if (missing.length) {
    const block = [
      ADDED_HEAD,
      "  // \"to add\": each plays its recording at its moment (the game's sound observer or stage names it).",
      ...missing
        .sort((a, b) => a.slot.localeCompare(b.slot))
        .map((w) => `  ${keyOf(w.slot)}: { channel: "${w.channel}", frequency: 0, ms: ${w.ms}, url: ${JSON.stringify(w.url)}${w.loop ? ", loop: true" : ""} },`),
    ];
    lines.splice(stop, 0, ...block);
    added.push(...missing.map((w) => w.slot));
  }
  return { text: lines.join("\n"), changed, added };
}

if (import.meta.main) {
  const src = readFileSync(MANIFEST, "utf8");
  const { text, changed, added } = wire(src);
  if (process.argv.includes("--check")) {
    if (text !== src) {
      console.error("FAIL: src/lib/fx/manifest.ts is not wired as scripts/sound-wiring-nov18/wire.ts writes it");
      process.exit(1);
    }
    console.log("PASS: the manifest is wired");
  } else {
    writeFileSync(MANIFEST, text);
    console.log(`${changed.length} slots pointed at their files, ${added.length} added: ${added.join(", ")}`);
  }
}
