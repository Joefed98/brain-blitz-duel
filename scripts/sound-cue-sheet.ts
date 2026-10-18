/**
 * Builds docs/sound-cues/cue-sheet.md and cue-sheet.csv from the cue tables in
 * docs/sound-cues/*.md, the sound manifest and the puzzle registry.
 *
 *   bun scripts/sound-cue-sheet.ts           write both files
 *   bun scripts/sound-cue-sheet.ts --slots   print manifest slot lines that are still missing
 *
 * A design tool, not a check: sound-manifest-check proves the sheet and the
 * manifest agree. Re-run it after adding cues to a docs/sound-cues table or a
 * file to the manifest. It keeps the "new file" column of an existing CSV.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { PUZZLE_REGISTRY } from "../src/lib/duel/registry";
import { gameDisplayName } from "../src/lib/duel/gameNames";
import type { PuzzleCategory, PuzzleType } from "../src/lib/duel/types";
import { SOUND_MANIFEST } from "../src/lib/fx/manifest";

const DIR = "docs/sound-cues";
const SKIP = new Set(["README.md", "cue-sheet.md"]);

export type Status = "silent" | "synthesised placeholder" | "recorded sound";
export type Category =
  | "UI tap"
  | "game event"
  | "success sting"
  | "fail sting"
  | "room moment"
  | "replay"
  | "ambience"
  | "music";

export interface SheetRow {
  cue: string;
  group: string;
  where: string;
  /** What the effect looks like (arcade-effects.md), so a sound can be written for it; "" elsewhere. */
  looks: string;
  perRound: string;
  status: Status;
  fileToday: string;
  suggestedMs: string;
  category: Category;
  /** Manifest entry a new file goes on ("" when the cue has no slot). */
  slot: string;
  newFile: string;
}

interface DocRow {
  file: string;
  section: string;
  cells: Record<string, string>;
}

const manifest = SOUND_MANIFEST as Record<
  string,
  { url: string | null; channel: string; ms: number } | undefined
