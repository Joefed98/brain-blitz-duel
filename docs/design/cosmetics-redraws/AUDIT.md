# Cosmetics audit (phase 2 step 4, 15 Nov 2026)

Joe's rule: everything offered must look premium; anything that doesn't isn't offered. Every cosmetic is judged
against that rule and the art kit's finish (docs/design/style-guide/STYLE-GUIDE.md, "Art kit": one gloss material,
one key light from the top left, a soft contact shadow; no flat SVG for anything the kit can render). Starting point:
the cosmetics review (draft PR #389, its verdicts in [review-389.json](review-389.json)); where this audit differs it
says so. Thumbnails are today's art. The redraws, before and after: [GALLERY.md](GALLERY.md).

**Counts.** Catalogue (118 items): **75 redraw, 43 keep** (the review's 72 not-Keep items, plus
Crimson, Emerald and the Lightning tier art). Every cosmetic in all (adding 32 avatars, 10 gems, 54 badges,
15 trophies, medals and emblems, and 41 titles): **75 redraw, 195 keep**.

“Status” is today's: *withdrawn* items are not sold or given (docs/economy/withdrawn.md) and stay withdrawn; nothing
here changes what is offered, owned or priced.

## Card arts (32)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../art/wave-2/items/card-art/joulz-navy.png" width="150" alt=""> | **Joulz Navy** <br>`card-art.joulz-navy` <br>no rarity · free starter · withdrawn | **Redraw** | The default every new player wears: a flat navy panel with nothing on it. <br>Redraw: A subtle navy-to-ink gradient with a faint bolt watermark and a soft top sheen, so even the default card feels finished. |
| <img src="../../art/wave-2/items/card-art/bolt-stripes.png" width="150" alt=""> | **Bolt Stripes** <br>`card-art.bolt-stripes` <br>no rarity · free starter · withdrawn | **Redraw** | Two thin diagonal stripes on navy; reads as unfinished at phone size. <br>Redraw: Bolder, glowing bolt stripes with depth (a darker under-stripe) and a light sweep. |
| <img src="../../art/wave-2/items/card-art/grid.png" width="150" alt=""> | **Grid** <br>`card-art.grid` <br>no rarity · free starter · withdrawn | **Redraw** | A faint 1 px grid that nearly disappears on a phone. <br>Redraw: A perspective grid (horizon glow) rather than a flat one; doubles as a 'starter neon' look. |
| <img src="../../art/wave-2/items/card-art/waves.png" width="150" alt=""> | **Waves** <br>`card-art.waves` <br>no rarity · free starter · withdrawn | **Redraw** | Thin outline waves at low contrast; looks like a placeholder texture. <br>Redraw: Layered filled waves with a gradient, like a night sea; keep the name area calm. |
| <img src="../../art/wave-2/items/card-art/hexes.png" width="150" alt=""> | **Hexes** <br>`card-art.hexes` <br>no rarity · free starter · withdrawn | **Redraw** | Faint hex outlines, barely visible. <br>Redraw: Raised hex tiles with a soft bevel and a few lit cells. |
| <img src="../../art/wave-2/items/card-art/circuit.png" width="150" alt=""> | **Circuit** <br>`card-art.circuit` <br>no rarity · free starter · live | **Keep** | Readable green traces with nodes; a decent free design. |
| <img src="../../art/wave-2/items/card-art/dots.png" width="150" alt=""> | **Dots** <br>`card-art.dots` <br>no rarity · free starter · withdrawn | **Redraw** | A dot grid at very low contrast; disappears on the strip. <br>Redraw: A halftone fade (big dots to small) in a brand colour. |
| <img src="../../art/wave-2/items/card-art/sunburst.png" width="150" alt=""> | **Sunburst** <br>`card-art.sunburst` <br>no rarity · free starter · withdrawn | **Redraw** | Muddy brown rays; looks dated rather than premium. <br>Redraw: Gold rays on deep navy with a glow at the centre, so it matches the brand gold. |
| <img src="../../art/wave-2/items/card-art/tier--spark.png" width="150" alt=""> | **Spark** <br>`card-art.tier.spark` <br>no rarity · earned season peak tier · withdrawn | **Redraw** | Flat brown panel with one bolt; the lowest tier looks drab rather than bronze. <br>Redraw: A bronze metal finish (gradient, edge sheen) behind the bolt; the six tiers should step up in finish, not just hue. |
| <img src="../../art/wave-2/items/card-art/tier--charge.png" width="150" alt=""> | **Charge** <br>`card-art.tier.charge` <br>no rarity · earned season peak tier · withdrawn | **Redraw** | Flat green panel with a single bolt; very close to its siblings. <br>Redraw: Give each tier its own finish step (bronze → silver → gold → platinum → obsidian → diamond) as the rarity ladder does. |
| <img src="../../art/wave-2/items/card-art/tier--volt.png" width="150" alt=""> | **Volt** <br>`card-art.tier.volt` <br>no rarity · earned season peak tier · withdrawn | **Redraw** | Same template, teal. <br>Redraw: As Charge: a distinct finish per tier. |
| <img src="../../art/wave-2/items/card-art/tier--surge.png" width="150" alt=""> | **Surge** <br>`card-art.tier.surge` <br>no rarity · earned season peak tier · withdrawn | **Redraw** | Same template, blue. <br>Redraw: As Charge. |
| <img src="../../art/wave-2/items/card-art/tier--storm.png" width="150" alt=""> | **Storm** <br>`card-art.tier.storm` <br>no rarity · earned season peak tier · withdrawn | **Redraw** | Same template, purple. <br>Redraw: As Charge. |
| <img src="../../art/wave-2/items/card-art/tier--lightning.png" width="150" alt=""> | **Lightning** <br>`card-art.tier.lightning` <br>no rarity · earned season peak tier · live | **Redraw** | Added by this audit: kept by the review, but the seven tier arts must be one set stepping up in finish; Lightning is the old flat template, so it is redrawn with its siblings. |
| <img src="../../art/wave-2/items/card-art/tier--top-500.png" width="150" alt=""> | **Top 500** <br>`card-art.tier.top-500` <br>no rarity · earned season peak tier · withdrawn | **Redraw** | The rarest card art is a washed-out beige; it looks less special than Lightning. <br>Redraw: The most prestigious art in the game: diamond-plate or prism finish, animated sheen, a crown mark. |
| <img src="../../art/wave-2/items/card-art/crimson.png" width="150" alt=""> | **Crimson** <br>`card-art.crimson` <br>Epic · Shop, 1,000 coins · live | **Redraw** | Added by this audit: kept by the review, but it is two flat red chevrons at 1,000 coins; beside the art kit's 3D finish it reads as a free starter. |
| <img src="../../art/wave-2/items/card-art/royal.png" width="150" alt=""> | **Royal** <br>`card-art.royal` <br>Epic · Shop, 1,000 coins · withdrawn | **Redraw** | The crown is a faint smudge behind the pill; at phone size it reads as a stain. <br>Redraw: A crisp gold crown outline and filigree border; keep the navy. |
| <img src="../../art/wave-2/items/card-art/emerald.png" width="150" alt=""> | **Emerald** <br>`card-art.emerald` <br>Epic · Shop, 1,000 coins · live | **Redraw** | Added by this audit: kept by the review, but a flat green panel with one diagonal at 1,000 coins; no depth, no light. |
| <img src="../../art/wave-2/items/card-art/sunset.png" width="150" alt=""> | **Sunset** <br>`card-art.sunset` <br>Epic · Shop, 1,000 coins · live | **Keep** | Clear synthwave sun and grid; strong at every size. |
| <img src="../../art/wave-2/items/card-art/galaxy.png" width="150" alt=""> | **Galaxy** <br>`card-art.galaxy` <br>Epic · Shop, 1,000 coins · live | **Keep** | Deep nebula with stars; good. |
| <img src="../../art/wave-2/items/card-art/lava.png" width="150" alt=""> | **Lava** <br>`card-art.lava` <br>Epic · Shop, 1,000 coins · withdrawn | **Redraw** | A flat orange gradient with two faint arcs; Epic at 1,000 coins but looks like a free starter. <br>Redraw: Molten cracks with an inner glow over dark rock, ember specks. |
| <img src="../../art/wave-2/items/card-art/neon-city.png" width="150" alt=""> | **Neon City** <br>`card-art.neon-city` <br>Elite · Shop, 1,600 coins · live | **Keep** | Skyline with lit windows; good, the name stays readable. |
| <img src="../../art/wave-2/items/card-art/gold-circuit.png" width="150" alt=""> | **Gold Circuit** <br>`card-art.gold-circuit` <br>Elite · Shop, 1,600 coins · live | **Keep** | Gold traces on black; premium and on brand. |
| <img src="../../art/wave-2/items/card-art/aurora.png" width="150" alt=""> | **Aurora** <br>`card-art.aurora` <br>Legendary · Shop, 2,800 coins · live | **Keep** | Legendary: animated aurora over mountains; clearly the best of the shop's card arts. |
| <img src="../../art/wave-2/items/card-art/diamond-plate.png" width="150" alt=""> | **Diamond Plate** <br>`card-art.diamond-plate` <br>Legendary · Shop, 2,800 coins · withdrawn | **Redraw** | Legendary, but the diamonds are clip-art stickers over a gold tread plate and crowd the right side. <br>Redraw: Fewer, faceted diamonds set into the plate with real highlights; a slow light sweep across the plate. |
| <img src="../../art/wave-2/items/card-art/frost.png" width="150" alt=""> | **Frost** <br>`card-art.frost` <br>Elite · Shop, 1,600 coins · withdrawn | **Redraw** | A snowflake is drawn through the player's name ('Sky*Racer') and the moon competes with it. <br>Redraw: Move the flakes and moon to the right third, away from the name; keep the mountains. |
| <img src="../../art/wave-2/items/card-art/neon-wave.png" width="150" alt=""> | **Neon Wave** <br>`card-art.neon-wave` <br>Rare · Pass free 32 · live | **Keep** | Free-track Rare: dotted neon waves, fine for its level. |
| <img src="../../art/wave-2/items/card-art/static.png" width="150" alt=""> | **Static** <br>`card-art.static` <br>Rare · Pass premium 14 · withdrawn | **Redraw** | Premium level 14 Rare, but it is near-black noise you barely see on a phone. <br>Redraw: Visible TV static bands with a scan line and a little colour bleed. |
| <img src="../../art/wave-2/items/card-art/grid-runner.png" width="150" alt=""> | **Grid Runner** <br>`card-art.grid-runner` <br>Epic · Pass premium 44 · live | **Keep** | Retro runner on a grid; good. |
| <img src="../../art/wave-2/items/card-art/neon-pulse.png" width="150" alt=""> | **Neon Pulse** <br>`card-art.neon-pulse` <br>Elite · Pass premium 10 · live | **Keep** | Heartbeat line and rings; clean and on theme. |
| <img src="../../art/wave-2/items/card-art/neon-skyline.png" width="150" alt=""> | **Neon Skyline** <br>`card-art.neon-skyline` <br>Legendary · Pass free 60 · withdrawn | **Redraw** | Legendary (free level 60): the buildings and lit windows run behind the name and title, which then read poorly. <br>Redraw: Keep the skyline to the right half or darken the left behind the name. |
| <img src="../../art/wave-2/items/card-art/neon-circuit.png" width="150" alt=""> | **Neon Circuit** <br>`card-art.neon-circuit` <br>Legendary · Pass premium 60 · live | **Keep** | Legendary: bold neon circuit and bolt; strong. |

## Frames (17)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../art/wave-2/items/frame/plain.png" width="150" alt=""> | **Plain** <br>`frame.plain` <br>no rarity · free starter · live | **Keep** | The default thin outline; correct for a default. |
| <img src="../../art/wave-2/items/frame/bronze.png" width="150" alt=""> | **Bronze** <br>`frame.bronze` <br>Common · Pass free 6 · withdrawn | **Redraw** | A plain orange line (Common, free level 6); nothing says 'bronze'. <br>Redraw: A metal bronze bevel with small corner studs. |
| <img src="../../art/wave-2/items/frame/silver.png" width="150" alt=""> | **Silver** <br>`frame.silver` <br>Rare · Pass free 26 · withdrawn | **Redraw** | A plain grey line (Rare, free level 26). <br>Redraw: A brushed-silver bevel with a light sweep at the corners. |
| <img src="../../art/wave-2/items/frame/gold.png" width="150" alt=""> | **Gold** <br>`frame.gold` <br>Epic · Shop, 1,000 coins · live | **Keep** | Ornate gold with corner brackets; reads premium. |
| <img src="../../art/wave-2/items/frame/obsidian.png" width="150" alt=""> | **Obsidian** <br>`frame.obsidian` <br>Elite · Shop, 1,600 coins · withdrawn | **Redraw** | Elite at 1,600, but the triangle corners look like folded paper and the violet edge is faint. <br>Redraw: A glossy black frame with a crisp violet edge light and faceted corners. |
| <img src="../../art/wave-2/items/frame/diamond.png" width="150" alt=""> | **Diamond** <br>`frame.diamond` <br>Legendary · Shop, 2,800 coins · live | **Keep** | Legendary: prism edge with diamond corners; strong. |
| <img src="../../art/wave-2/items/frame/founding.png" width="150" alt=""> | **Founding** <br>`frame.founding` <br>no rarity · earned founding player · withdrawn | **Redraw** | Earned; beautiful on the card, but on the 44 px nameplate strip the 'FOUNDER #0042' plaque is unreadable and the bolt tabs run into the score. <br>Redraw: A strip variant: no plaque text (or a small bolt mark) and nothing outside the strip's box. |
| <img src="../../art/wave-2/items/frame/top-500.png" width="150" alt=""> | **Top 500** <br>`frame.top-500` <br>no rarity · earned top 500 · withdrawn | **Redraw** | Earned, but its plaque shows the sample's fixed 'TOP 500 #214' (not the player's place), the crown is cut off at the top, and on the strip it covers the score. <br>Redraw: Draw the player's own place (or no number), keep the crown inside the card's box, and a strip variant that stays inside the name area. Nothing grants it yet. |
| <img src="../../art/wave-2/items/frame/neon-circuit.png" width="150" alt=""> | **Neon Circuit** <br>`frame.neon-circuit` <br>Elite · Pass premium 34 · live | **Keep** | Elite (premium level 34): animated neon tubes; strong. |
| (no art: draws the Plain frame) | **Championship** <br>`frame.championship` <br>no rarity · tournament · withdrawn | **Redraw** | PLACEHOLDER: no art at all; equipping it draws the Plain frame. <br>Redraw: Draw it (animated, the most prestigious frame) before any Championship is held; until then don't grant it. |
| <img src="../../art/wave-4/placeholders/frame/s1-spark.png" width="150" alt=""> | **Season 1 Spark** <br>`frame.s1-spark` <br>no rarity · earned season peak tier · withdrawn | **Redraw** | PLACEHOLDER art (a generated metal outline with a 'SEASON 1' tab); the tab is unreadable on the strip. <br>Redraw: Draw the seven Season 1 frames as a set, each with its tier's emblem; the tab hidden on the strip. |
| <img src="../../art/wave-4/placeholders/frame/s1-charge.png" width="150" alt=""> | **Season 1 Charge** <br>`frame.s1-charge` <br>no rarity · earned season peak tier · withdrawn | **Redraw** | PLACEHOLDER art. <br>Redraw: As Spark. |
| <img src="../../art/wave-4/placeholders/frame/s1-volt.png" width="150" alt=""> | **Season 1 Volt** <br>`frame.s1-volt` <br>no rarity · earned season peak tier · withdrawn | **Redraw** | PLACEHOLDER art. <br>Redraw: As Spark. |
| <img src="../../art/wave-4/placeholders/frame/s1-surge.png" width="150" alt=""> | **Season 1 Surge** <br>`frame.s1-surge` <br>no rarity · earned season peak tier · withdrawn | **Redraw** | PLACEHOLDER art. <br>Redraw: As Spark. |
| <img src="../../art/wave-4/placeholders/frame/s1-storm.png" width="150" alt=""> | **Season 1 Storm** <br>`frame.s1-storm` <br>no rarity · earned season peak tier · withdrawn | **Redraw** | PLACEHOLDER art. <br>Redraw: As Spark. |
| <img src="../../art/wave-4/placeholders/frame/s1-lightning.png" width="150" alt=""> | **Season 1 Lightning** <br>`frame.s1-lightning` <br>no rarity · earned season peak tier · withdrawn | **Redraw** | PLACEHOLDER art. <br>Redraw: As Spark. |
| <img src="../../art/wave-4/placeholders/frame/s1-top-500.png" width="150" alt=""> | **Season 1 Top 500** <br>`frame.s1-top-500` <br>no rarity · earned season peak tier · withdrawn | **Redraw** | PLACEHOLDER art. <br>Redraw: As Spark. |

## Name colours (11)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../art/wave-2/items/name-colour/gold-leaf.png" width="150" alt=""> | **Gold Leaf** <br>`name-colour.gold-leaf` <br>Epic · Shop, 1,000 coins · live | **Keep** | Metallic gold with a dark edge; premium. |
| <img src="../../art/wave-2/items/name-colour/chrome.png" width="150" alt=""> | **Chrome** <br>`name-colour.chrome` <br>Epic · Shop, 1,000 coins · withdrawn | **Redraw** | Epic at 1,000, but it reads as plain grey text at phone size. <br>Redraw: A real chrome gradient (bright top, dark band, bright bottom) with a white glint. |
| <img src="../../art/wave-2/items/name-colour/sapphire.png" width="150" alt=""> | **Sapphire** <br>`name-colour.sapphire` <br>Epic · Shop, 1,000 coins · live | **Keep** | Blue metal with a deep shadow; fine. |
| <img src="../../art/wave-2/items/name-colour/amethyst.png" width="150" alt=""> | **Amethyst** <br>`name-colour.amethyst` <br>Elite · Shop, 1,600 coins · live | **Keep** | Violet glow; fine. |
| <img src="../../art/wave-2/items/name-colour/emerald-glow.png" width="150" alt=""> | **Emerald Glow** <br>`name-colour.emerald-glow` <br>Elite · Shop, 1,600 coins · live | **Keep** | Green neon outline; good. |
| <img src="../../art/wave-2/items/name-colour/prism.png" width="150" alt=""> | **Prism** <br>`name-colour.prism` <br>Legendary · Shop, 2,800 coins · live | **Keep** | Legendary rainbow gradient (animated); strong. |
| <img src="../../art/wave-2/items/name-colour/neon-pink.png" width="150" alt=""> | **Neon Pink** <br>`name-colour.neon-pink` <br>Common · Pass free 10 · withdrawn | **Redraw** | Free level 10 Common: a flat pink fill, the same as a plain colour. <br>Redraw: A neon tube look: a light core with a pink glow, as Emerald Glow does. |
| <img src="../../art/wave-2/items/name-colour/neon-cyan.png" width="150" alt=""> | **Neon Cyan** <br>`name-colour.neon-cyan` <br>Rare · Pass premium 3 · withdrawn | **Redraw** | Premium level 3 Rare: a flat cyan fill. <br>Redraw: As Neon Pink: a glowing tube. |
| <img src="../../art/wave-2/items/name-colour/neon-red.png" width="150" alt=""> | **Neon Red** <br>`name-colour.neon-red` <br>Rare · Pass premium 18 · withdrawn | **Redraw** | Premium level 18 Rare: a flat red fill; red names also read as 'error'. <br>Redraw: A glowing tube in a warmer red-orange. |
| <img src="../../art/wave-2/items/name-colour/electric-orange.png" width="150" alt=""> | **Electric Orange** <br>`name-colour.electric-orange` <br>Epic · Pass premium 35 · withdrawn | **Redraw** | The pixel font (Silkscreen) becomes hard to read on the 44 px strip and long names lose letters. <br>Redraw: Keep the orange glow in the normal font, or keep pixels only on the full card. |
| <img src="../../art/wave-2/items/name-colour/neon-flux.png" width="150" alt=""> | **Neon Flux** <br>`name-colour.neon-flux` <br>Legendary · Pass premium 20 · live | **Keep** | Legendary: animated neon shift; strong. |

## Avatar finishes (7)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../art/wave-2/items/avatar-finish/chrome.png" width="150" alt=""> | **Chrome** <br>`avatar-finish.chrome` <br>Epic · Shop, 1,000 coins · withdrawn | **Redraw** | On the card the avatar is ~70 px and the finish changes a small helmet disc; Chrome, Pearl gem and Diamond gem look almost the same. <br>Redraw: A finish should change the whole avatar (body and scene) with a visible material: reflections for Chrome. |
| <img src="../../art/wave-2/items/avatar-finish/carbon.png" width="150" alt=""> | **Carbon** <br>`avatar-finish.carbon` <br>Epic · Shop, 1,000 coins · withdrawn | **Redraw** | Reads as 'dark avatar'; the weave is invisible at card size. <br>Redraw: A larger, higher-contrast weave and a red accent line. |
| <img src="../../art/wave-2/items/avatar-finish/comic-ink.png" width="150" alt=""> | **Comic Ink** <br>`avatar-finish.comic-ink` <br>Epic · Shop, 1,000 coins · live | **Keep** | Bold outline and halftone read even small; distinctive. |
| <img src="../../art/wave-2/items/avatar-finish/holographic.png" width="150" alt=""> | **Holographic** <br>`avatar-finish.holographic` <br>Elite · Shop, 1,600 coins · withdrawn | **Redraw** | Elite: a pastel tint, easily mistaken for a gem colour. <br>Redraw: A moving rainbow foil (still under Reduce Motion) across the whole avatar. |
| <img src="../../art/wave-2/items/avatar-finish/wireframe.png" width="150" alt=""> | **Wireframe** <br>`avatar-finish.wireframe` <br>Elite · Shop, 1,600 coins · live | **Keep** | Elite: cyan wireframe reads clearly and looks special. |
| <img src="../../art/wave-2/items/avatar-finish/lightning-core.png" width="150" alt=""> | **Lightning Core** <br>`avatar-finish.lightning-core` <br>Legendary · Shop, 2,800 coins · live | **Keep** | Legendary: ring and sparks; clearly the top finish. |
| <img src="../../art/wave-2/items/avatar-finish/neon-glow.png" width="150" alt=""> | **Neon Glow** <br>`avatar-finish.neon-glow` <br>Elite · Pass premium 40 · withdrawn | **Redraw** | Premium level 40: a pink glow round a small disc. <br>Redraw: A glow round the whole avatar silhouette, plus a neon rim. |

## Avatar accessory (1)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../art/wave-2/items/avatar-accessory/neon-bolt.png" width="150" alt=""> | **Neon Bolt** <br>`avatar-accessory.neon-bolt` <br>Epic · Pass premium 52 · withdrawn | **Redraw** | Premium level 52: a tiny bolt over the head; at card size it is a few pixels. <br>Redraw: Larger (within the avatar box), glowing, and drawn on every avatar shape the same way. |

## Avatar special edition (1)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../art/wave-2/items/avatar-special-edition/neon-captain-joulz.png" width="150" alt=""> | **Neon Captain Joulz** <br>`avatar-special-edition.neon-captain-joulz` <br>Elite · Pass premium 1 · live | **Keep** | Premium level 1 (the pass's headline): pink neon helmet; distinctive. |

## Reaction packs (9)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../art/wave-2/items/reaction/banter.png" width="150" alt=""> | **Banter** <br>`reaction.banter` <br>Epic · Shop, 1,000 coins · live | **Keep** | Four clear stickers; readable at chat size. |
| <img src="../../art/wave-2/items/reaction/retro-arcade.png" width="150" alt=""> | **Retro Arcade** <br>`reaction.retro-arcade` <br>Epic · Shop, 1,000 coins · withdrawn | **Redraw** | Epic at 1,000: four plain boxes with small pixel words ('GLHF' is hard to read). <br>Redraw: Fuller pixel stickers (coin, 1UP, heart) with colour and a pixel shadow. |
| <img src="../../art/wave-2/items/reaction/captains-calls.png" width="150" alt=""> | **Captain's Calls** <br>`reaction.captains-calls` <br>Epic · Shop, 1,000 coins · withdrawn | **Redraw** | Epic at 1,000: plain white speech bubbles with ~7 px text; the cheapest-looking pack. <br>Redraw: Captain Joulz himself in each sticker (the approved ready and win poses) with a short line. |
| <img src="../../art/wave-2/items/reaction/holo-stickers.png" width="150" alt=""> | **Holo Stickers** <br>`reaction.holo-stickers` <br>Elite · Shop, 1,600 coins · live | **Keep** | Elite: holographic stickers; good. |
| <img src="../../art/wave-2/items/reaction/spark.png" width="150" alt=""> | **Spark** <br>`reaction.spark` <br>Common · Pass free 22 · withdrawn | **Redraw** | Free level 22: a 'pack' of a single star. <br>Redraw: Two to four emotes per pack, or call it a single emote. |
| <img src="../../art/wave-2/items/reaction/zap.png" width="150" alt=""> | **Zap** <br>`reaction.zap` <br>Rare · Pass premium 8 · withdrawn | **Redraw** | Premium level 8: a single bolt. <br>Redraw: As Spark. |
| <img src="../../art/wave-2/items/reaction/clutch.png" width="150" alt=""> | **Clutch** <br>`reaction.clutch` <br>Rare · Pass premium 28 · withdrawn | **Redraw** | Premium level 28: one sticker. <br>Redraw: As Spark. |
| <img src="../../art/wave-2/items/reaction/neon-signs.png" width="150" alt=""> | **Neon Signs** <br>`reaction.neon-signs` <br>Epic · Pass premium 22 · withdrawn | **Redraw** | 'BRB CRYING' is unreadable at 34 px; the signs' text is thin. <br>Redraw: Shorter words and thicker neon strokes so each reads at chat size. |
| <img src="../../art/wave-2/items/reaction/live-wire.png" width="150" alt=""> | **Live Wire** <br>`reaction.live-wire` <br>Elite · Pass premium 49 · live | **Keep** | Elite: animated electric words; strong. |

## Celebrations (7)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../art/wave-2/items/celebration/confetti-pop.png" width="150" alt=""> | **Confetti Pop** <br>`celebration.confetti-pop` <br>Epic · Shop, 1,000 coins · live | **Keep** | Bright confetti; reads at once. |
| <img src="../../art/wave-2/items/celebration/spotlight.png" width="150" alt=""> | **Spotlight** <br>`celebration.spotlight` <br>Epic · Shop, 1,000 coins · withdrawn | **Redraw** | Epic at 1,000: two faint grey cones; most players won't notice it. <br>Redraw: Warm stage spotlights with dust in the beams and a sweep onto the winner. |
| <img src="../../art/wave-2/items/celebration/fireworks.png" width="150" alt=""> | **Fireworks** <br>`celebration.fireworks` <br>Elite · Shop, 1,600 coins · live | **Keep** | Elite: clear bursts; good. |
| <img src="../../art/wave-2/items/celebration/shockwave.png" width="150" alt=""> | **Shockwave** <br>`celebration.shockwave` <br>Elite · Shop, 1,600 coins · withdrawn | **Redraw** | Elite at 1,600: three thin rings; looks unfinished. <br>Redraw: A visible energy ring with distortion and sparks, in the brand gold. |
| <img src="../../art/wave-2/items/celebration/gold-rush.png" width="150" alt=""> | **Gold Rush** <br>`celebration.gold-rush` <br>Legendary · Shop, 2,800 coins · live | **Keep** | Legendary: coins and crown; strong. |
| <img src="../../art/wave-2/items/celebration/power-surge.png" width="150" alt=""> | **Power Surge** <br>`celebration.power-surge` <br>Legendary · Pass premium 30 · live | **Keep** | Legendary: lightning and stage glow; strong. |
| <img src="../../art/wave-2/items/celebration/circuit-overload.png" width="150" alt=""> | **Circuit Overload** <br>`celebration.circuit-overload` <br>Elite · Pass premium 58 · withdrawn | **Redraw** | Elite (premium level 58, the podium entrance): two flat lines; weak for the pass's late levels. <br>Redraw: Traces that light up along the podium with nodes flashing, ending in a burst. |

## Tile styles (6)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../art/wave-2/items/tile-style/brushed-gold.png" width="150" alt=""> | **Brushed Gold** <br>`tile-style.brushed-gold` <br>Epic · Shop, 1,000 coins · live | **Keep** | Gold border; clearly a paid look. |
| <img src="../../art/wave-2/items/tile-style/blueprint.png" width="150" alt=""> | **Blueprint** <br>`tile-style.blueprint` <br>Epic · Shop, 1,000 coins · live | **Keep** | Blue border and grid; distinctive. |
| <img src="../../art/wave-2/items/tile-style/obsidian-glass.png" width="150" alt=""> | **Obsidian Glass** <br>`tile-style.obsidian-glass` <br>Elite · Shop, 1,600 coins · live | **Keep** | Violet glass edge; good. |
| <img src="../../art/wave-2/items/tile-style/circuit-trace.png" width="150" alt=""> | **Circuit Trace** <br>`tile-style.circuit-trace` <br>Common · Pass free 16 · withdrawn | **Redraw** | Free level 16: almost identical to the plain tile. <br>Redraw: Visible traces across the tile's border. |
| <img src="../../art/wave-2/items/tile-style/neon-dots.png" width="150" alt=""> | **Neon Dots** <br>`tile-style.neon-dots` <br>Rare · Pass premium 38 · live | **Keep** | Pink neon dotted edge; fine. |
| <img src="../../art/wave-2/items/tile-style/neon-grid.png" width="150" alt=""> | **Neon Grid** <br>`tile-style.neon-grid` <br>Epic · Pass premium 7 · live | **Keep** | Cyan glow; fine. |

## Card backs (3)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../art/wave-2/items/card-back/royal-damask.png" width="150" alt=""> | **Royal Damask** <br>`card-back.royal-damask` <br>Epic · Shop, 1,000 coins · live (restored 13 Nov) | **Redraw** | A handsome back, but today it shows only in Full House (practice only since 1 Nov), on one small card. <br>Redraw: Show backs in more games (section 5) before selling it; the art itself can stay. |
| <img src="../../art/wave-2/items/card-back/holo-foil.png" width="150" alt=""> | **Holo Foil** <br>`card-back.holo-foil` <br>Elite · Shop, 1,600 coins · live (restored 13 Nov) | **Redraw** | Elite at 1,600: attractive, but seen only in Full House practice. <br>Redraw: As Royal Damask. |
| <img src="../../art/wave-2/items/card-back/neon.png" width="150" alt=""> | **Neon card back** <br>`card-back.neon` <br>Epic · Pass premium 4 · live (restored 13 Nov) | **Redraw** | Premium level 4: seen only in Full House practice. <br>Redraw: As Royal Damask. |

## Game skins (20)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../art/wave-2/items/game-skin/full-house--midnight-felt.png" width="150" alt=""> | **Midnight Felt** <br>`game-skin.full-house.midnight-felt` <br>Epic · Shop, 1,000 coins · withdrawn | **Redraw** | Full House is retired from rooms (practice only); a 1,000-coin table for a practice-only game. Joe, 13 Nov: stops being sold; owned felts stay usable. <br>Redraw: Leaves the Card Table bundle (README section 6: Proposal A puts the Aurora card art in its place). |
| <img src="../../art/wave-2/items/game-skin/full-house--crimson-velvet.png" width="150" alt=""> | **Crimson Velvet** <br>`game-skin.full-house.crimson-velvet` <br>Epic · Shop, 1,000 coins · withdrawn | **Redraw** | As Midnight Felt (Joe, 13 Nov: stops being sold; owned felts stay usable). <br>Redraw: As Midnight Felt. |
| <img src="../../art/wave-2/items/game-skin/full-house--neon-felt.png" width="150" alt=""> | **Neon felt** <br>`game-skin.full-house.neon-felt` <br>Epic · Pass premium 12 · withdrawn | **Redraw** | Premium pass level 12 for a practice-only game. <br>Redraw: Replace the pass level with a Five Hands or Summit look, or coins. |
| <img src="../../art/wave-2/items/game-skin/crazy-golf--watermelon.png" width="150" alt=""> | **Watermelon** <br>`game-skin.crazy-golf.watermelon` <br>Epic · Shop, 1,000 coins · withdrawn | **Redraw** | The ball is about 8 px across on a phone; the skin is barely visible during play. <br>Redraw: Show it where it can be seen: a larger ball draw is not allowed (nothing bigger), so add a short trail and a bigger skinned ball on the hole-in and the reveal. |
| <img src="../../art/wave-2/items/game-skin/crazy-golf--disco.png" width="150" alt=""> | **Disco** <br>`game-skin.crazy-golf.disco` <br>Epic · Shop, 1,000 coins · withdrawn | **Redraw** | As Watermelon: invisible at play size. <br>Redraw: As Watermelon. |
| <img src="../../art/wave-2/items/game-skin/crazy-golf--neon-glow.png" width="150" alt=""> | **Neon Glow** <br>`game-skin.crazy-golf.neon-glow` <br>Rare · Pass free 14 · withdrawn | **Redraw** | Free level 14: as Watermelon, though its glow helps a little. <br>Redraw: As Watermelon. |
| <img src="../../art/wave-2/items/game-skin/crazy-golf--plasma.png" width="150" alt=""> | **Plasma** <br>`game-skin.crazy-golf.plasma` <br>Epic · Pass premium 32 · withdrawn | **Redraw** | As Watermelon; the approved plasma glow is fainter than the art. <br>Redraw: Match the approved glow (section 4) and add the trail. |
| <img src="../../art/wave-2/items/game-skin/cue-ball--pixel-pool.png" width="150" alt=""> | **Pixel Pool** <br>`game-skin.cue-ball.pixel-pool` <br>Epic · Shop, 1,000 coins · withdrawn | **Redraw** | At play size the balls are ~16 px; the approved pixel digits read as smudges. <br>Redraw: Pixel digits drawn on whole device pixels (3 × 5) as the art shows; a pixel cue. |
| <img src="../../art/wave-2/items/game-skin/cue-ball--galaxy-set.png" width="150" alt=""> | **Galaxy Set** <br>`game-skin.cue-ball.galaxy-set` <br>Elite · Shop, 1,600 coins · withdrawn | **Redraw** | Elite at 1,600: at play size the nebula balls read as dark dots and the numbers vanish. <br>Redraw: Lighter nebula with brighter stars and a clear number disc; it must stay as legible as the default set. |
| <img src="../../art/wave-2/items/game-skin/cue-ball--neon-8-ball.png" width="150" alt=""> | **Neon 8-ball** <br>`game-skin.cue-ball.neon-8-ball` <br>Rare · Pass free 36 · withdrawn | **Redraw** | Free level 36: changes one ball; hardly noticed. <br>Redraw: Add the neon cue and a neon pocket flash when the 8 drops. |
| <img src="../../art/wave-2/items/game-skin/cue-ball--neon-ball-set.png" width="150" alt=""> | **Neon ball set** <br>`game-skin.cue-ball.neon-ball-set` <br>Epic · Pass premium 42 · withdrawn | **Redraw** | Rims show, but the approved glow is missing. <br>Redraw: The approved outer glow inside the ball's 2 px allowance (section 4). |
| <img src="../../art/wave-2/items/game-skin/top-bins--comet.png" width="150" alt=""> | **Comet** <br>`game-skin.top-bins.comet` <br>Epic · Shop, 1,000 coins · live | **Keep** | The ball sits large near the camera; the comet ball reads well. |
| <img src="../../art/wave-2/items/game-skin/top-bins--retro-leather.png" width="150" alt=""> | **Retro Leather** <br>`game-skin.top-bins.retro-leather` <br>Epic · Shop, 1,000 coins · live | **Keep** | A clear leather ball; good. |
| <img src="../../art/wave-2/items/game-skin/top-bins--neon-football.png" width="150" alt=""> | **Neon football** <br>`game-skin.top-bins.neon-football` <br>Epic · Pass premium 16 · live | **Keep** | Neon panels read; good. |
| <img src="../../art/wave-2/items/game-skin/apex--racing-stripes.png" width="150" alt=""> | **Racing Stripes** <br>`game-skin.apex.racing-stripes` <br>Epic · Shop, 1,000 coins · live | **Keep** | The car is large on screen; stripes read clearly. |
| <img src="../../art/wave-2/items/game-skin/apex--molten-gold.png" width="150" alt=""> | **Molten Gold** <br>`game-skin.apex.molten-gold` <br>Legendary · Shop, 2,800 coins · live | **Keep** | Legendary: gold car with shine; clearly premium. |
| <img src="../../art/wave-2/items/game-skin/apex--neon-paint.png" width="150" alt=""> | **Neon paint** <br>`game-skin.apex.neon-paint` <br>Epic · Pass premium 47 · live | **Keep** | Neon pink car; reads well. |
| <img src="../../art/wave-2/items/game-skin/curl-champ--glacier.png" width="150" alt=""> | **Glacier** <br>`game-skin.curl-champ.glacier` <br>Epic · Shop, 1,000 coins · withdrawn | **Redraw** | Only the player's own stone changes, and at the far end it is a few pixels; the handle the art shows is a flat bar. <br>Redraw: The approved handle shape (section 4) and a frosty trail while sliding. |
| <img src="../../art/wave-2/items/game-skin/curl-champ--aurora.png" width="150" alt=""> | **Aurora** <br>`game-skin.curl-champ.aurora` <br>Elite · Shop, 1,600 coins · withdrawn | **Redraw** | As Glacier; the aurora swirl on the stone top is lost at play size. <br>Redraw: As Glacier, with a stronger aurora band. |
| <img src="../../art/wave-2/items/game-skin/curl-champ--neon-stones.png" width="150" alt=""> | **Neon stones** <br>`game-skin.curl-champ.neon-stones` <br>Epic · Pass premium 25 · withdrawn | **Redraw** | As Glacier. <br>Redraw: As Glacier, with the approved neon handle. |

## World themes (4)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../art/wave-2/items/world-theme/apex--neon-night.png" width="150" alt=""> | **Apex: Neon Night** <br>`world-theme.apex.neon-night` <br>Legendary · Pass premium 45 · withdrawn | **Redraw** | Legendary: the night circuit looks good, but the approved chasing kerbs and pulsing lights are slower and dimmer than the art. <br>Redraw: Match the approved motion (section 4). |
| <img src="../../art/wave-2/items/world-theme/crazy-golf--neon-course.png" width="150" alt=""> | **Crazy Golf: Neon Course** <br>`world-theme.crazy-golf.neon-course` <br>Legendary · Pass free 50 · withdrawn | **Redraw** | Legendary (free level 50): strong, but the windmill's neon sails are flat compared with the art. <br>Redraw: The approved sails (section 4). |
| <img src="../../art/wave-2/items/world-theme/curl-champ--neon-rink.png" width="150" alt=""> | **Curl Champ: Neon Rink** <br>`world-theme.curl-champ.neon-rink` <br>Elite · Pass premium 24 · withdrawn | **Redraw** | Elite: dark ice with pink lines; plain next to the other three themes. <br>Redraw: Ice with a faint reflected neon city, glowing house rings that pulse once when a stone stops. |
| <img src="../../art/wave-2/items/world-theme/cue-ball--neon-table.png" width="150" alt=""> | **Cue Ball: Neon Table** <br>`world-theme.cue-ball.neon-table` <br>Elite · Pass premium 54 · live | **Keep** | Elite: a convincing neon table; strong. |

# Beyond the catalogue

## Avatars (32)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../art/avatars/svg/captain-joulz.svg" width="64" alt=""> | **Captain Joulz** `avatar.captain-joulz` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/gemstone.svg" width="64" alt=""> | **Gemstone** `avatar.gemstone` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/hover.svg" width="64" alt=""> | **Hover** `avatar.hover` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/apex.svg" width="64" alt=""> | **Apex** `avatar.apex` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/pinball.svg" width="64" alt=""> | **Pinball** `avatar.pinball` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/crazy-golf.svg" width="64" alt=""> | **Crazy Golf** `avatar.crazy-golf` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/iron-wall.svg" width="64" alt=""> | **Iron Wall** `avatar.iron-wall` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/wavefront.svg" width="64" alt=""> | **Wavefront** `avatar.wavefront` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/breaker.svg" width="64" alt=""> | **Breaker** `avatar.breaker` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/fission.svg" width="64" alt=""> | **Fission** `avatar.fission` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/tempo.svg" width="64" alt=""> | **Tempo** `avatar.tempo` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/nucleus.svg" width="64" alt=""> | **Nucleus** `avatar.nucleus` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/blackout.svg" width="64" alt=""> | **Blackout** `avatar.blackout` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/hanoi.svg" width="64" alt=""> | **Hanoi** `avatar.hanoi` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/polypotions.svg" width="64" alt=""> | **Polypotions** `avatar.polypotions` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/safe-cracker.svg" width="64" alt=""> | **Safe Cracker** `avatar.safe-cracker` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/coral-pop.svg" width="64" alt=""> | **Coral Pop** `avatar.coral-pop` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/swish.svg" width="64" alt=""> | **Swish** `avatar.swish` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/flightpath.svg" width="64" alt=""> | **Flightpath** `avatar.flightpath` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/home-run.svg" width="64" alt=""> | **Home Run** `avatar.home-run` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/cue-ball.svg" width="64" alt=""> | **Cue Ball** `avatar.cue-ball` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/blockzone.svg" width="64" alt=""> | **Blockzone** `avatar.blockzone` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/spacewalk.svg" width="64" alt=""> | **Spacewalk** `avatar.spacewalk` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/meteor.svg" width="64" alt=""> | **Meteor** `avatar.meteor` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/moon-climb.svg" width="64" alt=""> | **Moon Climb** `avatar.moon-climb` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/curl-champ.svg" width="64" alt=""> | **Curl Champ** `avatar.curl-champ` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/top-bins.svg" width="64" alt=""> | **Top Bins** `avatar.top-bins` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/lightbender.svg" width="64" alt=""> | **Lightbender** `avatar.lightbender` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/cryptogrid.svg" width="64" alt=""> | **Cryptogrid** `avatar.cryptogrid` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/high-rise.svg" width="64" alt=""> | **High Rise** `avatar.high-rise` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/rainbow-bridge.svg" width="64" alt=""> | **Rainbow Bridge** `avatar.rainbow-bridge` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |
| <img src="../../art/avatars/svg/orbit.svg" width="64" alt=""> | **Orbit** `avatar.orbit` · free | **Keep** | Approved wave 1 avatar art; every player's base look, kept. Flat vector line art rather than the kit's 3D (see “For Joe” in the gallery). |

## Gems (10)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../art/avatars/svg/gem-example-amber.svg" width="64" alt=""> | **Amber** · unlocked by stars | **Keep** | A three-stop jewel tint on the avatar's main colour; reads as metal and stone at card size. |
| <img src="../../art/avatars/svg/gem-example-rose-quartz.svg" width="64" alt=""> | **Rose Quartz** · unlocked by stars | **Keep** | A three-stop jewel tint on the avatar's main colour; reads as metal and stone at card size. |
| <img src="../../art/avatars/svg/gem-example-ruby.svg" width="64" alt=""> | **Ruby** · unlocked by stars | **Keep** | A three-stop jewel tint on the avatar's main colour; reads as metal and stone at card size. |
| <img src="../../art/avatars/svg/gem-example-jade.svg" width="64" alt=""> | **Jade** · unlocked by stars | **Keep** | A three-stop jewel tint on the avatar's main colour; reads as metal and stone at card size. |
| <img src="../../art/avatars/svg/gem-example-amethyst.svg" width="64" alt=""> | **Amethyst** · unlocked by stars | **Keep** | A three-stop jewel tint on the avatar's main colour; reads as metal and stone at card size. |
| <img src="../../art/avatars/svg/gem-example-aquamarine.svg" width="64" alt=""> | **Aquamarine** · unlocked by stars | **Keep** | A three-stop jewel tint on the avatar's main colour; reads as metal and stone at card size. |
| <img src="../../art/avatars/svg/gem-example-sapphire.svg" width="64" alt=""> | **Sapphire** · unlocked by stars | **Keep** | A three-stop jewel tint on the avatar's main colour; reads as metal and stone at card size. |
| <img src="../../art/avatars/svg/gem-example-pearl.svg" width="64" alt=""> | **Pearl** · unlocked by stars | **Keep** | A three-stop jewel tint on the avatar's main colour; reads as metal and stone at card size. |
| <img src="../../art/avatars/svg/gem-example-obsidian.svg" width="64" alt=""> | **Obsidian** · unlocked by stars | **Keep** | A three-stop jewel tint on the avatar's main colour; reads as metal and stone at card size. |
| <img src="../../art/avatars/svg/gem-example-diamond.svg" width="64" alt=""> | **Diamond** · unlocked by stars | **Keep** | A three-stop jewel tint on the avatar's main colour; reads as metal and stone at card size. |

## Badges (54)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../../public/art/badges/first-win.svg" width="48" alt=""> | **First Win** `first-win` · common | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/placed.svg" width="48" alt=""> | **Placed** `placed` · common | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/hot-streak.svg" width="48" alt=""> | **Hot Streak** `hot-streak` · rare | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/comeback-kid.svg" width="48" alt=""> | **Comeback Kid** `comeback-kid` · rare | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/clean-sweep.svg" width="48" alt=""> | **Clean Sweep** `clean-sweep` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/podium-regular.svg" width="48" alt=""> | **Podium Regular** `podium-regular` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/unstoppable.svg" width="48" alt=""> | **Unstoppable** `unstoppable` · elite | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/giant-slayer.svg" width="48" alt=""> | **Giant Slayer** `giant-slayer` · elite | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/storm-chaser.svg" width="48" alt=""> | **Storm Chaser** `storm-chaser` · elite | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/lightning-strikes.svg" width="48" alt=""> | **Lightning Strikes** `lightning-strikes` · legendary | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/top-500.svg" width="48" alt=""> | **Top 500** `top-500` · legendary | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/first-star.svg" width="48" alt=""> | **First Star** `first-star` · common | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/flawless.svg" width="48" alt=""> | **Flawless** `flawless` · rare | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/all-rounder.svg" width="48" alt=""> | **All-Rounder** `all-rounder` · rare | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/logic-master.svg" width="48" alt=""> | **Logic Master** `logic-master` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/word-master.svg" width="48" alt=""> | **Word Master** `word-master` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/number-master.svg" width="48" alt=""> | **Number Master** `number-master` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/pattern-master.svg" width="48" alt=""> | **Pattern Master** `pattern-master` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/speed-master.svg" width="48" alt=""> | **Speed Master** `speed-master` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/attention-master.svg" width="48" alt=""> | **Attention Master** `attention-master` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/action-master.svg" width="48" alt=""> | **Action Master** `action-master` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/retro-master.svg" width="48" alt=""> | **Retro Master** `retro-master` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/sports-master.svg" width="48" alt=""> | **Sports Master** `sports-master` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/cards-master.svg" width="48" alt=""> | **Cards Master** `cards-master` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/strategy-master.svg" width="48" alt=""> | **Strategy Master** `strategy-master` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/perfectionist.svg" width="48" alt=""> | **Perfectionist** `perfectionist` · elite | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/grand-master.svg" width="48" alt=""> | **Grand Master** `grand-master` · legendary | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/daily-habit.svg" width="48" alt=""> | **Daily Habit** `daily-habit` · common | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/dedicated.svg" width="48" alt=""> | **Dedicated** `dedicated` · rare | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/daily-top-100.svg" width="48" alt=""> | **Daily Top 100** `daily-top-100` · rare | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/century.svg" width="48" alt=""> | **Century** `century` · elite | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/daily-champion.svg" width="48" alt=""> | **Daily Champion** `daily-champion` · legendary | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/entrant.svg" width="48" alt=""> | **Entrant** `entrant` · common | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/trophy-hunter.svg" width="48" alt=""> | **Trophy Hunter** `trophy-hunter` · rare | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/arena-ace.svg" width="48" alt=""> | **Arena Ace** `arena-ace` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/champion.svg" width="48" alt=""> | **Champion** `champion` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/arena-champion.svg" width="48" alt=""> | **Arena Champion** `arena-champion` · elite | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/score-attack-champion.svg" width="48" alt=""> | **Score Attack Champion** `score-attack-champion` · elite | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/swiss-champion.svg" width="48" alt=""> | **Swiss Champion** `swiss-champion` · elite | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/knockout-champion.svg" width="48" alt=""> | **Knockout Champion** `knockout-champion` · legendary | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/serial-winner.svg" width="48" alt=""> | **Serial Winner** `serial-winner` · legendary | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/challenger.svg" width="48" alt=""> | **Challenger** `challenger` · common | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/challenge-seeker.svg" width="48" alt=""> | **Challenge Seeker** `challenge-seeker` · rare | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/challenge-expert.svg" width="48" alt=""> | **Challenge Expert** `challenge-expert` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/category-clear.svg" width="48" alt=""> | **Category Clear** `category-clear` · elite | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/completionist.svg" width="48" alt=""> | **Completionist** `completionist` · legendary | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/revenge.svg" width="48" alt=""> | **Revenge** `revenge` · common | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/photo-finish.svg" width="48" alt=""> | **Photo Finish** `photo-finish` · rare | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/buzzer-beater.svg" width="48" alt=""> | **Buzzer Beater** `buzzer-beater` · rare | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/speed-demon.svg" width="48" alt=""> | **Speed Demon** `speed-demon` · epic | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/friendly.svg" width="48" alt=""> | **Friendly** `friendly` · common | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/party-host.svg" width="48" alt=""> | **Party Host** `party-host` · rare | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/gem-hunter.svg" width="48" alt=""> | **Gem Hunter** `gem-hunter` · rare | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |
| <img src="../../../public/art/badges/founding-player.svg" width="48" alt=""> | **Founding Player** `founding-player` · legendary | **Keep** | Approved reward art (design foundation F5, docs/art/README.md): metal, inks and glow from the tokens. |

## Trophies, medals and tier emblems (15)

| | Item | Verdict | Why |
|---|---|---|---|
| <img src="../../art/svg/trophy-bronze.svg" width="56" alt=""> | **Bronze trophy** | **Keep** | Approved reward art (F5), drawn in the metals the redraws match. |
| <img src="../../art/svg/trophy-silver.svg" width="56" alt=""> | **Silver trophy** | **Keep** | Approved reward art (F5), drawn in the metals the redraws match. |
| <img src="../../art/svg/trophy-gold.svg" width="56" alt=""> | **Gold trophy** | **Keep** | Approved reward art (F5), drawn in the metals the redraws match. |
| <img src="../../art/svg/trophy-championship.svg" width="56" alt=""> | **Championship trophy** | **Keep** | Approved reward art (F5), drawn in the metals the redraws match. |
| <img src="../../art/svg/medal-gold.svg" width="56" alt=""> | **Gold medal** | **Keep** | Approved reward art (F5), drawn in the metals the redraws match. |
| <img src="../../art/svg/medal-silver.svg" width="56" alt=""> | **Silver medal** | **Keep** | Approved reward art (F5), drawn in the metals the redraws match. |
| <img src="../../art/svg/medal-bronze.svg" width="56" alt=""> | **Bronze medal** | **Keep** | Approved reward art (F5), drawn in the metals the redraws match. |
| <img src="../../art/svg/emblem-spark.svg" width="56" alt=""> | **Spark emblem** | **Keep** | Approved reward art (F5), drawn in the metals the redraws match. |
| <img src="../../art/svg/emblem-charge.svg" width="56" alt=""> | **Charge emblem** | **Keep** | Approved reward art (F5), drawn in the metals the redraws match. |
| <img src="../../art/svg/emblem-volt.svg" width="56" alt=""> | **Volt emblem** | **Keep** | Approved reward art (F5), drawn in the metals the redraws match. |
| <img src="../../art/svg/emblem-surge.svg" width="56" alt=""> | **Surge emblem** | **Keep** | Approved reward art (F5), drawn in the metals the redraws match. |
| <img src="../../art/svg/emblem-storm.svg" width="56" alt=""> | **Storm emblem** | **Keep** | Approved reward art (F5), drawn in the metals the redraws match. |
| <img src="../../art/svg/emblem-lightning.svg" width="56" alt=""> | **Lightning emblem** | **Keep** | Approved reward art (F5), drawn in the metals the redraws match. |
| <img src="../../../public/art/emblems/top-500.svg" width="56" alt=""> | **Top 500 emblem** | **Keep** | Approved (mockup 03, W3a's tier). |
| <img src="../../art/svg/emblem-storm.svg" width="56" alt=""> | **Season 1 emblem** (`SeasonEmblem`: the tier emblem with its S1 mark) | **Keep** | The tier emblems above with a season mark; nothing of its own to redraw. |

## Titles (41)

Text only (the card's title line in `--jz-gold`): **Keep**. They are words, not art; the card's own type carries them.
