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

/** Why a switch is still off (Joe's verdicts of 15 Nov 2026). */
const OFF_WHY: Record<string, string> = {
  polish: "off: polished for Joe's approval",
  redo: "off: redone for Joe's approval",
  idea: "off: redone keeping the original's idea, for Joe's approval",
  celebration: "off: Captain Joulz on the podium, for Joe's approval",
  navy: "off: Joe's \"Royal Navy\" may mean this item or Royal; kept as today until he says",
};
const offWhy = (id: string): string =>
  id === "card-art.joulz-navy" ? OFF_WHY.navy! : id.startsWith("celebration.") ? OFF_WHY.celebration! : ["card-art.crimson", "card-art.diamond-plate"].includes(id) ? OFF_WHY.redo! : /^(frame\.(founding|top-500|championship|s1-)|card-art\.(emerald|frost|neon-skyline|royal|tier\.top-500))/.test(id) ? OFF_WHY.polish! : OFF_WHY.idea!;

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
  "card-art.galaxy": "A spiral galaxy of ~300,000 star particles, a filamentary nebula, stars at three depths with depth of field.",
  "card-art.joulz-navy": "Navy lacquer with a champagne-gold bolt inlay under soft studio light.",
  "card-art.bolt-stripes": "Diagonal gold inlay stripes in navy lacquer.",
  "card-art.grid": "A floor of navy glass tiles in perspective.",
  "card-art.waves": "Navy satin in soft waves.",
  "card-art.hexes": "Raised hex tiles in perspective.",
  "card-art.dots": "A halftone of gold studs fading across navy.",
  "card-art.sunburst": "Shown as Sunrise (Joe, 15 Nov): a dusk sun over a sea of cloud.",
  "card-art.tier.spark": "Spark: an anvil with a white-hot bar, sparks spraying in the forge's glow.",
  "card-art.tier.charge": "Charge: a glass cell holding a green plasma column, steel caps, cables.",
  "card-art.tier.volt": "Volt: two copper coils with cyan arcs between them.",
  "card-art.tier.surge": "Surge: a dark wave rolling in, its crest lit blue, spray.",
  "card-art.tier.storm": "Storm: a violet storm cloud base, forks of lightning, a ground strike; a flash every few seconds.",
  "card-art.tier.lightning": "Lightning: storm clouds lit from inside by a branching gold strike over a dark sea; a flash every few seconds.",
  "card-art.tier.top-500": "Polished (Joe, 15 Nov): a larger crown on a tall stepped pedestal under a shaft of gold light, crimson drapes, gold columns, gold dust; a slow light sweep.",
  "card-art.crimson": "Redone (Joe, 15 Nov): a crimson velvet theatre curtain in heavy folds, gathered by a gold rope and tassel, gold fringe, warm stage light.",
  "card-art.royal": "Polished (Joe, 15 Nov): a gold crown with sapphires and diamonds on navy velvet with gold braid, a sceptre, navy drapes.",
  "card-art.emerald": "Polished (Joe, 15 Nov): large brilliant emerald crystals with an inner glow, back-lit, and a step-cut stone.",
  "card-art.lava": "Black crust with glowing cracks and a molten channel, steam and embers.",
  "card-art.diamond-plate": "Redone (Joe, 15 Nov): steel tread plate set with brilliant-cut diamonds, one large stone in front, white sparkle; a slow light sweep.",
  "card-art.frost": "Polished (Joe, 15 Nov): a lake furred with rime over clear ice, rime at the spires' feet, frost glitter, a colder dawn.",
  "card-art.neon-skyline": "Polished (Joe, 15 Nov): calmer: the right-hand towers only, a clean dusk sky behind the name, three neon accents, the moon; a slow light sweep.",
  "card-art.static": "Redone to keep its idea (TV static): a vintage walnut TV in a dark room, its curved glass full of fine static and scanlines.",
  "frame.founding": "Polished (Joe, 15 Nov): luminous metal, sparkling stones, a soft aura and twinkles. Cast champagne gold: engraved band, four set diamonds, an enamel crest with a raised bolt between laurels, and a plaque with the player's own number (full card only); a light runs over the metal.",
  "frame.top-500": "Polished (Joe, 15 Nov): luminous metal, sparkling stones, a soft aura and twinkles. Heavy dark gold with filigree and a crimson enamel inlay, a gold coronet with pearls and a ruby, ruby cabochons; a TOP 500 plaque; a light runs over it.",
  "frame.championship": "Polished (Joe, 15 Nov): luminous metal, sparkling stones, a soft aura and twinkles. Platinum outer band and gold inner band with navy enamel, a gold trophy on a platinum sunburst inside a laurel wreath, diamond-set stars; a CHAMPION plaque; a light runs over it.",
  "frame.s1-top-500": "Polished (Joe, 15 Nov): luminous metal, sparkling stones, a soft aura and twinkles. Season 1 Top 500: black and gold enamel, diamonds, a sunburst behind the hexagonal 1 medallion; a light runs over it.",
  "frame.s1-lightning": "Polished (Joe, 15 Nov): luminous metal, sparkling stones, a soft aura and twinkles. Season 1 Lightning: gold with gold-yellow enamel, a double band, extra stones; a light runs over it.",
  "frame.s1-storm": "Polished (Joe, 15 Nov): luminous metal, sparkling stones, a soft aura and twinkles. Season 1 Storm: gold with amethyst enamel, a double band; a light runs over it.",
  "frame.s1-surge": "Polished (Joe, 15 Nov): luminous metal, sparkling stones, a soft aura and twinkles. Season 1 Surge: gold with sapphire enamel, extra stones.",
  "frame.s1-volt": "Polished (Joe, 15 Nov): luminous metal, sparkling stones, a soft aura and twinkles. Season 1 Volt: platinum with cyan enamel.",
  "frame.s1-charge": "Polished (Joe, 15 Nov): luminous metal, sparkling stones, a soft aura and twinkles. Season 1 Charge: platinum with emerald enamel.",
  "frame.s1-spark": "Polished (Joe, 15 Nov): luminous metal, sparkling stones, a soft aura and twinkles. Season 1 Spark: copper with copper enamel (the calmest of the family).",
  "frame.obsidian": "Black volcanic glass with violet light along the inner edge, glass shards at the corners.",
  "frame.silver": "Polished silver with fine engraved lines.",
  "frame.bronze": "Warm satin bronze, plain (everyday).",
  "name-colour.chrome": "Letters filled with rendered polished chrome, a dark edge.",
  "name-colour.neon-pink": "Keeps its idea: a lit pink neon tube with a pale hot core and a dark edge.",
  "name-colour.neon-cyan": "Keeps its idea: a lit cyan neon tube with a pale hot core and a dark edge.",
  "name-colour.neon-red": "Keeps its idea: a lit red neon tube with a pale hot core and a dark edge.",
  "name-colour.electric-orange": "Keeps its idea: the pixel face (Silkscreen) filled with rendered anodised orange, a dark edge, a soft glow.",
  "avatar-finish.chrome": "Rendered chrome on the avatar's shapes, a matching rim round the circle.",
  "avatar-finish.carbon": "Woven carbon under a clear coat, a carbon rim.",
  "avatar-finish.holographic": "Iridescent foil, a foil rim.",
  "avatar-finish.neon-glow": "The player's own colour with glass-tube reflections and a ring in that colour.",
  "avatar-accessory.neon-bolt": "Keeps its idea: a clearly cyan neon bolt above the circle, as large as its slot allows.",
  "reaction.spark": "Keeps its idea: the star character with glossy eyes, a smile and blush, and two gold sparkles.",
  "reaction.zap": "Keeps its idea: a cyan neon bolt with a white-hot core, its face, speed lines and a yellow spark.",
  "reaction.clutch": "A gold plaque with CLUTCH! engraved.",
  "reaction.captains-calls": "White ceramic speech bubbles, each phrase on one line.",
  "reaction.retro-arcade": "Keeps its idea: a rendered CRT plate with the pixel heart and pixel words (1UP, LAG!!, GLHF) under scanlines.",
  "reaction.neon-signs": "Dark sign boxes ringed with lit neon tubes.",
  "celebration.spotlight": "Captain Joulz (modelled in Blender) in his win pose on the podium under two spotlights in haze.",
  "celebration.shockwave": "Captain Joulz on the podium, rings of light across a glass floor.",
  "celebration.circuit-overload": "Captain Joulz on the podium on a lit gold circuit board with a pulsing surge.",
  "tile-style.circuit-trace": "A rendered circuit board round the game's tile scene.",
  "card-back.royal-damask": "Gold-foil damask, a medallion with a raised bolt.",
  "card-back.holo-foil": "Diagonal prism foil with a pearl star.",
  "card-back.neon": "Dark glass with a cyan tube, pink traces, a white bolt.",
  "game-skin.crazy-golf.watermelon": "A clear-coated sphere with ragged rind stripes.",
  "game-skin.crazy-golf.disco": "A mirror-tile ball lit by coloured lights.",
  "game-skin.crazy-golf.neon-glow": "A lit glass ball with dimples.",
  "game-skin.crazy-golf.plasma": "Plasma filaments inside violet glass.",
  "game-skin.cue-ball.pixel-pool": "The pixel balls lit cell by cell, a pixel highlight.",
  "game-skin.cue-ball.galaxy-set": "The galaxy balls under rendered resin light.",
  "game-skin.cue-ball.neon-8-ball": "The 8 under rendered glass light.",
  "game-skin.cue-ball.neon-ball-set": "Every ball under rendered glass light in its colour.",
  "game-skin.curl-champ.glacier": "Icy granite tops with a frost disc.",
  "game-skin.curl-champ.aurora": "Dark granite with a pink and cyan inlay.",
  "game-skin.curl-champ.neon-stones": "Granite with lit tube inlays.",
  "game-skin.full-house.midnight-felt": "Rendered midnight twill.",
  "game-skin.full-house.crimson-velvet": "Rendered crimson velvet nap.",
  "game-skin.full-house.neon-felt": "Rendered dark twill with its neon edge.",
  "world-theme.apex.neon-night": "The track through a rendered neon city: a night sky, a 360\u00b0 far skyline in haze, a near band of lit towers, skyscrapers along the road.",
  "world-theme.crazy-golf.neon-course": "Grained night turf under the lit tubes.",
  "world-theme.curl-champ.neon-rink": "Rendered ice with depth under the lit rink.",
};