>;
const hasFile = (id: string) => !!manifest[id]?.url;
/** The recording a slot borrows: an app-wide entry (no dot in its id) with the same URL. */
const sharedRecording = (id: string) => {
  const url = manifest[id]?.url;
  if (!url) return null;
  return Object.keys(manifest).find((other) => other !== id && !other.includes(".") && manifest[other]?.url === url) ?? null;
};
const strip = (text: string) => text.replace(/`/g, "").trim();

/** Every table row in docs/sound-cues whose first column is a cue id. */
export function readDocRows(dir = DIR): DocRow[] {
  const rows: DocRow[] = [];
  for (const file of readdirSync(dir).sort()) {
    if (!file.endsWith(".md") || SKIP.has(file)) continue;
    let header: string[] | null = null;
    let section = "";
    for (const line of readFileSync(join(dir, file), "utf8").split("\n")) {
      if (line.startsWith("#")) section = line.replace(/^#+\s*/, "");
      if (!line.startsWith("|")) {
        header = null;
        continue;
      }
      const cells = line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((c) => c.trim());
      if (!header) {
        header = cells.map((c) => c.toLowerCase());
        continue;
      }
      if (cells.every((c) => /^:?-+:?$/.test(c))) continue;
      const cue = strip(cells[0] ?? "").replace(/^<gameId>\./, "*.");
      if (!/^(\*|[a-z][a-zA-Z0-9_]*)(\.[A-Za-z0-9-]+)*$/.test(cue)) continue;
      const record: Record<string, string> = {};
      header.forEach((name, i) => (record[name] = cells[i] ?? ""));
      record.cue = cue;
      rows.push({ file, section, cells: record });
    }
  }
  return rows;
}

/* ------------------------------------------------------------------ games */

const CATEGORY_ORDER: PuzzleCategory[] = [
  "word",
  "number",
  "speed",
  "attention",
  "pattern",
  "logic",
  "arcade",
];
export interface GameInfo {
  type: PuzzleType;
  name: string;
  category: PuzzleCategory;
  retired: boolean;
  music: string | null;
}
export function games(): GameInfo[] {
  return (Object.keys(PUZZLE_REGISTRY) as PuzzleType[])
    .map((type) => {
      const def = PUZZLE_REGISTRY[type];
      return {
        type,
        name: gameDisplayName(type),
        category: def.category,
        retired: def.retired,
        music: def.theme.music,
      };
    })
    .sort(
      (a, b) =>
        CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category) ||
        a.name.localeCompare(b.name),
    );
}

/** A puzzle's own bed slot; arcade games use music_<gameId>. */
export function gameMusicSlot(game: { type: string; category: string }): string {
  return game.category === "arcade" ? `music_${game.type}` : `music_${game.category}_${game.type}`;
}

/* -------------------------------------------------------- classification */

const SCREEN_GROUPS: Record<string, string> = {
  shared: "Shared screens and effects",
  room: "Room moments",
  music: "Music: screens",
};
const CORE_GROUPS: Record<string, PuzzleType> = {
  arc_hover_tap: "hover",
  arc_gem_match: "matchup",
  arc_gem_zap: "matchup",
  arc_gem_bomb: "matchup",
  arc_gem_star: "matchup",
  pz_laser_gem: "laser",
  pz_laser_split: "laser",
  pz_padlock: "wordslide",
  pz_safe_open: "safe",
  pz_bomb_explode: "bomb",
  pz_car_escape: "unblock",
  pz_clay_hit: "clayshoot",
  pz_gravity_pull: "gravity",
};
const VOICE =
  /^(prepareToDuel|round\d|finalRound|roundTaken|roundLost|winnerIs|winner_drumroll|winner_crash|gg|podium_fanfare|round_won|player_joined|voice\.[A-Za-z]+)$/;

function durationMs(text: string): number | null {
  const match = text.replace(/,/g, "").match(/(\d+(?:\.\d+)?)\s*(ms|s\b|ticks?)/);
  if (!match) return null;
  const value = Number(match[1]);
  if (match[2] === "ms") return Math.round(value);
  if (match[2]!.startsWith("tick")) return Math.round((value * 1000) / 60);
  return Math.round(value * 1000);
}

const SUCCESS =
  /solve|finish|perfect|signature|allFound|allBaskets|goldPulse|goldFaces|discsPop|finishShine|countersTick|countersLock|cardWave|finale|finalBurst|goldSparkle|gatesFlash|takeoff|trace|complete|round_won|podium|winner|^gg$|roundTaken|level|bull$|basket|pot$|bankComplete|defuse/;
const FAIL =
  /miss|wrong|reject|refused|crash|lost|Lost|dead|gameOver|caught|breakTone|time_up|roundLost|explode|bump$|reset|slice\.bomb|bombBell/;
const UI =
  /help\.|select|aim|\.place|^place$|^move$|^lock$|^tick$|\.lift|\.mark|unmark|countdown|reaction|\.tap|\.toggle|hover_tap|\.lane$|\.switch$|flipper|replay\.(speed|seek|close)|skip/;

function categoryFor(cue: string, file: string, perRound: string): Category {
  if (file === "replays.md") return "replay";
  if (file === "music.md" || cue.startsWith("music.")) return "music";
  if (perRound === "loop") return "ambience";
  if (cue.startsWith("room.") || VOICE.test(cue)) return "room moment";
  if (UI.test(cue)) return "UI tap";
  if (FAIL.test(cue)) return "fail sting";
  if (SUCCESS.test(cue)) return "success sting";
  return "game event";
}

function perRoundFor(cue: string, file: string): string {
  const event = cue.split(".").slice(1).join(".");
  if (file === "replays.md") {
    if (cue.startsWith("shared.timelapse.move")) return "10–60 per time-lapse";
    if (cue.startsWith("shared.")) return "0–2 per results screen";
    return "0–2 per highlight";
  }
  if (
    cue === "room.prepare" ||
    cue === "room.prepare.flash" ||
    cue.startsWith("room.winner") ||
    cue === "room.finalRound"
  )
    return "1 per room";
  if (cue.startsWith("room.round.")) return "1 (that round)";
  if (cue.startsWith("shared.signature")) return "0–1 (solve or 120+)";
  if (cue === "shared.perfect") return "0–1";
  if (cue.startsWith("shared.help")) return "0–2";
  if (
    /solve|finish|allFound|goldPulse|goldFaces|discsPop|finishShine|countersTick|countersLock|cardWave|finale|finalBurst|goldSparkle|gatesFlash|takeoff|trace|defuse/.test(
      event,
    )
  )
    return "0–1";
  if (/stage|level|advance|line$|trayIn|nextPicture|revealGrid|correct|sweepTick/.test(event))
    return "1–5";
  return "5–40 (per move)";
}

const DEFAULT_MS: Record<Category, number> = {
  "UI tap": 80,
  "game event": 200,
  "success sting": 1000,
  "fail sting": 300,
  "room moment": 2000,
  replay: 300,
  ambience: 0,
  music: 0,
};

function suggestedMs(length: string, category: Category, perRound: string): string {
  if (category === "music") return String(durationMs(length) ?? "loop");
  if (perRound === "loop" || /^loop$/.test(length)) return "loop";
  if (/^instant/.test(length)) return String(category === "replay" ? 250 : 150);
  const ms = durationMs(length);
  return String(Math.min(6000, ms ?? DEFAULT_MS[category]));
}

/* ------------------------------------------------------------------- rows */

function plainTrigger(text: string): string {
  return strip(text).replace(/\s+/g, " ");
}

export function buildRows(dir = DIR): SheetRow[] {
  const info = games();
  const byType = new Map(info.map((g) => [g.type as string, g]));
  const groupOf = (cue: string, file: string) => {
    if (file === "replays.md") return "Replays";
    if (file === "core.md") {
      const game =
        CORE_GROUPS[cue] ??
        (cue.startsWith("chain.") ? "chain" : cue.startsWith("beat.") ? "beat" : null);
      if (game) return byType.get(game)?.name ?? game;
      return VOICE.test(cue) ? "Room moments" : "App-wide sounds";
    }
    const prefix = cue.split(".")[0]!;
    return byType.get(prefix)?.name ?? SCREEN_GROUPS[prefix] ?? prefix;
  };
  const rows: SheetRow[] = [];
  const seen = new Set<string>();
  for (const { file, section, cells } of readDocRows(dir)) {
    const cue = cells.cue!;
    if (seen.has(cue)) throw new Error(`cue ${cue} is listed twice in ${DIR}`);
    seen.add(cue);
    const length = cells.length ?? cells["visual length"] ?? "";
    if (file === "music.md") {
      const slot = strip(cells.slot ?? "");
      const today = strip(cells["plays today"] ?? "");
      const todayId = today.split(/\s/)[0] ?? "";
      const own = slot && hasFile(slot);
      const file2 = own ? slot : manifest[todayId]?.url ? todayId : "";
      const where = `${strip(cells.screen ?? cells.game ?? "")}: ${today}`;
      const group =
        cue.startsWith("music.") && byType.has(cue.slice(6))
          ? byType.get(cue.slice(6))!.name
          : "Music: screens";
      if (cue === "music.round") continue;
      rows.push({
        cue,
        group,
        where,
        looks: "",
        perRound: "loop",
        status: file2 ? "recorded sound" : "silent",
        fileToday: file2
          ? own
            ? slot
            : `${file2}${slot && slot !== file2 ? " (shared)" : ""}`
          : "",
        suggestedMs: suggestedMs(length, "music", "loop"),
        category: "music",
        slot,
        newFile: "",
      });
      continue;
    }
    const perRound = strip(cells["per round"] ?? "") || perRoundFor(cue, file);
    const category = categoryFor(cue, file, perRound);
    const where = [
      cells.game || cells.where ? strip(cells.game || cells.where || "") : "",
      plainTrigger(cells.trigger ?? ""),
    ]
      .filter(Boolean)
      .join(": ");
    const source = `${file}${section && file === "pattern.md" ? ` (${section.replace(/`/g, "")})` : ""}`;
    let status: Status;
    let fileToday = "";
    let slot = "";
    if (file === "core.md") {
      const synth = cue === "chain.linkTone" || cue === "chain.breakTone" || cue === "beat.backing";
      // Tempo's backing beat has no slot (core.md says why); every other core cue has one.
      slot = cue === "beat.backing" ? "" : cue;
      if (hasFile(cue)) {
        status = "recorded sound";
        fileToday = cue;
      } else status = synth ? "synthesised placeholder" : "silent";
      if (cue === "warning_5") status = "silent";
    } else if (file === "arcade.md") {
      slot = cue;
      const fallback = strip(cells["plays today"] ?? "").split(/\s/)[0] ?? "";
      status = "recorded sound";
      fileToday = hasFile(cue) ? cue : `${fallback} (shared)`;
    } else {
      slot = cue;
      status = hasFile(cue) ? "recorded sound" : "silent";
      const borrowed = sharedRecording(cue);
      fileToday = hasFile(cue) ? (borrowed ? `${borrowed} (shared)` : cue) : "";
    }
    rows.push({
      cue,
      group: groupOf(cue, file),
      where: `${where} [${source}]`,
      looks: strip(cells["looks like"] ?? ""),
      perRound,
      status,
      fileToday,
      suggestedMs: suggestedMs(length, category, perRound),
      category,
      slot,
      newFile: "",
    });
  }
  // Every puzzle's round bed (arcade and screen beds come from music.md).
  for (const game of info) {
    if (game.category === "arcade") continue;
    const slot = gameMusicSlot(game);
    const own = hasFile(slot);
    rows.push({
      cue: `music.${game.type}`,
      group: game.name,
      looks: "",
      where: `${game.name} round bed${game.retired ? " (retired, practice)" : ""}: ${own ? slot : `${game.music ?? "none"} (${game.category} bed shared with other games)`}`,
      perRound: "loop",
      status: own || (game.music && hasFile(game.music)) ? "recorded sound" : "silent",
      fileToday: own ? slot : game.music ? `${game.music} (shared)` : "",
      suggestedMs: "60000",
      category: "music",
      slot,
      newFile: "",
    });
  }
  return rows;
}

