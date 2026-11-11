# Joulz wave 2 art

Every wave 2 item drawn and approved on the design canvas ("Joulz – competitive layer", https://claude.ai/artifact/FqDe2Zbfk6nNAYyF6gsWjL), cut out one file per item for the wave 2 build sessions. Exported 10 November 2026. The economy design doc and the master plan are the source of truth for amounts and rules; this folder is the source of truth for how each item looks.

## What's here

| Path | What it is |
|---|---|
| `catalogue.json` | One record per item (110): id, name, kind, game, rarity, source, pass level, shop price, bundle, animated, exclusive, finish notes, file paths. Use it to seed the item catalogue table. |
| `items/<kind>/<name>.png` | A still of the item at 2x, as it looks under Reduce Motion. |
| `items/<kind>/<name>.html` | The item's exact source (SVG and CSS, as drawn on the canvas). Open it in a browser to see its motion; motion stops under `prefers-reduced-motion`. Uses the Archivo and Silkscreen fonts from Google Fonts. |
| `boards/` | Full-board pictures of the five art boards (card art and frames, game skins, world themes, avatar finishes/reactions/celebrations/tiles, Joulz Plus screens). |
| `screens/` | The wave 2 screen mockups: Practice with challenges, Friends (FR1–FR4), Profile, Customise (C1–C3), Shop, Battle pass. |

The 32 game avatars and the 54 badges are packaged separately (`docs/art/avatars/`, `docs/art/badges/`).

## Counts (checked against the economy design doc)

- **Shop: 52 items** (30 Epic at 1,000 coins, 15 Elite at 1,600, 7 Legendary at 2,800). Common and Rare are never sold.
- **Season 1 "Neon Circuit" pass: 40 items**, exclusive forever (never in the shop, never after Season 1). Free track 10 (4 Common, 4 Rare, 2 Legendary); premium track 30 (6 Rare, 12 Epic, 8 Elite, 4 Legendary). Every pass level below matches the economy doc's pass tables.
- **Free and earned: 18.** 8 free card arts and the Plain frame for everyone; 7 card arts earned by season peak tier; the Founding and Top 500 frames.

## Rules the build must keep

- **Rarity ladder:** Common bronze, Rare silver, Epic gold, Elite obsidian (violet edge), Legendary diamond-plated. Rare plain, Epic a step up, Elite emphatic, Legendary bold and colourful.
- **Every Legendary animates, and all motion stops under Reduce Motion** (the `.html` sources already carry the `prefers-reduced-motion` rules). Live Wire and the Neon Circuit frame (both Elite) also animate.
- **Never in the shop rotation:** anything with a source other than `shop` (pass items, free, earned). Badges, titles and gem colours are never sold.
- **Game skins, card backs and world themes never touch fairness:** same sizes, hit areas, motion and physics as the original; same contrast check against the game background; one replay test per skinned game proves every skin and world theme scores identically.
- **Card text:** the tier and rating sit in a dark pill on every card art; every name colour keeps a dark edge so it reads on any art; cosmetics never sit behind scores or places in standings.
- The sample player on every card (SkyRacer, Logician, Storm II, 2,046) is placeholder content, not part of the item.

## Open points

- **Neon Circuit frame (premium level 34) animates (decided 10 Nov):** every 4.2 s a violet-pink-white sheen sweeps across the frame's neon tubes only (masked, never over the card art or text), and each circuit node flashes as the sheen passes. Under Reduce Motion the sheen is hidden and the nodes stay still, leaving the frame exactly as drawn.
- **Bronze and Silver frames** show only their rarity on the canvas; their pass levels (free 6 and 26) come from the economy doc.
- **Frost** card art (Elite) is sold as part of the Frozen Lake bundle with the Glacier and Aurora stones, and counts as one of the 52 shop items, so it also appears in the daily rotation.


## Card arts (32)

| Name | ID | Rarity | Source | Pass level | Shop price (coins) | Notes | Files |
|---|---|---|---|---|---|---|---|
| Joulz Navy | `card-art.joulz-navy` | – | Free for everyone | – | – |  | [png](items/card-art/joulz-navy.png) · [html](items/card-art/joulz-navy.html) |
| Bolt Stripes | `card-art.bolt-stripes` | – | Free for everyone | – | – |  | [png](items/card-art/bolt-stripes.png) · [html](items/card-art/bolt-stripes.html) |
| Grid | `card-art.grid` | – | Free for everyone | – | – |  | [png](items/card-art/grid.png) · [html](items/card-art/grid.html) |
| Waves | `card-art.waves` | – | Free for everyone | – | – |  | [png](items/card-art/waves.png) · [html](items/card-art/waves.html) |
| Hexes | `card-art.hexes` | – | Free for everyone | – | – |  | [png](items/card-art/hexes.png) · [html](items/card-art/hexes.html) |
| Circuit | `card-art.circuit` | – | Free for everyone | – | – |  | [png](items/card-art/circuit.png) · [html](items/card-art/circuit.html) |
| Dots | `card-art.dots` | – | Free for everyone | – | – |  | [png](items/card-art/dots.png) · [html](items/card-art/dots.html) |
| Sunburst | `card-art.sunburst` | – | Free for everyone | – | – |  | [png](items/card-art/sunburst.png) · [html](items/card-art/sunburst.html) |
| Spark | `card-art.tier.spark` | – | Earned: season peak tier | – | – |  | [png](items/card-art/tier--spark.png) · [html](items/card-art/tier--spark.html) |
| Charge | `card-art.tier.charge` | – | Earned: season peak tier | – | – |  | [png](items/card-art/tier--charge.png) · [html](items/card-art/tier--charge.html) |
| Volt | `card-art.tier.volt` | – | Earned: season peak tier | – | – |  | [png](items/card-art/tier--volt.png) · [html](items/card-art/tier--volt.html) |
| Surge | `card-art.tier.surge` | – | Earned: season peak tier | – | – |  | [png](items/card-art/tier--surge.png) · [html](items/card-art/tier--surge.html) |
| Storm | `card-art.tier.storm` | – | Earned: season peak tier | – | – |  | [png](items/card-art/tier--storm.png) · [html](items/card-art/tier--storm.html) |
| Lightning | `card-art.tier.lightning` | – | Earned: season peak tier | – | – |  | [png](items/card-art/tier--lightning.png) · [html](items/card-art/tier--lightning.html) |
| Top 500 | `card-art.tier.top-500` | – | Earned: season peak tier | – | – |  | [png](items/card-art/tier--top-500.png) · [html](items/card-art/tier--top-500.html) |
| Crimson | `card-art.crimson` | Epic | Shop | – | 1,000 |  | [png](items/card-art/crimson.png) · [html](items/card-art/crimson.html) |
| Royal | `card-art.royal` | Epic | Shop | – | 1,000 |  | [png](items/card-art/royal.png) · [html](items/card-art/royal.html) |
| Emerald | `card-art.emerald` | Epic | Shop | – | 1,000 |  | [png](items/card-art/emerald.png) · [html](items/card-art/emerald.html) |
| Sunset | `card-art.sunset` | Epic | Shop | – | 1,000 |  | [png](items/card-art/sunset.png) · [html](items/card-art/sunset.html) |
| Galaxy | `card-art.galaxy` | Epic | Shop | – | 1,000 |  | [png](items/card-art/galaxy.png) · [html](items/card-art/galaxy.html) |
| Lava | `card-art.lava` | Epic | Shop | – | 1,000 |  | [png](items/card-art/lava.png) · [html](items/card-art/lava.html) |
| Neon City | `card-art.neon-city` | Elite | Shop | – | 1,600 |  | [png](items/card-art/neon-city.png) · [html](items/card-art/neon-city.html) |
| Gold Circuit | `card-art.gold-circuit` | Elite | Shop | – | 1,600 |  | [png](items/card-art/gold-circuit.png) · [html](items/card-art/gold-circuit.html) |
| Aurora | `card-art.aurora` | Legendary | Shop | – | 2,800 | animated | [png](items/card-art/aurora.png) · [html](items/card-art/aurora.html) |
| Diamond Plate | `card-art.diamond-plate` | Legendary | Shop | – | 2,800 | animated | [png](items/card-art/diamond-plate.png) · [html](items/card-art/diamond-plate.html) |
| Frost | `card-art.frost` | Elite | Shop | – | 1,600 | Frozen Lake bundle | [png](items/card-art/frost.png) · [html](items/card-art/frost.html) |
| Neon Wave | `card-art.neon-wave` | Rare | Pass, free track | 32 | – |  | [png](items/card-art/neon-wave.png) · [html](items/card-art/neon-wave.html) |
| Neon Skyline | `card-art.neon-skyline` | Legendary | Pass, free track | 60 | – | animated | [png](items/card-art/neon-skyline.png) · [html](items/card-art/neon-skyline.html) |
| Neon Pulse | `card-art.neon-pulse` | Elite | Pass, premium track | 10 | – |  | [png](items/card-art/neon-pulse.png) · [html](items/card-art/neon-pulse.html) |
| Static | `card-art.static` | Rare | Pass, premium track | 14 | – |  | [png](items/card-art/static.png) · [html](items/card-art/static.html) |
| Grid Runner | `card-art.grid-runner` | Epic | Pass, premium track | 44 | – |  | [png](items/card-art/grid-runner.png) · [html](items/card-art/grid-runner.html) |
| Neon Circuit | `card-art.neon-circuit` | Legendary | Pass, premium track | 60 | – | animated | [png](items/card-art/neon-circuit.png) · [html](items/card-art/neon-circuit.html) |

## Frames (9)

| Name | ID | Rarity | Source | Pass level | Shop price (coins) | Notes | Files |
|---|---|---|---|---|---|---|---|
| Plain | `frame.plain` | – | Free for everyone | – | – |  | [png](items/frame/plain.png) · [html](items/frame/plain.html) |
| Gold | `frame.gold` | Epic | Shop | – | 1,000 | art deco | [png](items/frame/gold.png) · [html](items/frame/gold.html) |
| Obsidian | `frame.obsidian` | Elite | Shop | – | 1,600 |  | [png](items/frame/obsidian.png) · [html](items/frame/obsidian.html) |
| Diamond | `frame.diamond` | Legendary | Shop | – | 2,800 | animated | [png](items/frame/diamond.png) · [html](items/frame/diamond.html) |
| Bronze | `frame.bronze` | Common | Pass, free track | 6 | – |  | [png](items/frame/bronze.png) · [html](items/frame/bronze.html) |
| Silver | `frame.silver` | Rare | Pass, free track | 26 | – |  | [png](items/frame/silver.png) · [html](items/frame/silver.html) |
| Neon Circuit | `frame.neon-circuit` | Elite | Pass, premium track | 34 | – | animated | [png](items/frame/neon-circuit.png) · [html](items/frame/neon-circuit.html) |
| Founding | `frame.founding` | – | Earned: Founding Player | – | – | animated | [png](items/frame/founding.png) · [html](items/frame/founding.html) |
| Top 500 | `frame.top-500` | – | Earned: Top 500 | – | – | animated | [png](items/frame/top-500.png) · [html](items/frame/top-500.html) |

## Name colours (11)

| Name | ID | Rarity | Source | Pass level | Shop price (coins) | Notes | Files |
|---|---|---|---|---|---|---|---|
| Gold Leaf | `name-colour.gold-leaf` | Epic | Shop | – | 1,000 |  | [png](items/name-colour/gold-leaf.png) · [html](items/name-colour/gold-leaf.html) |
| Chrome | `name-colour.chrome` | Epic | Shop | – | 1,000 |  | [png](items/name-colour/chrome.png) · [html](items/name-colour/chrome.html) |
| Sapphire | `name-colour.sapphire` | Epic | Shop | – | 1,000 | retro sticker | [png](items/name-colour/sapphire.png) · [html](items/name-colour/sapphire.html) |
| Amethyst | `name-colour.amethyst` | Elite | Shop | – | 1,600 | halftone | [png](items/name-colour/amethyst.png) · [html](items/name-colour/amethyst.html) |
| Emerald Glow | `name-colour.emerald-glow` | Elite | Shop | – | 1,600 | neon tube | [png](items/name-colour/emerald-glow.png) · [html](items/name-colour/emerald-glow.html) |
| Prism | `name-colour.prism` | Legendary | Shop | – | 2,800 | animated; animated | [png](items/name-colour/prism.png) · [html](items/name-colour/prism.html) |
| Neon Pink | `name-colour.neon-pink` | Common | Pass, free track | 10 | – |  | [png](items/name-colour/neon-pink.png) · [html](items/name-colour/neon-pink.html) |
| Neon Cyan | `name-colour.neon-cyan` | Rare | Pass, premium track | 3 | – |  | [png](items/name-colour/neon-cyan.png) · [html](items/name-colour/neon-cyan.html) |
| Neon Red | `name-colour.neon-red` | Rare | Pass, premium track | 18 | – |  | [png](items/name-colour/neon-red.png) · [html](items/name-colour/neon-red.html) |
| Neon Flux | `name-colour.neon-flux` | Legendary | Pass, premium track | 20 | – | animated | [png](items/name-colour/neon-flux.png) · [html](items/name-colour/neon-flux.html) |
| Electric Orange | `name-colour.electric-orange` | Epic | Pass, premium track | 35 | – | pixel | [png](items/name-colour/electric-orange.png) · [html](items/name-colour/electric-orange.html) |

## Special-edition avatar (1)

| Name | ID | Rarity | Source | Pass level | Shop price (coins) | Notes | Files |
|---|---|---|---|---|---|---|---|
| Neon Captain Joulz | `avatar-special-edition.neon-captain-joulz` | Elite | Pass, premium track | 1 | – | special-edition helmet | [png](items/avatar-special-edition/neon-captain-joulz.png) · [html](items/avatar-special-edition/neon-captain-joulz.html) |

## Avatar finishes (7)

| Name | ID | Rarity | Source | Pass level | Shop price (coins) | Notes | Files |
|---|---|---|---|---|---|---|---|
| Chrome | `avatar-finish.chrome` | Epic | Shop | – | 1,000 | mirror metal | [png](items/avatar-finish/chrome.png) · [html](items/avatar-finish/chrome.html) |
| Carbon | `avatar-finish.carbon` | Epic | Shop | – | 1,000 | carbon weave | [png](items/avatar-finish/carbon.png) · [html](items/avatar-finish/carbon.html) |
| Comic Ink | `avatar-finish.comic-ink` | Epic | Shop | – | 1,000 | halftone and ink outline | [png](items/avatar-finish/comic-ink.png) · [html](items/avatar-finish/comic-ink.html) |
| Holographic | `avatar-finish.holographic` | Elite | Shop | – | 1,600 | foil sheen | [png](items/avatar-finish/holographic.png) · [html](items/avatar-finish/holographic.html) |
| Wireframe | `avatar-finish.wireframe` | Elite | Shop | – | 1,600 | glowing outline grid | [png](items/avatar-finish/wireframe.png) · [html](items/avatar-finish/wireframe.html) |
| Lightning Core | `avatar-finish.lightning-core` | Legendary | Shop | – | 2,800 | animated; animated: glowing core, crackling arcs | [png](items/avatar-finish/lightning-core.png) · [html](items/avatar-finish/lightning-core.html) |
| Neon Glow | `avatar-finish.neon-glow` | Elite | Pass, premium track | 40 | – | glow finish | [png](items/avatar-finish/neon-glow.png) · [html](items/avatar-finish/neon-glow.html) |

## Avatar accessory (1)

| Name | ID | Rarity | Source | Pass level | Shop price (coins) | Notes | Files |
|---|---|---|---|---|---|---|---|
| Neon Bolt | `avatar-accessory.neon-bolt` | Epic | Pass, premium track | 52 | – | accessory | [png](items/avatar-accessory/neon-bolt.png) · [html](items/avatar-accessory/neon-bolt.html) |

## Reactions (9)

| Name | ID | Rarity | Source | Pass level | Shop price (coins) | Notes | Files |
|---|---|---|---|---|---|---|---|
| Banter | `reaction.banter` | Epic | Shop | – | 1,000 | die-cut stickers, 4 emotes | [png](items/reaction/banter.png) · [html](items/reaction/banter.html) |
| Retro Arcade | `reaction.retro-arcade` | Epic | Shop | – | 1,000 | 8-bit, 4 emotes | [png](items/reaction/retro-arcade.png) · [html](items/reaction/retro-arcade.html) |
| Captain's Calls | `reaction.captains-calls` | Epic | Shop | – | 1,000 | speech bubbles, 4 emotes | [png](items/reaction/captains-calls.png) · [html](items/reaction/captains-calls.html) |
| Holo Stickers | `reaction.holo-stickers` | Elite | Shop | – | 1,600 | holographic foil, 4 emotes | [png](items/reaction/holo-stickers.png) · [html](items/reaction/holo-stickers.html) |
| Spark | `reaction.spark` | Common | Pass, free track | 22 | – | single emote: a happy spark | [png](items/reaction/spark.png) · [html](items/reaction/spark.html) |
| Zap | `reaction.zap` | Rare | Pass, premium track | 8 | – | single emote: a determined bolt | [png](items/reaction/zap.png) · [html](items/reaction/zap.html) |
| Neon Signs | `reaction.neon-signs` | Epic | Pass, premium track | 22 | – | neon tube words, 4 emotes | [png](items/reaction/neon-signs.png) · [html](items/reaction/neon-signs.html) |
| Clutch | `reaction.clutch` | Rare | Pass, premium track | 28 | – | single emote | [png](items/reaction/clutch.png) · [html](items/reaction/clutch.html) |
| Live Wire | `reaction.live-wire` | Elite | Pass, premium track | 49 | – | animated; animated, electric, 4 emotes | [png](items/reaction/live-wire.png) · [html](items/reaction/live-wire.html) |

## Celebrations (7)

| Name | ID | Rarity | Source | Pass level | Shop price (coins) | Notes | Files |
|---|---|---|---|---|---|---|---|
| Confetti Pop | `celebration.confetti-pop` | Epic | Shop | – | 1,000 |  | [png](items/celebration/confetti-pop.png) · [html](items/celebration/confetti-pop.html) |
| Spotlight | `celebration.spotlight` | Epic | Shop | – | 1,000 |  | [png](items/celebration/spotlight.png) · [html](items/celebration/spotlight.html) |
| Fireworks | `celebration.fireworks` | Elite | Shop | – | 1,600 |  | [png](items/celebration/fireworks.png) · [html](items/celebration/fireworks.html) |
| Shockwave | `celebration.shockwave` | Elite | Shop | – | 1,600 |  | [png](items/celebration/shockwave.png) · [html](items/celebration/shockwave.html) |
| Gold Rush | `celebration.gold-rush` | Legendary | Shop | – | 2,800 | animated; animated: coins rain, crown glows | [png](items/celebration/gold-rush.png) · [html](items/celebration/gold-rush.html) |
| Power Surge | `celebration.power-surge` | Legendary | Pass, premium track | 30 | – | animated; animated: lightning strikes the podium | [png](items/celebration/power-surge.png) · [html](items/celebration/power-surge.html) |
| Circuit Overload | `celebration.circuit-overload` | Elite | Pass, premium track | 58 | – | podium entrance | [png](items/celebration/circuit-overload.png) · [html](items/celebration/circuit-overload.html) |

## Tile styles (6)

| Name | ID | Rarity | Source | Pass level | Shop price (coins) | Notes | Files |
|---|---|---|---|---|---|---|---|
| Brushed Gold | `tile-style.brushed-gold` | Epic | Shop | – | 1,000 |  | [png](items/tile-style/brushed-gold.png) · [html](items/tile-style/brushed-gold.html) |
| Blueprint | `tile-style.blueprint` | Epic | Shop | – | 1,000 |  | [png](items/tile-style/blueprint.png) · [html](items/tile-style/blueprint.html) |
| Obsidian Glass | `tile-style.obsidian-glass` | Elite | Shop | – | 1,600 |  | [png](items/tile-style/obsidian-glass.png) · [html](items/tile-style/obsidian-glass.html) |
| Circuit Trace | `tile-style.circuit-trace` | Common | Pass, free track | 16 | – |  | [png](items/tile-style/circuit-trace.png) · [html](items/tile-style/circuit-trace.html) |
| Neon Grid | `tile-style.neon-grid` | Epic | Pass, premium track | 7 | – |  | [png](items/tile-style/neon-grid.png) · [html](items/tile-style/neon-grid.html) |
| Neon Dots | `tile-style.neon-dots` | Rare | Pass, premium track | 38 | – |  | [png](items/tile-style/neon-dots.png) · [html](items/tile-style/neon-dots.html) |

## Game skins (20)

| Name | ID | Rarity | Source | Pass level | Shop price (coins) | Notes | Files |
|---|---|---|---|---|---|---|---|
| Racing Stripes | `game-skin.apex.racing-stripes` | Epic | Shop | – | 1,000 | Apex | [png](items/game-skin/apex--racing-stripes.png) · [html](items/game-skin/apex--racing-stripes.html) |
| Molten Gold | `game-skin.apex.molten-gold` | Legendary | Shop | – | 2,800 | Apex; animated; animated shine | [png](items/game-skin/apex--molten-gold.png) · [html](items/game-skin/apex--molten-gold.html) |
| Neon paint | `game-skin.apex.neon-paint` | Epic | Pass, premium track | 47 | – | Apex | [png](items/game-skin/apex--neon-paint.png) · [html](items/game-skin/apex--neon-paint.html) |
| Watermelon | `game-skin.crazy-golf.watermelon` | Epic | Shop | – | 1,000 | Crazy Golf | [png](items/game-skin/crazy-golf--watermelon.png) · [html](items/game-skin/crazy-golf--watermelon.html) |
| Disco | `game-skin.crazy-golf.disco` | Epic | Shop | – | 1,000 | Crazy Golf; mirror tiles | [png](items/game-skin/crazy-golf--disco.png) · [html](items/game-skin/crazy-golf--disco.html) |
| Neon Glow | `game-skin.crazy-golf.neon-glow` | Rare | Pass, free track | 14 | – | Crazy Golf | [png](items/game-skin/crazy-golf--neon-glow.png) · [html](items/game-skin/crazy-golf--neon-glow.html) |
| Plasma | `game-skin.crazy-golf.plasma` | Epic | Pass, premium track | 32 | – | Crazy Golf | [png](items/game-skin/crazy-golf--plasma.png) · [html](items/game-skin/crazy-golf--plasma.html) |
| Pixel Pool | `game-skin.cue-ball.pixel-pool` | Epic | Shop | – | 1,000 | Cue Ball; 8-bit | [png](items/game-skin/cue-ball--pixel-pool.png) · [html](items/game-skin/cue-ball--pixel-pool.html) |
| Galaxy Set | `game-skin.cue-ball.galaxy-set` | Elite | Shop | – | 1,600 | Cue Ball | [png](items/game-skin/cue-ball--galaxy-set.png) · [html](items/game-skin/cue-ball--galaxy-set.html) |
| Neon 8-ball | `game-skin.cue-ball.neon-8-ball` | Rare | Pass, free track | 36 | – | Cue Ball | [png](items/game-skin/cue-ball--neon-8-ball.png) · [html](items/game-skin/cue-ball--neon-8-ball.html) |
| Neon ball set | `game-skin.cue-ball.neon-ball-set` | Epic | Pass, premium track | 42 | – | Cue Ball | [png](items/game-skin/cue-ball--neon-ball-set.png) · [html](items/game-skin/cue-ball--neon-ball-set.html) |
| Glacier | `game-skin.curl-champ.glacier` | Epic | Shop | – | 1,000 | Curl Champ; Frozen Lake bundle | [png](items/game-skin/curl-champ--glacier.png) · [html](items/game-skin/curl-champ--glacier.html) |
| Aurora | `game-skin.curl-champ.aurora` | Elite | Shop | – | 1,600 | Curl Champ; Frozen Lake bundle | [png](items/game-skin/curl-champ--aurora.png) · [html](items/game-skin/curl-champ--aurora.html) |
| Neon stones | `game-skin.curl-champ.neon-stones` | Epic | Pass, premium track | 25 | – | Curl Champ | [png](items/game-skin/curl-champ--neon-stones.png) · [html](items/game-skin/curl-champ--neon-stones.html) |
| Midnight Felt | `game-skin.full-house.midnight-felt` | Epic | Shop | – | 1,000 | Full House | [png](items/game-skin/full-house--midnight-felt.png) · [html](items/game-skin/full-house--midnight-felt.html) |
| Crimson Velvet | `game-skin.full-house.crimson-velvet` | Epic | Shop | – | 1,000 | Full House | [png](items/game-skin/full-house--crimson-velvet.png) · [html](items/game-skin/full-house--crimson-velvet.html) |
| Neon felt | `game-skin.full-house.neon-felt` | Epic | Pass, premium track | 12 | – | Full House | [png](items/game-skin/full-house--neon-felt.png) · [html](items/game-skin/full-house--neon-felt.html) |
| Comet | `game-skin.top-bins.comet` | Epic | Shop | – | 1,000 | Top Bins | [png](items/game-skin/top-bins--comet.png) · [html](items/game-skin/top-bins--comet.html) |
| Retro Leather | `game-skin.top-bins.retro-leather` | Epic | Shop | – | 1,000 | Top Bins | [png](items/game-skin/top-bins--retro-leather.png) · [html](items/game-skin/top-bins--retro-leather.html) |
| Neon football | `game-skin.top-bins.neon-football` | Epic | Pass, premium track | 16 | – | Top Bins | [png](items/game-skin/top-bins--neon-football.png) · [html](items/game-skin/top-bins--neon-football.html) |

## Card backs (3)

One `card-back` slot for the account, not a game's skin (Joe's decision, 11 Nov 2026): drawn on Full House's face-down
deck (the strip behind Next card, and the whole back while the next card is dragged). Drawn first as Free Cell items
(`game-skin.free-cell.*`, items/game-skin/free-cell--*), but a Free Cell deal is all face up, so they moved here; the
board picture (`boards/game-skins.png`) still shows them under Free Cell. The rename migration is
`supabase/migrations/20261112090000_card_back_slot.sql`; the old ids can never be inserted again.