const ORDER = ["card-art", "frame", "name-colour", "avatar-finish", "avatar-accessory", "reaction", "celebration", "tile-style", "card-back", "game-skin", "world-theme"];
const TITLE: Record<string, string> = {
  "card-art": "Card arts", frame: "Frames", "name-colour": "Name colours", "avatar-finish": "Avatar finishes", "avatar-accessory": "Avatar accessory",
  reaction: "Reaction packs", celebration: "Celebrations", "tile-style": "Tile style", "card-back": "Card backs", "game-skin": "Game skins", "world-theme": "World themes",
};
const pic = (id: string, side: "before" | "after") => {
  const kind = items.get(id)!.kind;
  const game = ["game-skin", "world-theme", "card-back"].includes(kind);
  const rel =
    id === "world-theme.apex.neon-night"
      ? `samples/apex/${side === "before" ? "today" : "redraw"}.png`
      : game
        ? `gallery/game-looks/${id}--${side}.png`
        : `gallery/${kind}/${id}--${side}.webp`;
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
    // The withdrawn status shown is today's (before this branch's restore migration applies).
    const status = REDRAWN_ART_ON[id]
      ? `**Switch: on** (Joe, 15 Nov 2026)${w ? "; restored by `20261118100000_restore_approved_redraws.sql`" : ""}`
      : `Switch: ${offWhy(id)}. To use it: \`"${id}": true,\` in \`src/config/cosmeticRedraws.ts\`${w ? `; to offer it again: \`SELECT economy.restore_item('${id}', 'redrawn, approved <date>');\`` : ""}`;
    return `### ${it.name}\n\n\`${id}\` · ${it.rarity ?? "no rarity"} · ${where} · ${w ? "**withdrawn**" : "live"}. ${WHAT[id] ?? ""}\n\n| Today | Redrawn |\n|---|---|\n| <img src="${pic(id, "before")}" width="330"> | <img src="${pic(id, "after")}" width="330"> |\n\n${status}`;
  });
  return `## ${TITLE[kind]} (${mine.length})\n\n${rows.join("\n\n")}`;
}).filter(Boolean);