/* ---------------------------------------------------------------- output */

const COLUMNS: [keyof SheetRow, string][] = [
  ["cue", "cue id"],
  ["group", "game or screen"],
  ["where", "where and when it fires"],
  ["looks", "what it looks like"],
  ["perRound", "how often in a typical round"],
  ["status", "status"],
  ["fileToday", "file it uses today"],
  ["suggestedMs", "suggested length (ms)"],
  ["category", "category"],
  ["slot", "manifest slot"],
  ["newFile", "new file"],
];

const groupRank = (() => {
  const order = [
    "Shared screens and effects",
    "App-wide sounds",
    "Room moments",
    "Music: screens",
    "Replays",
  ];
  const names = games().map((g) => g.name);
  return (group: string) => {
    const i = order.indexOf(group);
    if (i >= 0) return i;
    const g = names.indexOf(group);
    return g >= 0 ? 10 + g : 500;
  };
})();
const STATUS_RANK: Record<Status, number> = {
  silent: 0,
  "synthesised placeholder": 0,
  "recorded sound": 1,
};

export function sortRows(rows: SheetRow[]): SheetRow[] {
  return rows
    .map((row, i) => ({ row, i }))
    .sort(
      (a, b) =>
        STATUS_RANK[a.row.status] - STATUS_RANK[b.row.status] ||
        groupRank(a.row.group) - groupRank(b.row.group) ||
        a.row.group.localeCompare(b.row.group) ||
        a.i - b.i,
    )
    .map(({ row }) => row);
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

export function parseCsv(text: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cell += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      out.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell || row.length) {
    row.push(cell);
    out.push(row);
  }
  return out;
}

