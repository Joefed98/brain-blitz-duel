/**
 * Cosmetics review (13 Nov 2026): writes docs/cosmetics-review/index.html, the browsable contact sheet, from the PNGs
 * the three render tools wrote, the catalogue files, the bundles, the pass and verdicts.ts. Open it from a checkout
 * (every image path is relative).   bun docs/cosmetics-review/tools/build-sheet.ts
 */
import { existsSync, readdirSync, writeFileSync } from "node:fs";

import { BUNDLES } from "../../../src/lib/shop/bundles";
import { GROUPS, REVIEWS, type Review } from "./verdicts";

const ROOT = "docs/cosmetics-review";
type Raw = { id: string; name: string; kind: string; game: string | null; rarity: string | null; source: string; pass_level: number | null; png: string | null; dir: string };
const { catalogueItems } = await import("../../../scripts/catalogue-files");
const items = catalogueItems<Raw>();
const PRICE: Record<string, number> = { Epic: 1000, Elite: 1600, Legendary: 2800 };
const bundleOf = new Map<string, string>();
for (const b of BUNDLES) for (const id of b.items) bundleOf.set(id, `${b.name} (${b.size}, ${b.price.toLocaleString("en-GB")})`);

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const img = (src: string, label: string, cls = "") => (existsSync(`${ROOT}/${src}`) || src.startsWith("../") ? `<figure class="${cls}"><a href="${src}"><img loading="lazy" src="${src}" alt="${esc(label)}"></a><figcaption>${esc(label)}</figcaption></figure>` : "");

function source(r: Raw): string {
  switch (r.source) {
    case "shop":
      return `Shop, ${PRICE[r.rarity ?? ""]?.toLocaleString("en-GB") ?? "?"} coins${bundleOf.has(r.id) ? `; bundle: ${bundleOf.get(r.id)}` : ""}`;
    case "pass-free":
      return `Season 1 pass, free track, level ${r.pass_level}`;
    case "pass-premium":
      return `Season 1 pass, premium track, level ${r.pass_level}`;
    case "free-starter":
      return "Free starter (every account)";
    case "earned-season-peak-tier":
      return "Earned: season peak tier (pass.close_season)";
    case "earned-founding-player":
      return "Earned: Founding Player badge";
    case "earned-top-500":
      return "Earned: Top 500 (nothing grants it yet)";
    case "tournament":
      return "Earned: Joulz Championship winner";
    default:
      return r.source;
  }
}

function verdict(v: Review | undefined): string {
  if (!v) return `<p class="v none">No verdict</p>`;
  return `<p class="v ${v.v.toLowerCase()}"><b>${v.v}</b>${v.placeholder || /PLACEHOLDER/.test(v.why) ? ` <span class="ph">PLACEHOLDER</span>` : ""} ${esc(v.why)}</p>${v.fix ? `<p class="fix"><b>Premium would be:</b> ${esc(v.fix)}${v.wait ? " <i>(wait for the overhaul's style guide)</i>" : ""}</p>` : ""}`;
}

function itemCard(r: Raw, pics: string): string {
  const rv = REVIEWS[r.id];
  return `<article id="${r.id}" data-verdict="${rv?.v ?? ""}"><h3>${esc(r.name)} <code>${r.id}</code></h3>
<p class="meta">${esc(source(r))} · ${r.rarity ?? "no rarity"}</p>${verdict(rv)}<div class="pics">${pics}</div></article>`;
}

const still = (r: Raw) => (r.png ? img(`../art/${r.dir.replace(/^docs\/art\//, "")}/${r.png}`.replace("//", "/"), "Approved still", "still") : `<figure class="still none"><div>No approved art</div><figcaption>Approved still</figcaption></figure>`);
const pair = (dir: string, id: string) => img(`png/${dir}/${id}--phone.png`, "Phone, 390 wide (DPR 2)") + img(`png/${dir}/${id}--desktop.png`, "Desktop, 1440 × 900 (DPR 1)", "wide");

const sections: { id: string; title: string; intro: string; body: string }[] = [];
const kinds = (k: string) => items.filter((i) => i.kind === k);

sections.push({
  id: "screens",
  title: "The real screens",
  intro: "The app itself on the local database harness, as a tester who owns every item (Neon City card art, Gold frame and Prism name equipped), under Reduce Motion. Phone 390 × 844 (whole page) and 1440 × 900.",
  body: (existsSync(`${ROOT}/png/screens`) ? readdirSync(`${ROOT}/png/screens`).filter((f) => f.endsWith(".png")).sort() : []).map((f) => img(`png/screens/${f}`, f.replace(".png", ""), f.includes("1440") ? "wide" : "tall")).join(""),
});

for (const [k, title, intro] of [
  ["card-art", "Card art", "Each on the Profile card, the nameplate strip in a board row, and the Friends list's mini card."],
  ["frame", "Frames (including the Season 1 frames and the Championship frame)", "As card art."],
  ["name-colour", "Name colours", "As card art."],
] as const)
  sections.push({ id: k, title, intro, body: kinds(k).map((r) => itemCard(r, still(r) + pair(k, r.id))).join("") });

