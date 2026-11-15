/**
 * Writes docs/design/cosmetics-redraws/GALLERY.md: every redrawn item, before and after, grouped by kind, with its
 * one-line switch (and, for a withdrawn item, its one-line restore). Pictures: identity-shots.tsx (gallery/<kind>/)
 * and game-looks-shots.ts (gallery/game-looks/).
 *
 *   bun scripts/cosmetic-redraws/gallery-doc.ts
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { REDRAWN_ART_ON } from "../../src/config/cosmeticRedraws";

const ROOT = join(import.meta.dir, "../..");
const DOC = join(ROOT, "docs/design/cosmetics-redraws");
type Item = { id: string; name: string; kind: string; rarity: string | null; source: string; pass_level: number | null; shop_price_coins: number | null };
const items = new Map(
  [
    ...(JSON.parse(readFileSync(join(ROOT, "docs/art/wave-2/catalogue.json"), "utf8")).items as Item[]),
    ...(JSON.parse(readFileSync(join(ROOT, "docs/art/wave-4/catalogue.json"), "utf8")).items as Item[]),
  ].map((i) => [i.id, i]),
);
const verdicts = JSON.parse(readFileSync(join(ROOT, "docs/cosmetics-review/verdicts.json"), "utf8")) as Record<string, string>;
const RESTORED = new Set(["card-back.royal-damask", "card-back.holo-foil", "card-back.neon"]);
const withdrawn = (id: string) => !RESTORED.has(id) && (verdicts[id] ?? "Keep") !== "Keep";

/** What each redraw is, one line. */
const WHAT: Record<string, string> = {
  "card-art.joulz-navy": "A glossy gold bolt on lit navy.",
  "card-art.bolt-stripes": "Raised navy bars in perspective with a gold bolt among them.",
  "card-art.grid": "A field of glossy tiles in perspective, a few lit cyan.",
  "card-art.waves": "Three glossy wave ribbons, blue and teal.",
  "card-art.hexes": "Raised hex tiles at varying heights, a few lit pink.",
  "card-art.dots": "A field of glossy domes, a few lit pink.",
  "card-art.sunburst": "A gold sun with rays fanning out, on warm amber.",
  "card-art.tier.spark": "The Spark tier: a copper bolt with sparks, in the tier's colour.",
  "card-art.tier.charge": "The Charge tier: a glossy cell with its bolt.",
  "card-art.tier.volt": "The Volt tier: a bolt through a ring.",
  "card-art.tier.surge": "The Surge tier: a bolt over two waves.",
  "card-art.tier.storm": "The Storm tier: a cloud with its bolt.",
  "card-art.tier.lightning": "The Lightning tier: twin bolts.",
  "card-art.tier.top-500": "Top 500: a gold crown with a jewel, with a slow light sweep.",
  "card-art.crimson": "Crimson blades fanned out, glossy red.",
  "card-art.royal": "A gold crown on a violet cushion.",
  "card-art.emerald": "An emerald with two small stones.",
  "card-art.lava": "Glossy molten blobs with drops of gold.",
  "card-art.diamond-plate": "Gold tread plate with pink and ice gems, with a slow light sweep.",
  "card-art.frost": "An ice-crystal cluster on frosty blue, nothing near the name.",
  "card-art.neon-skyline": "A lit city at dusk with a gold moon, on the right only, with a slow light sweep.",
  "card-art.static": "A field of grey blocks at random heights, a few lit cyan.",
  "frame.bronze": "Bevelled bronze lit from the top left, bronze studs.",
  "frame.silver": "Bevelled silver, silver studs.",
  "frame.obsidian": "Dark glass bevel with a violet edge and an inner line, obsidian studs.",
  "frame.founding": "Gold double bevel, a gold bolt crest, a light running round. The FOUNDER plaque is gone (unreadable on the strip).",
  "frame.top-500": "Gold double bevel, a crown crest, gem studs, a light running round; nothing outside the card.",
  "frame.championship": "Gold double bevel, a trophy crest, a light running round (today it has no art and draws Plain).",
  "frame.s1-spark": "Season 1 Spark: tier-coloured bevel, the tier's gem as crest. No unreadable SEASON 1 tab.",
  "frame.s1-charge": "Season 1 Charge: as Spark, in green.",
  "frame.s1-volt": "Season 1 Volt: as Spark, in cyan.",
  "frame.s1-surge": "Season 1 Surge: as Spark, in blue.",
  "frame.s1-storm": "Season 1 Storm: double bevel in violet, a light running round.",
  "frame.s1-lightning": "Season 1 Lightning: double bevel in gold-yellow, a light running round.",
  "frame.s1-top-500": "Season 1 Top 500: double gold bevel, a light running round.",
  "name-colour.chrome": "True chrome: a bright horizon band and a dark edge.",
  "name-colour.neon-pink": "Glossy pink with a dark edge.",
  "name-colour.neon-cyan": "Glossy cyan with a dark edge.",
  "name-colour.neon-red": "Glossy red with a dark edge.",
  "name-colour.electric-orange": "Glossy orange to gold in Archivo (the pixel face lost letters on the strip).",
  "avatar-finish.chrome": "Mirror chrome on the avatar, a gloss highlight and a chrome rim round the circle.",
  "avatar-finish.carbon": "Woven carbon under a clear coat, a carbon rim.",
  "avatar-finish.holographic": "Pastel foil with moving light bands, a foil rim.",
  "avatar-finish.neon-glow": "The player's own colour lit as a tube, with a ring of the same light.",
  "avatar-accessory.neon-bolt": "A 3D cyan bolt above the circle.",
  "reaction.spark": "A glossy gold star.",
  "reaction.zap": "A glossy cyan bolt.",
  "reaction.clutch": "A gold plaque reading CLUTCH!",
  "reaction.captains-calls": "Glossy speech bubbles, each phrase on one line.",
  "reaction.retro-arcade": "Four glossy key caps: a heart, 1UP, LAG!!, GLHF.",
  "reaction.neon-signs": "Four framed sign boards, each word in its own colour.",
  "celebration.spotlight": "A gold podium drum under two swaying beams and a pool of light.",
  "celebration.shockwave": "Rings bursting out from the podium drum.",
  "celebration.circuit-overload": "Gold circuit traces with pulses running in, gold bolts above.",
  "tile-style.circuit-trace": "Raised gold traces and pads on a dark green board.",
  "card-back.royal-damask": "Gold-ink damask, a lit gold frame with studs, a gold medallion with a raised bolt.",
  "card-back.holo-foil": "Pearl foil with prism bands, a silver frame, a white star.",
  "card-back.neon": "Dark glass with a fine grid, a cyan frame, pink traces, a white-cored bolt.",
  "game-skin.crazy-golf.watermelon": "A glossy watermelon ball: ragged rind stripes.",
  "game-skin.crazy-golf.disco": "Lit mirror tiles, brighter to the top left.",
  "game-skin.crazy-golf.neon-glow": "A translucent cyan ball with shaded dimples.",
  "game-skin.crazy-golf.plasma": "A violet ball with a glowing core and white-cored arcs.",
  "game-skin.cue-ball.pixel-pool": "Pixel balls shaded in whole pixels, a pixel highlight.",
  "game-skin.cue-ball.galaxy-set": "The galaxy balls with full gloss.",
  "game-skin.cue-ball.neon-8-ball": "The 8 as glass lit from inside, gloss and a bright rim.",
  "game-skin.cue-ball.neon-ball-set": "Every ball as glass lit from inside in its colour.",
  "game-skin.curl-champ.glacier": "Polished granite with an icy top.",
  "game-skin.curl-champ.aurora": "Polished granite with an aurora disc.",
  "game-skin.curl-champ.neon-stones": "Polished granite with lit tube inlays.",
  "game-skin.full-house.midnight-felt": "Woven midnight cloth with nap, a lit rail, stitching.",
  "game-skin.full-house.crimson-velvet": "Crimson velvet with nap, a lit rail, stitching.",
  "game-skin.full-house.neon-felt": "Dark cloth with a lit cyan tube edge.",
  "world-theme.apex.neon-night": "A deep sky with a horizon glow, a moon, lit towers; the road unchanged.",
  "world-theme.crazy-golf.neon-course": "Lit night turf; rails and hazards as lit tubes on the same lines.",
  "world-theme.curl-champ.neon-rink": "Ice with depth and a lit arena; every ring and line where it was.",
};