const mdCell = (value: string) => value.replace(/\|/g, "\\|");
const fileCell = (file: string) =>
  !file ? "none" : file.endsWith(" (shared)") ? `\`${file.slice(0, -9)}\` (shared)` : `\`${file}\``;

function writeSheet(rows: SheetRow[]): void {
  const csvPath = join(DIR, "cue-sheet.csv");
  // Keep any "new file" already filled in.
  const kept = new Map<string, string>();
  if (existsSync(csvPath)) {
    const [head, ...body] = parseCsv(readFileSync(csvPath, "utf8"));
    const c = head?.indexOf("cue id") ?? -1;
    const n = head?.indexOf("new file") ?? -1;
    if (c >= 0 && n >= 0) for (const r of body) if (r[n]) kept.set(r[c]!, r[n]!);
  }
  for (const row of rows) row.newFile = kept.get(row.cue) ?? "";
  const csv =
    [
      COLUMNS.map(([, h]) => h).join(","),
      ...rows.map((r) => COLUMNS.map(([k]) => csvCell(r[k])).join(",")),
    ].join("\n") + "\n";
  writeFileSync(csvPath, csv);

  const count = (pred: (r: SheetRow) => boolean) => rows.filter(pred).length;
  const categories = [...new Set(rows.map((r) => r.category))];
  const lines: string[] = [];
  lines.push("# Sound cue sheet", "");
  lines.push(
    "Generated by `bun scripts/sound-cue-sheet.ts` from the cue tables in this folder, `src/lib/fx/manifest.ts` and the",
    "puzzle registry; `sound-manifest-check` proves it matches the manifest. The same rows are in",
    "[cue-sheet.csv](cue-sheet.csv) with an empty **new file** column to fill in. How to add a file: [README.md](README.md).",
    "",
    "One row per cue. **Status** is what plays today: *recorded sound* (a file plays; *(shared)* means another",
    "game's or the app's file stands in until the cue's own slot gets one), *synthesised placeholder* (a",
    "generated tone) or *silent*. **How often** is an estimate for a typical round. **Suggested length** is the",
    "moment's on-screen length, capped at 6 s for one-shots. **Manifest slot** is the entry in",
    "`src/lib/fx/manifest.ts` whose `url` a new file goes on.",
    "",
    "Recorded files are hosted by Lovable (`/__l5e/assets-v1/<id>/<name>.mp3`) or, when they came in through git,",
    "kept in `public/sounds/` (`/sounds/<recording>.mp3`), one file per recording: several slots may name the same",
    "file. Every file is listed under [Recorded files](#recorded-files). **What it looks like** describes the arcade",
    "effects ([arcade-effects.md](arcade-effects.md)) so a sound can be written for each.",
    "",
    "## Summary",
    "",
    `| Category | Silent | Placeholder | Recorded | Total |`,
    `|---|---|---|---|---|`,
  );
  for (const cat of categories) {
    const of = (s: Status) => count((r) => r.category === cat && r.status === s);
    lines.push(
      `| ${cat} | ${of("silent")} | ${of("synthesised placeholder")} | ${of("recorded sound")} | ${count((r) => r.category === cat)} |`,
    );
  }
  lines.push(
    `| **all** | ${count((r) => r.status === "silent")} | ${count((r) => r.status === "synthesised placeholder")} | ${count((r) => r.status === "recorded sound")} | ${rows.length} |`,
    "",
  );

  const table = (subset: SheetRow[]) => {
    const groups = [...new Set(subset.map((r) => r.group))];
    for (const group of groups) {
      lines.push(
        `### ${group}`,
        "",
        `| ${COLUMNS.filter(([k]) => k !== "group" && k !== "newFile")
          .map(([, h]) => h)
          .join(" | ")} |`,
      );
      lines.push(
        `|${COLUMNS.filter(([k]) => k !== "group" && k !== "newFile")
          .map(() => "---")
          .join("|")}|`,
      );
      for (const r of subset.filter((x) => x.group === group))
        lines.push(
          `| \`${r.cue}\` | ${mdCell(r.where)} | ${mdCell(r.looks)} | ${mdCell(r.perRound)} | ${r.status} | ${fileCell(r.fileToday)} | ${r.suggestedMs} | ${r.category} | ${r.slot ? `\`${r.slot}\`` : "none"} |`,
        );
      lines.push("");
    }
  };
  lines.push(
    "## Silent and placeholder cues",
    "",
    "Grouped by game or screen. These are the cues still missing a sound.",
    "",
  );
  table(rows.filter((r) => r.status !== "recorded sound"));

  // Music by screen and game.
  lines.push("## Music by screen and game", "");
  lines.push(
    "| Screen or game | Category | In rooms | Music today | Own slot |",
    "|---|---|---|---|---|",
  );
  for (const r of rows.filter((x) => x.category === "music" && x.group === "Music: screens"))
    lines.push(
      `| ${r.where.split(":")[0]} | screen | | ${r.fileToday || "**none**"} | \`${r.slot}\` |`,
    );
  for (const g of games()) {
    const r = rows.find((x) => x.cue === `music.${g.type}`);
    lines.push(
      `| ${g.name} | ${g.category} | ${g.retired ? "practice only" : "yes"} | ${r?.fileToday || "**none**"} | \`${r?.slot ?? gameMusicSlot(g)}\` |`,
    );
  }
  lines.push("");

  lines.push("## Recorded cues", "", "Grouped by game or screen.", "");
  table(rows.filter((r) => r.status === "recorded sound"));

  lines.push("## Recorded files", "");
  lines.push(
    "Every file in the manifest. Length is the manifest's `ms` (the decoded length for effects and voice; music",
    "loops are not measured there). Files in `public/sounds/` are listed once per slot that names them.",
    "",
    "| File (manifest id) | Channel | Used by | Length (ms) |",
    "|---|---|---|---|",
  );
  for (const [id, entry] of Object.entries(manifest)) {
    if (!entry?.url) continue;
    const users = rows
      .filter((r) => r.fileToday.replace(" (shared)", "") === id || r.slot === id || r.cue === id)
      .map((r) => `\`${r.cue}\`${r.status === "silent" ? " (registered, never played)" : ""}`);
    lines.push(
      `| \`${id}\` | ${entry.channel} | ${users.join(", ") || "**unused**"} | ${entry.ms || "loop"} |`,
    );
  }
  lines.push("");
  writeFileSync(join(DIR, "cue-sheet.md"), lines.join("\n"));
}

/** Manifest lines for every slot the sheet names that the manifest lacks. */
export function missingSlotLines(rows: SheetRow[]): string[] {
  const out: string[] = [];
  for (const r of rows) {
    if (!r.slot || manifest[r.slot] || r.cue === "beat.backing") continue;
    const music = r.category === "music";
    const ms = /^\d+$/.test(r.suggestedMs) && !music ? Number(r.suggestedMs) : 0;
    const loop = r.perRound === "loop" && !music ? ", loop: true" : "";
    out.push(
      `  ${JSON.stringify(r.slot)}: { channel: "${music ? "music" : "effects"}", frequency: 0, ms: ${ms}, url: null${loop} },`,
    );
  }
  return out;
}

if (import.meta.main) {
  const rows = sortRows(buildRows());
  if (process.argv.includes("--slots")) console.log(missingSlotLines(rows).join("\n"));
  else {
    writeSheet(rows);
    console.log(`Wrote ${DIR}/cue-sheet.md and cue-sheet.csv: ${rows.length} rows.`);
  }
}