sections.push({
  id: "titles-badges",
  title: "Titles and badge art",
  intro: "Titles are text on the card (41: 32 badge titles, 2 pass titles, 7 season titles). Badges: all 54 at the collection's 56 px, and three on a card.",
  body: `<article><h3>Titles</h3>${verdict(GROUPS.titles)}</article><article><h3>Badges</h3>${verdict(GROUPS.badges)}<div class="pics">${pair("badge", "all-54")}${pair("badge", "on-card")}</div></article>`,
});

sections.push({
  id: "avatars",
  title: "Avatars, gems, finishes, the accessory and the special edition",
  intro: "On the Profile card (the size players see an avatar), on the strip and the mini card.",
  body:
    `<article><h3>The 32 avatars</h3><p class="meta">Free for everyone</p>${verdict(GROUPS.avatars)}<div class="pics">${pair("avatar", "all-32")}</div></article>` +
    `<article><h3>Gems (10)</h3><p class="meta">Unlocked by the star total (Amber 10 … Diamond 250)</p>${verdict(GROUPS.gems)}<div class="pics">${readdirSync(`${ROOT}/png/gem`).filter((f) => f.endsWith("--phone.png")).sort().map((f) => img(`png/gem/${f}`, f.replace("--phone.png", ""))).join("")}</div></article>` +
    items.filter((i) => i.kind.startsWith("avatar-")).map((r) => itemCard(r, still(r) + pair(r.kind, r.id))).join(""),
});

sections.push({
  id: "reactions",
  title: "Emotes and reactions",
  intro: "Each pack's emotes at chat size (34 px tall, RoomChat). Rooms also have six free Unicode emoji; there is no free emote pack.",
  body: kinds("reaction").map((r) => itemCard(r, still(r) + pair("reaction", r.id))).join(""),
});

sections.push({
  id: "celebrations-tiles",
  title: "Celebrations and tile styles",
  intro: "Celebrations as the final screen's strip draws them; tile styles on the player's own Practice tiles (104 px), plain tile last.",
  body: [...kinds("celebration"), ...kinds("tile-style")].map((r) => itemCard(r, still(r) + pair(r.kind, r.id))).join(""),
});

const games = JSON.parse(await Bun.file(`${ROOT}/tools/games-shots.json`).text()) as Record<string, { look: string; phone: string; desktop: string; scene?: string }[]>;
const GAME_DIR: Record<string, string> = { pool: "cue-ball", minigolf: "crazy-golf", curling: "curl-champ", racing: "apex", freekick: "top-bins", pokersquares: "full-house" };
const byLook = (g: string, look: string) => games[g]!.find((x) => x.look === look);
const gameBody = (r: Raw) => {
  const g = Object.keys(GAME_DIR).find((k) => r.id.includes(`.${GAME_DIR[k]}.`))!;
  const shot = byLook(g, r.id)!;
  const def = byLook(g, "default")!;
  return itemCard(
    r,
    still(r) +
      img(`png/games/${shot.phone}`, "In game: phone (2 px a world unit)", "tall") +
      img(`png/games/${def.phone}`, "Default, same frame", "tall") +
      (shot.scene ? img(`png/games/${shot.scene}`, "Desktop: the world at 1 px a unit with its scene round it (the tall column)", "tall") : "") +
      (existsSync(`${ROOT}/png/skins-vs-art/${GAME_DIR[g]}--${r.id.split(".").pop()}.png`) ? img(`png/skins-vs-art/${GAME_DIR[g]}--${r.id.split(".").pop()}.png`, "Approved art | our painter | difference (compare-art.ts)", "wide") : ""),
  );
};
sections.push({
  id: "game-skins",
  title: "Game skins and world themes, inside their games",
  intro: "Drawn by each game's own renderer through the live stage's draw calls (scripts/skins/frames.ts) on the sim's own states, under Reduce Motion. NOTE: Crazy Golf's 'NaN%' readout is this tool's fake aim, not the app.",
  body: [...kinds("game-skin"), ...kinds("world-theme")].map(gameBody).join(""),
});

sections.push({
  id: "card-backs",
  title: "Card backs, inside their games",
  intro: "The shared deck's face-down card at the card games' sizes (Free Cell / Summit 48 × 76, Full House's Next card 60 × 84), 2 px a unit. Today only Full House (practice only) draws a back.",
  body:
    `<article><h3>Default back</h3><div class="pics">${img("png/cards/back--default--small.png", "48 × 76")}${img("png/cards/back--default--large.png", "60 × 84")}</div></article>` +
    kinds("card-back").map((r) => itemCard(r, still(r) + img(`png/cards/back--${r.id}--small.png`, "48 × 76 (Summit, Thirteen, Free Cell size)") + img(`png/cards/back--${r.id}--large.png`, "60 × 84 (Full House)") + (existsSync(`${ROOT}/png/skins-vs-art/card-back--${r.id.split(".").pop()}.png`) ? img(`png/skins-vs-art/card-back--${r.id.split(".").pop()}.png`, "Approved | ours | difference", "wide") : ""))).join(""),
});