const ORDER = ["card-art", "frame", "name-colour", "avatar-finish", "avatar-accessory", "reaction", "celebration", "tile-style", "card-back", "game-skin", "world-theme"];
const TITLE: Record<string, string> = {
  "card-art": "Card arts", frame: "Frames", "name-colour": "Name colours", "avatar-finish": "Avatar finishes", "avatar-accessory": "Avatar accessory",
  reaction: "Reaction packs", celebration: "Celebrations", "tile-style": "Tile style", "card-back": "Card backs", "game-skin": "Game skins", "world-theme": "World themes",
};
const pic = (id: string, side: "before" | "after") => {
  const kind = items.get(id)!.kind;
  const game = ["game-skin", "world-theme", "card-back"].includes(kind);
  const rel = game ? `gallery/game-looks/${id}--${side}.png` : `gallery/${kind}/${id}--${side}.webp`;
  if (!existsSync(join(DOC, rel))) throw new Error(`missing ${rel}`);
  return rel;
};
const ids = Object.keys(REDRAWN_ART_ON);
const sections = ORDER.map((kind) => {
  const mine = ids.filter((id) => items.get(id)!.kind === kind);
  if (!mine.length) return "";
  const rows = mine.map((id) => {
    const it = items.get(id)!;
    const where = it.source === "shop" ? `Shop, ${it.shop_price_coins?.toLocaleString("en-GB")} coins` : it.source.startsWith("pass") ? `Pass ${it.source === "pass-free" ? "free" : "premium"} level ${it.pass_level}` : it.source.replace(/-/g, " ");
    const w = withdrawn(id);
    return `### ${it.name}\n\n\`${id}\` · ${it.rarity ?? "no rarity"} · ${where} · ${w ? "**withdrawn**" : "live"}. ${WHAT[id] ?? ""}\n\n| Today | Redrawn |\n|---|---|\n| <img src="${pic(id, "before")}" width="330"> | <img src="${pic(id, "after")}" width="330"> |\n\nUse the new art: in \`src/config/cosmeticRedraws.ts\`, \`"${id}": true,\`` + (w ? `  \nRestore it (offer it again): \`SELECT economy.restore_item('${id}', 'redrawn, approved <date>');\`` : "");
  });
  return `## ${TITLE[kind]} (${mine.length})\n\n${rows.join("\n\n")}`;
}).filter(Boolean);

