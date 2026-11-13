/**
 * Cosmetics review (13 Nov 2026): GALLERY.md and gallery/<type>.md, for browsing on a phone in GitHub. Every item's
 * phone-size picture inline, with its id, source, rarity and verdict. Reads the same data as build-sheet.ts.
 *   bun docs/cosmetics-review/tools/build-gallery.ts
 */
import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";

import { BUNDLES } from "../../../src/lib/shop/bundles";
import { GROUPS, REVIEWS, type Review } from "./verdicts";

const ROOT = "docs/cosmetics-review";
type Raw = { id: string; name: string; kind: string; rarity: string | null; source: string; pass_level: number | null; png: string | null; dir: string };
const { catalogueItems } = await import("../../../scripts/catalogue-files");
const items = catalogueItems<Raw>();
const PRICE: Record<string, string> = { Epic: "1,000", Elite: "1,600", Legendary: "2,800" };
const bundleOf = new Map<string, string>();
for (const b of BUNDLES) for (const id of b.items) bundleOf.set(id, b.name);

function source(r: Raw): string {
  switch (r.source) {
    case "shop":
      return `Shop, ${PRICE[r.rarity ?? ""] ?? "?"} coins${bundleOf.has(r.id) ? ` (${bundleOf.get(r.id)} bundle)` : ""}`;
    case "pass-free":
      return `Pass, free track, level ${r.pass_level}`;
    case "pass-premium":
      return `Pass, premium track, level ${r.pass_level}`;
    case "free-starter":
      return "Free starter";
    case "earned-season-peak-tier":
      return "Earned: season peak tier";
    case "earned-founding-player":
      return "Earned: Founding Player";
    case "earned-top-500":
      return "Earned: Top 500";
    case "tournament":
      return "Earned: Championship";
    default:
      return r.source;
  }
}
const mark = (v: Review | undefined) => (v ? (v.v === "Keep" ? "✅ Keep" : v.v === "Improve" ? "🟠 Improve" : "⛔ Withdraw") : "?");
const verdict = (v: Review | undefined) =>
  v ? `**${mark(v)}**${/PLACEHOLDER/.test(v.why) ? " · 🚧 **PLACEHOLDER**" : ""} — ${v.why}${v.fix ? `<br>*Premium would be:* ${v.fix}` : ""}` : "";

const GAME_DIR: Record<string, string> = { "cue-ball": "pool", "crazy-golf": "minigolf", "curl-champ": "curling", apex: "racing", "top-bins": "freekick", "full-house": "pokersquares" };
function pictures(r: Raw, up: string): string[] {
  const p = (path: string) => (existsSync(`${ROOT}/${path}`) ? `${up}${path}` : null);
  const still = r.png ? `${up}../art/${r.dir.replace(/^docs\/art\//, "")}/${r.png}` : null;
  let ours: (string | null)[] = [];
  if (["card-art", "frame", "name-colour", "reaction", "celebration", "tile-style"].includes(r.kind) || r.kind.startsWith("avatar-")) ours = [p(`png/${r.kind}/${r.id}--phone.png`)];
  else if (r.kind === "card-back") ours = [p(`png/cards/back--${r.id}--small.png`), p(`png/cards/back--${r.id}--large.png`)];
  else {
    const g = GAME_DIR[r.id.split(".")[1]!]!;
    ours = [p(`png/games/${g}--${r.id}--phone.png`), p(`png/skins-vs-art/${r.id.split(".")[1]}--${r.id.split(".").pop()}.png`)];
  }
  return [...(still ? [`<img src="${still}" width="220" alt="approved still">`] : []), ...ours.filter(Boolean).map((s) => `<img src="${s}" width="${r.kind.startsWith("game-skin") || r.kind === "world-theme" ? 220 : 340}" alt="in the app">`)];
}

const TYPES: { file: string; title: string; kinds: string[]; extra?: string }[] = [
  { file: "card-art", title: "Card art", kinds: ["card-art"] },
  { file: "frames", title: "Frames (incl. Season 1 and Championship)", kinds: ["frame"] },
  { file: "name-colours", title: "Name colours", kinds: ["name-colour"] },
  { file: "avatars", title: "Avatars, gems, finishes, accessory, special edition", kinds: ["avatar-finish", "avatar-accessory", "avatar-special-edition"], extra: "avatars" },
  { file: "reactions", title: "Reactions (emotes)", kinds: ["reaction"] },
  { file: "celebrations-tiles", title: "Celebrations and tile styles", kinds: ["celebration", "tile-style"] },
  { file: "game-looks", title: "Game skins, world themes and card backs", kinds: ["game-skin", "world-theme", "card-back"] },
  { file: "badges-trophies", title: "Badges, titles, trophies, emblems", kinds: [], extra: "badges" },
];