sections.push({
  id: "card-fronts",
  title: "Card fronts: three options (MOCKUPS)",
  intro: "Mockups, not app code: each starts from the app's real face and changes only what the option changes. Indices and pips are copied untouched. See README section 3.",
  body: [
    ["default", "Today's faces"],
    ["A-stock", "A. Card stock: the paper and edge (recommended)"],
    ["B-court", "B. Court set: J, Q, K portraits only"],
    ["C-ink", "C. Ink finish: foil ink, red stays red and black stays black (not recommended)"],
  ]
    .map(([k, t]) => `<article><h3>${t}</h3><div class="pics">${img(`png/cards/front--${k}--small.png`, "48 × 76 (small cards: the large-index layout)", "wide")}${img(`png/cards/front--${k}--large.png`, "72 × 104 (pip layout)", "wide")}</div></article>`)
    .join(""),
});

sections.push({
  id: "trophies",
  title: "Trophies, medals, tier emblems, the season emblem and the Plus chip",
  intro: "The approved F5 art drawn by src/design/art. Season frames are under Frames.",
  body: `<article><h3>Trophies, medals, emblems</h3>${verdict(GROUPS.trophies)}<div class="pics">${pair("trophy", "trophies")}</div></article><article><h3>Season emblem</h3>${verdict(GROUPS.seasonEmblem)}</article><article><h3>PLUS chip</h3>${verdict(GROUPS.plusChip)}</article>`,
});

/* Totals */
const all = items.map((r) => REVIEWS[r.id]?.v ?? "none");
const tally = (v: string) => all.filter((x) => x === v).length;
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Cosmetics Review</title><style>
:root{color-scheme:dark}
body{margin:0;background:#07070A;color:#F5F5F7;font:15px/1.45 Archivo,system-ui,sans-serif}
header,section{max-width:1280px;margin:0 auto;padding:16px}
nav a{color:#F2C75C;margin-right:14px}
h2{border-top:1px solid #2A2E3A;padding-top:20px}
article{background:#11131A;border-radius:12px;padding:12px 14px;margin:12px 0}
h3{margin:0 0 4px;font-size:16px} code{color:#9AA3B8;font-size:12px}
.meta{margin:0;color:#BDBDCC;font-size:13px}
.v{margin:6px 0 0} .v b{padding:1px 8px;border-radius:6px;margin-right:6px}
.keep b{background:#1F5133} .improve b{background:#6A4B12} .withdraw b{background:#6B1C26}
.ph{background:#B00020;color:#fff;font-weight:800;padding:1px 6px;border-radius:4px;font-size:12px}
.fix{margin:4px 0 0;color:#D9DCE6;font-size:13px}
.pics{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px;align-items:flex-start}
figure{margin:0;max-width:100%} figure img{display:block;max-width:100%;height:auto;border-radius:6px;background:#000}
figure.still img{max-width:260px} figure.tall img{max-height:520px;width:auto}
figure.none div{width:200px;height:80px;display:grid;place-items:center;border:1px dashed #555;border-radius:6px;color:#999}
figcaption{font-size:12px;color:#9AA3B8;margin-top:3px}
.filters button{background:#1A1D27;color:#F5F5F7;border:1px solid #333;border-radius:8px;padding:6px 10px;margin-right:6px}
@media (max-width:600px){figure.tall img{max-height:none;width:100%}}
</style></head><body>
<header><h1>Cosmetics review</h1><p>13 Nov 2026, from main f268bcd. ${items.length} catalogue items: <b>${tally("Keep")}</b> Keep, <b>${tally("Improve")}</b> Improve, <b>${tally("Withdraw")}</b> Withdraw. Placeholders are marked in red. The written review (where each type shows, card fronts, withdrawing, checks, decisions) is <a href="README.md">README.md</a>.</p>
<p class="filters">Show: <button onclick="f('')">All</button><button onclick="f('Keep')">Keep</button><button onclick="f('Improve')">Improve</button><button onclick="f('Withdraw')">Withdraw</button></p>
<nav>${sections.map((s) => `<a href="#${s.id}">${s.title.split(/[:(]/)[0]}</a>`).join("")}</nav></header>
${sections.map((s) => `<section id="${s.id}"><h2>${s.title}</h2><p>${s.intro}</p>${s.body}</section>`).join("\n")}
<script>function f(v){document.querySelectorAll('article[data-verdict]').forEach(a=>{a.style.display=!v||a.dataset.verdict===v?'':'none'})}</script>
</body></html>`;
writeFileSync(`${ROOT}/index.html`, html);
console.log(`build-sheet: ${items.length} items · Keep ${tally("Keep")} · Improve ${tally("Improve")} · Withdraw ${tally("Withdraw")} · none ${tally("none")}`);