let bytes = 0;
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
for (const f of walk(join(DOC, "gallery"))) bytes += statSync(f).size;

const md = `# Cosmetics redraws: gallery (phase 2 step 4, 15 Nov 2026)

Every redrawn item, today's art beside the redraw, drawn by the app's own components and renderers at phone size
under Reduce Motion (stills: the Legendaries' sweeps and the frames' running light don't show). The audit that chose
them: [AUDIT.md](AUDIT.md).

**Players see no change tonight.** Each item draws its new art only when its switch in
\`src/config/cosmeticRedraws.ts\` is \`true\`; every switch is \`false\`. Turning one on is that one line. Withdrawn items
stay withdrawn whatever their switch says: restoring one is its own line, \`economy.restore_item\`
(docs/economy/withdrawn.md). Nothing here changes who owns an item, what is offered, or any price.

**How they are made.** The art kit's pipeline and finish: every object is a 3D scene in the kit's raymarcher (one
gloss material, one key light from the top left, a soft contact shadow), \`docs/design/cosmetics-redraws/source/\`
(\`render.html\` the renderer, \`scenes.ts\` every piece's scene, colours and camera, \`render.ts\` writes
\`public/cosmetics/redrawn/<piece>.webp\`); the compositions are \`scripts/cosmetic-redraws/\` (\`card.ts\`, \`cosmetics.ts\`),
built by \`bun scripts/cosmetic-redraws.ts\` into \`src/design/identity/redrawnArt.data.ts\`; the in-game looks are canvas
painters in \`src/lib/arcade/skins/\` (the shared gloss in \`gloss.renderer.ts\`). Pictures:
\`bun scripts/cosmetic-redraws/identity-shots.tsx\` and \`bun scripts/cosmetic-redraws/game-looks-shots.ts\`; this page
\`bun scripts/cosmetic-redraws/gallery-doc.ts\`. Gallery pictures: ${(bytes / 1024 / 1024).toFixed(2)} MB.

${sections.join("\n\n")}
`;
writeFileSync(join(DOC, "GALLERY.md"), md);
console.log(`gallery: ${ids.length} items, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
