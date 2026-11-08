/**
 * The manifest's slots per file in public/sounds, as JSON for fix.py and table.py: each file (no extension) with its
 * slots, their `volume`s, whether any slot loops, and its channel (music / voice / effects).
 *
 *   bun scripts/sound-audit-nov-2026/slots.ts > slots.json
 */
import { SOUND_MANIFEST } from "../../src/lib/fx/manifest";

type Entry = { channel: string; url: string | null; volume?: number; loop?: boolean };
const out: Record<string, { slots: string[]; vols: number[]; loop: boolean; channel: string }> = {};
for (const [id, e] of Object.entries(SOUND_MANIFEST as Record<string, Entry>)) {
  const file = e.url?.match(/^\/sounds\/(.+)\.mp3$/)?.[1];
  if (!file) continue;
  const o = (out[file] ??= { slots: [], vols: [], loop: false, channel: e.channel });
  o.slots.push(id);
  o.vols.push(e.volume ?? 1);
  if (e.loop) o.loop = true;
  if (e.channel === "music" || e.channel === "voice") o.channel = e.channel;
}
console.log(JSON.stringify(out));