| Name | ID | Rarity | Source | Pass level | Shop price (coins) | Notes | Files |
|---|---|---|---|---|---|---|---|
| Royal Damask | `card-back.royal-damask` | Epic | Shop | – | 1,000 | art deco | [png](items/card-back/royal-damask.png) · [html](items/card-back/royal-damask.html) |
| Holo Foil | `card-back.holo-foil` | Elite | Shop | – | 1,600 | holographic | [png](items/card-back/holo-foil.png) · [html](items/card-back/holo-foil.html) |
| Neon card back | `card-back.neon` | Epic | Pass, premium track | 4 | – |  | [png](items/card-back/neon.png) · [html](items/card-back/neon.html) |

## World themes (4)

| Name | ID | Rarity | Source | Pass level | Shop price (coins) | Notes | Files |
|---|---|---|---|---|---|---|---|
| Crazy Golf: Neon Course | `world-theme.crazy-golf.neon-course` | Legendary | Pass, free track | 50 | – | animated; Black-light mini golf: glowing green edges, a neon windmill that turns, a pulsing cup. | [png](items/world-theme/crazy-golf--neon-course.png) · [html](items/world-theme/crazy-golf--neon-course.html) |
| Curl Champ: Neon Rink | `world-theme.curl-champ.neon-rink` | Elite | Pass, premium track | 24 | – | Dark ice with neon rings, glowing hog line and lit-up stones. | [png](items/world-theme/curl-champ--neon-rink.png) · [html](items/world-theme/curl-champ--neon-rink.html) |
| Apex: Neon Night | `world-theme.apex.neon-night` | Legendary | Pass, premium track | 45 | – | animated; A night circuit under a neon city: kerbs chase in cyan and pink, grandstand lights glow, stars twinkle. | [png](items/world-theme/apex--neon-night.png) · [html](items/world-theme/apex--neon-night.html) |
| Cue Ball: Neon Table | `world-theme.cue-ball.neon-table` | Elite | Pass, premium track | 54 | – | A black table with a faint grid, neon rails and glowing pockets. | [png](items/world-theme/cue-ball--neon-table.png) · [html](items/world-theme/cue-ball--neon-table.html) |
