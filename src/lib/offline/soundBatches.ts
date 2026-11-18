/**
 * Joe's sound batches (docs/sound-cues/sounds-batch-*.csv, 16 Nov 2026): recordings cut and levelled into
 * public/sounds/ before the overhaul PRs wire them. Node only (reads the repo's docs): used by the offline worker's
 * build step (swPlugin.ts) and by sound-manifest-check, never by the app.
 *
 * Every CSV whose name starts `sounds-batch-` counts, so a batch's derived files (batch 2's pitch-shifted series,
 * `sounds-batch-2-series.csv`) are listed with it. A row whose note starts "TO RECORD" has no file yet.
 */
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export interface SoundBatchRow {
  /** The CSV it came from (repo-relative). */
  csv: string;
  file: string;
  slot: string;
  pr: string;
  loop: boolean;
  note: string;
  /** No usable upload yet: nothing in public/sounds/ to check. */
  toRecord: boolean;
  /** An ambience bed (its note says so): stereo, as the library's beds, not mono. */
  stereo: boolean;
}

/** One CSV line into its fields (double quotes, "" inside them). */
function fields(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out;
}

export function soundBatchRows(root = "."): SoundBatchRow[] {
  const dir = join(root, "docs", "sound-cues");
  if (!existsSync(dir)) return [];
  const rows: SoundBatchRow[] = [];
  for (const name of readdirSync(dir).filter((n) => /^sounds-batch-.*\.csv$/.test(n)).sort()) {
    const csv = `docs/sound-cues/${name}`;
    const lines = readFileSync(join(dir, name), "utf8").replace(/\r/g, "").trim().split("\n");
    const head = fields(lines[0]!);
    const col = (k: string) => head.indexOf(k);
    for (const line of lines.slice(1)) {
      const f = fields(line);
      const note = col("note") >= 0 ? (f[col("note")] ?? "") : "";
      rows.push({
        csv,
        file: f[col("file")] ?? "",
        slot: f[col("slot")] ?? "",
        pr: f[col("pr")] ?? "",
        loop: (f[col("loop")] ?? "").trim().toLowerCase() === "yes",
        note,
        toRecord: note.startsWith("TO RECORD"),
        stereo: /ambience bed/i.test(note),
      });
    }
  }
  return rows;
}