let bytes = 0;
const walk = (d: string): string[] => readdirSync(d, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));
for (const f of walk(join(DOC, "gallery"))) bytes += statSync(f).size;

const md = `# Cosmetics redraws: gallery (second pass, 15 Nov 2026)

Every redrawn item, today's art beside the redraw, drawn by the app's own components and renderers at phone size
under Reduce Motion (stills: the Legendaries' sweeps and the frames' running light don't show). The audit that chose
them: [AUDIT.md](AUDIT.md).

**Players see no change tonight.** Each item draws its new art only when its switch in
\`src/config/cosmeticRedraws.ts\` is \`true\`; every switch is \`false\`. Turning one on is that one line. Withdrawn items
stay withdrawn whatever their switch says: restoring one is its own line, \`economy.restore_item\`
(docs/economy/withdrawn.md). Nothing here changes who owns an item, what is offered, or any price.

**How they are made** (the second pass, [ART-DIRECTION.md](ART-DIRECTION.md); the five first samples in
[SAMPLES.md](SAMPLES.md)): every item is rendered in Blender (Cycles, \`bpy\` 5.3, physically based materials, studio or
scene light, depth of field, atmosphere) by its script in \`docs/design/cosmetics-redraws/blender/\` into
\`public/cosmetics/redrawn/\`; card pieces are composed by \`scripts/cosmetic-redraws/v2/\` (the name side shaded, a strip
veil under the name on the leaderboard strip, plaque words on the full card only) and built by
\`bun scripts/cosmetic-redraws.ts\` into \`src/design/identity/redrawnArt.data.ts\`; the in-game looks paint their renders
into the games' cached layers (\`src/lib/arcade/skins/\`, through \`sceneImages.ts\`). Pictures:
\`bun scripts/cosmetic-redraws/identity-shots.tsx\` and \`bun scripts/cosmetic-redraws/game-looks-shots.ts\`; this page
\`bun scripts/cosmetic-redraws/gallery-doc.ts\`. Gallery pictures: ${(bytes / 1024 / 1024).toFixed(2)} MB.

${sections.join("\n\n")}
`;
writeFileSync(join(DOC, "GALLERY.md"), md);
console.log(`gallery: ${ids.length} items, ${(bytes / 1024 / 1024).toFixed(2)} MB`);
