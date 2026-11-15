/**
 * Writes docs/design/cosmetics-redraws/AUDIT.md: every cosmetic (the 118 catalogue items, the 32 avatars, the 10 gems,
 * the 54 badges, the trophies, medals and emblems, titles) judged against Joe's premium rule and the art kit's finish,
 * keep or redraw, with a thumbnail. Redraw = listed in src/config/cosmeticRedraws.ts. The reasons start from the
 * cosmetics review's (draft PR #389, its verdicts copied to review-389.json); this session's own additions say so.
 *
 *   bun scripts/cosmetic-redraws/audit-doc.ts
 */
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { REDRAWN_ART_ON } from "../../src/config/cosmeticRedraws";
import { BADGES } from "../../src/lib/badges/catalogue";

const ROOT = join(import.meta.dir, "../..");
const DOC = join(ROOT, "docs/design/cosmetics-redraws");
type Item = { id: string; name: string; kind: string; rarity: string | null; source: string; pass_level: number | null; shop_price_coins: number | null; png: string | null };
const w2 = JSON.parse(readFileSync(join(ROOT, "docs/art/wave-2/catalogue.json"), "utf8")).items as Item[];
const w4 = JSON.parse(readFileSync(join(ROOT, "docs/art/wave-4/catalogue.json"), "utf8")).items as Item[];
const reviews = JSON.parse(readFileSync(join(DOC, "review-389.json"), "utf8")) as Record<string, { v: string; why: string; fix?: string }>;
const withdrawnNow = JSON.parse(readFileSync(join(ROOT, "docs/cosmetics-review/verdicts.json"), "utf8")) as Record<string, string>;
const RESTORED = new Set(["card-back.royal-damask", "card-back.holo-foil", "card-back.neon"]);

/** This session's own verdicts where they differ from the review's (Joe's rule read against the art kit's finish). */
const OWN: Record<string, string> = {
  "card-art.crimson": "Added by this audit: kept by the review, but it is two flat red chevrons at 1,000 coins; beside the art kit's 3D finish it reads as a free starter.",
  "card-art.emerald": "Added by this audit: kept by the review, but a flat green panel with one diagonal at 1,000 coins; no depth, no light.",
  "card-art.tier.lightning": "Added by this audit: kept by the review, but the seven tier arts must be one set stepping up in finish; Lightning is the old flat template, so it is redrawn with its siblings.",
};

const thumb = (src: string, w = 150) => `<img src="${src}" width="${w}" alt="">`;
const where = (it: Item) =>
  it.source === "shop" ? `Shop, ${it.shop_price_coins?.toLocaleString("en-GB")} coins` : it.source.startsWith("pass") ? `Pass ${it.source === "pass-free" ? "free" : "premium"} ${it.pass_level}` : it.source.replace(/-/g, " ");
const status = (id: string) => (RESTORED.has(id) ? "live (restored 13 Nov)" : withdrawnNow[id] && withdrawnNow[id] !== "Keep" ? "withdrawn" : "live");

const KIND_ORDER = ["card-art", "frame", "name-colour", "avatar-finish", "avatar-accessory", "avatar-special-edition", "reaction", "celebration", "tile-style", "card-back", "game-skin", "world-theme"];
const KIND_TITLE: Record<string, string> = {
  "card-art": "Card arts", frame: "Frames", "name-colour": "Name colours", "avatar-finish": "Avatar finishes", "avatar-accessory": "Avatar accessory",
  "avatar-special-edition": "Avatar special edition", reaction: "Reaction packs", celebration: "Celebrations", "tile-style": "Tile styles",
  "card-back": "Card backs", "game-skin": "Game skins", "world-theme": "World themes",
};
const items = [...w2.map((i) => ({ ...i, png: i.png ? `../../art/wave-2/${i.png}` : null })), ...w4.map((i) => ({ ...i, png: i.png ? `../../art/wave-4/${i.png}` : null }))];
let redraw = 0;
let keep = 0;
const sections: string[] = [];
for (const kind of KIND_ORDER) {
  const rows = items.filter((i) => i.kind === kind);
  const lines = rows.map((it) => {
    const r = it.id in REDRAWN_ART_ON;
    if (r) redraw++;
    else keep++;
    const rv = reviews[it.id];
    const why = OWN[it.id] ?? (rv ? `${rv.why}${r && rv.fix ? ` <br>Redraw: ${rv.fix}` : ""}` : "");
    const pic = it.png ? thumb(it.png) : "(no art: draws the Plain frame)";
    return `| ${pic} | **${it.name}** <br>\`${it.id}\` <br>${it.rarity ?? "no rarity"} · ${where(it)} · ${status(it.id)} | **${r ? "Redraw" : "Keep"}** | ${why.replace(/\|/g, "/")} |`;
  });
  sections.push(`## ${KIND_TITLE[kind]} (${rows.length})\n\n| | Item | Verdict | Why |\n|---|---|---|---|\n${lines.join("\n")}`);
}
const catalogueRedraw = redraw;
const catalogueKeep = keep;