mkdirSync(`${ROOT}/gallery`, { recursive: true });
const index: string[] = [
  "# Cosmetics gallery",
  "",
  "Every cosmetic at phone size (390 wide), as the app draws it, beside its approved still (left). Verdicts from the review (13 Nov 2026); details in [README.md](README.md).",
  "",
];
for (const t of TYPES) {
  const list = items.filter((i) => t.kinds.includes(i.kind));
  const lines = [`# ${t.title}`, "", "[← Gallery](../GALLERY.md)", ""];
  if (t.extra === "avatars") {
    lines.push("## The 32 avatars", "", `Free for everyone. ${verdict(GROUPS.avatars)}`, "", `<img src="../png/avatar/all-32--phone.png" width="340">`, "");
    lines.push("## Gems", "", `Unlocked by stars. ${verdict(GROUPS.gems)}`, "");
    for (const f of readdirSync(`${ROOT}/png/gem`).filter((x) => x.endsWith("--phone.png")).sort()) lines.push(`\`${f.replace("--phone.png", "")}\`<br><img src="../png/gem/${f}" width="340">`, "");
  }
  if (t.extra === "badges") {
    lines.push("## Badges (54)", "", verdict(GROUPS.badges), "", `<img src="../png/badge/all-54--phone.png" width="340">`, "", `<img src="../png/badge/on-card--phone.png" width="340">`, "");
    lines.push("## Titles", "", verdict(GROUPS.titles), "");
    lines.push("## Trophies, medals, tier emblems", "", verdict(GROUPS.trophies), "", `<img src="../png/trophy/trophies--phone.png" width="340">`, "");
    lines.push("## Season emblem", "", verdict(GROUPS.seasonEmblem), "", "## PLUS chip", "", verdict(GROUPS.plusChip), "");
  }
  for (const r of list) {
    lines.push(`## ${r.name}`, "", `\`${r.id}\` · ${source(r)} · ${r.rarity ?? "no rarity"}`, "", verdict(REVIEWS[r.id]), "", pictures(r, "../").join(" "), "");
  }
  writeFileSync(`${ROOT}/gallery/${t.file}.md`, lines.join("\n"));
  const v = list.map((r) => REVIEWS[r.id]?.v);
  index.push(`- [${t.title}](gallery/${t.file}.md)${list.length ? ` — ${list.length} items: ${v.filter((x) => x === "Keep").length} Keep, ${v.filter((x) => x === "Improve").length} Improve, ${v.filter((x) => x === "Withdraw").length} Withdraw` : ""}`);
}
index.push("", "**Redrawn for approval:** [gallery/redrawn.md](gallery/redrawn.md) (the Top 500 frame and Frost)");
index.push("", "Card fronts (mockups): [gallery/card-fronts.md](gallery/card-fronts.md) · The real screens: [gallery/screens.md](gallery/screens.md)");
writeFileSync(
  `${ROOT}/gallery/card-fronts.md`,
  ["# Card fronts: three options (mockups)", "", "[← Gallery](../GALLERY.md)", "", ...[["default", "Today"], ["A-stock", "A. Card stock (recommended)"], ["B-court", "B. Court set"], ["C-ink", "C. Ink finish (not recommended)"]].flatMap(([k, t]) => [`## ${t}`, "", `<img src="../png/cards/front--${k}--small.png" width="340">`, "", `<img src="../png/cards/front--${k}--large.png" width="340">`, ""])].join("\n"),
);
writeFileSync(
  `${ROOT}/gallery/screens.md`,
  ["# The real screens", "", "[← Gallery](../GALLERY.md)", "", ...readdirSync(`${ROOT}/png/screens`).filter((f) => f.endsWith(".png")).sort().flatMap((f) => [`## ${f.replace(".png", "")}`, "", `<img src="../png/screens/${f}" width="${f.includes("1440") ? 360 : 300}">`, ""])].join("\n"),
);
writeFileSync(`${ROOT}/GALLERY.md`, index.join("\n") + "\n");
console.log("build-gallery: done");