/* Beyond the catalogue: every other cosmetic a player shows. All kept, with the reason. */
const av = JSON.parse(readFileSync(join(ROOT, "docs/art/avatars/avatars.json"), "utf8")) as { avatars: { slug: string; name: string }[]; gems: Record<string, unknown> };
const AV_WHY = "Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery).";
const extra: string[] = [];
extra.push(
  `## Avatars (32)\n\n| | Item | Verdict | Why |\n|---|---|---|---|\n` +
    av.avatars.map((a) => `| ${thumb(`../../art/avatars/svg/${a.slug}.svg`, 64)} | **${a.name}** \`avatar.${a.slug}\` · free | **Keep** | ${AV_WHY} |`).join("\n"),
);
extra.push(
  `## Gems (10)\n\n| | Item | Verdict | Why |\n|---|---|---|---|\n` +
    Object.keys(av.gems)
      .map((g) => `| ${thumb(`../../art/avatars/svg/gem-example-${g.toLowerCase().replace(/\s+/g, "-")}.svg`, 64)} | **${g}** · unlocked by stars | **Keep** | A three-stop jewel tint on the avatar's main colour; reads as metal and stone at card size. |`)
      .join("\n"),
);
extra.push(
  `## Badges (${BADGES.length})\n\n| | Item | Verdict | Why |\n|---|---|---|---|\n` +
    BADGES.map((b) => `| ${thumb(`../../../public/art/badges/${b.slug}.svg`, 48)} | **${b.name}** \`${b.slug}\` · ${b.rarity} | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |`).join("\n"),
);
const REWARD = [
  ["trophy-bronze", "Bronze trophy"], ["trophy-silver", "Silver trophy"], ["trophy-gold", "Gold trophy"], ["trophy-championship", "Championship trophy"],
  ["medal-gold", "Gold medal"], ["medal-silver", "Silver medal"], ["medal-bronze", "Bronze medal"],
  ["emblem-spark", "Spark emblem"], ["emblem-charge", "Charge emblem"], ["emblem-volt", "Volt emblem"], ["emblem-surge", "Surge emblem"], ["emblem-storm", "Storm emblem"], ["emblem-lightning", "Lightning emblem"],
] as const;
extra.push(
  `## Trophies, medals and tier emblems (${REWARD.length + 2})\n\n| | Item | Verdict | Why |\n|---|---|---|---|\n` +
    REWARD.map(([f, n]) => `| ${thumb(`../../art/svg/${f}.svg`, 56)} | **${n}** | **Keep** | Approved reward art (F5), drawn in the metals the redraws match. |`).join("\n") +
    `\n| ${thumb("../../../public/art/emblems/top-500.svg", 56)} | **Top 500 emblem** | **Keep** | Approved (mockup 03, W3a's tier). |` +
    `\n| ${thumb("../../art/svg/emblem-storm.svg", 56)} | **Season 1 emblem** (\`SeasonEmblem\`: the tier emblem with its S1 mark) | **Keep** | The tier emblems above with a season mark; nothing of its own to redraw. |`,
);
extra.push(
  `## Titles (41)\n\nText only (the card's title line in \`--jz-gold\`): **Keep**. They are words, not art; the card's own type carries them.`,
);
const totalKeep = keep + 32 + 10 + BADGES.length + REWARD.length + 2 + 41;
const md = `# Cosmetics audit (phase 2 step 4, 15 Nov 2026)

Joe's rule: everything offered must look premium; anything that doesn't isn't offered. Every cosmetic is judged
against that rule and the art kit's finish (docs/design/style-guide/STYLE-GUIDE.md, "Art kit": one gloss material,
one key light from the top left, a soft contact shadow; no flat SVG for anything the kit can render). Starting point:
the cosmetics review (draft PR #389, its verdicts in [review-389.json](review-389.json)); where this audit differs it
says so. Thumbnails are today's art. The redraws, before and after: [GALLERY.md](GALLERY.md).

**Counts.** Catalogue (118 items): **${catalogueRedraw} redraw, ${catalogueKeep} keep** (the review's 72 not-Keep items, plus
Crimson, Emerald and the Lightning tier art). Every cosmetic in all (adding 32 avatars, 10 gems, ${BADGES.length} badges,
${REWARD.length + 2} trophies, medals and emblems, and 41 titles): **${catalogueRedraw} redraw, ${totalKeep} keep**.

“Status” is today's: *withdrawn* items are not sold or given (docs/economy/withdrawn.md) and stay withdrawn; nothing
here changes what is offered, owned or priced.

${sections.join("\n\n")}

# Beyond the catalogue

${extra.join("\n\n")}
`;
writeFileSync(join(DOC, "AUDIT.md"), md);
console.log(`audit: catalogue ${catalogueRedraw} redraw / ${catalogueKeep} keep; all ${catalogueRedraw} redraw / ${totalKeep} keep`);
