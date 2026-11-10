-- The item catalogue (Wave 2, train A, session A1; 10 Nov 2026; docs/economy/README.md). Written by
-- scripts/economy-catalogue-sql.ts from docs/art/wave-2/catalogue.json (version 1, generated 2026-11-10): its
-- 110 items verbatim, never typed by hand. Additive and idempotent: it inserts catalogue rows that aren't there yet
-- (ON CONFLICT DO NOTHING), then gives every existing account its wallet, loadout and starter items (the free card
-- arts and the Plain frame), and adds the avatar builder's options from docs/art/avatars/. No existing row is changed.
--
-- Mapping: rarity lower-cased (none for free and earned items); price_coins from shop_price_coins; exclusive = not
-- from the shop; exclusive_forever and note (finish_or_note) as given; game_type from the game's display name
-- (src/lib/economy/slots.ts GAME_TYPE_BY_NAME); slot from the kind (src/lib/economy/slots.ts itemSlot).

INSERT INTO public.catalogue_items
  (id, name, kind, slot, game, game_type, rarity, source, pass_level, price_coins, bundle, animated, exclusive,
   exclusive_forever, note, png_path, html_path, sort_order)
SELECT e ->> 'id',
       e ->> 'name',
       e ->> 'kind',
       CASE e ->> 'kind'
         WHEN 'game-skin' THEN 'game-skin:' || g.game_type
         WHEN 'world-theme' THEN 'world-theme:' || g.game_type
         WHEN 'celebration' THEN CASE WHEN e ->> 'finish_or_note' = 'podium entrance' THEN 'podium-entrance' ELSE 'celebration' END
         ELSE e ->> 'kind' END,
       e ->> 'game',
       g.game_type,
       lower(e ->> 'rarity'),
       e ->> 'source',
       (e ->> 'pass_level')::smallint,
       (e ->> 'shop_price_coins')::integer,
       e ->> 'bundle',
       (e ->> 'animated')::boolean,
       e ->> 'source' <> 'shop',
       coalesce((e ->> 'exclusive_forever')::boolean, false),
       e ->> 'finish_or_note',
       e ->> 'png',
       e ->> 'html',
       x.ord::integer
  FROM jsonb_array_elements($catalogue$[
{"id":"card-art.joulz-navy","name":"Joulz Navy","kind":"card-art","game":null,"rarity":null,"source":"free-starter","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/joulz-navy.png","html":"items/card-art/joulz-navy.html"},
{"id":"card-art.bolt-stripes","name":"Bolt Stripes","kind":"card-art","game":null,"rarity":null,"source":"free-starter","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/bolt-stripes.png","html":"items/card-art/bolt-stripes.html"},
{"id":"card-art.grid","name":"Grid","kind":"card-art","game":null,"rarity":null,"source":"free-starter","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/grid.png","html":"items/card-art/grid.html"},
{"id":"card-art.waves","name":"Waves","kind":"card-art","game":null,"rarity":null,"source":"free-starter","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/waves.png","html":"items/card-art/waves.html"},
{"id":"card-art.hexes","name":"Hexes","kind":"card-art","game":null,"rarity":null,"source":"free-starter","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/hexes.png","html":"items/card-art/hexes.html"},
{"id":"card-art.circuit","name":"Circuit","kind":"card-art","game":null,"rarity":null,"source":"free-starter","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/circuit.png","html":"items/card-art/circuit.html"},
{"id":"card-art.dots","name":"Dots","kind":"card-art","game":null,"rarity":null,"source":"free-starter","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/dots.png","html":"items/card-art/dots.html"},
{"id":"card-art.sunburst","name":"Sunburst","kind":"card-art","game":null,"rarity":null,"source":"free-starter","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/sunburst.png","html":"items/card-art/sunburst.html"},
{"id":"card-art.tier.spark","name":"Spark","kind":"card-art","game":null,"rarity":null,"source":"earned-season-peak-tier","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/card-art/tier--spark.png","html":"items/card-art/tier--spark.html"},
{"id":"card-art.tier.charge","name":"Charge","kind":"card-art","game":null,"rarity":null,"source":"earned-season-peak-tier","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/card-art/tier--charge.png","html":"items/card-art/tier--charge.html"},
{"id":"card-art.tier.volt","name":"Volt","kind":"card-art","game":null,"rarity":null,"source":"earned-season-peak-tier","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/card-art/tier--volt.png","html":"items/card-art/tier--volt.html"},
{"id":"card-art.tier.surge","name":"Surge","kind":"card-art","game":null,"rarity":null,"source":"earned-season-peak-tier","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/card-art/tier--surge.png","html":"items/card-art/tier--surge.html"},
{"id":"card-art.tier.storm","name":"Storm","kind":"card-art","game":null,"rarity":null,"source":"earned-season-peak-tier","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/card-art/tier--storm.png","html":"items/card-art/tier--storm.html"},
{"id":"card-art.tier.lightning","name":"Lightning","kind":"card-art","game":null,"rarity":null,"source":"earned-season-peak-tier","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/card-art/tier--lightning.png","html":"items/card-art/tier--lightning.html"},
{"id":"card-art.tier.top-500","name":"Top 500","kind":"card-art","game":null,"rarity":null,"source":"earned-season-peak-tier","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/card-art/tier--top-500.png","html":"items/card-art/tier--top-500.html"},
{"id":"card-art.crimson","name":"Crimson","kind":"card-art","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/crimson.png","html":"items/card-art/crimson.html"},
{"id":"card-art.royal","name":"Royal","kind":"card-art","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/royal.png","html":"items/card-art/royal.html"},
{"id":"card-art.emerald","name":"Emerald","kind":"card-art","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/emerald.png","html":"items/card-art/emerald.html"},
{"id":"card-art.sunset","name":"Sunset","kind":"card-art","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/sunset.png","html":"items/card-art/sunset.html"},
{"id":"card-art.galaxy","name":"Galaxy","kind":"card-art","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/galaxy.png","html":"items/card-art/galaxy.html"},
{"id":"card-art.lava","name":"Lava","kind":"card-art","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/lava.png","html":"items/card-art/lava.html"},
{"id":"card-art.neon-city","name":"Neon City","kind":"card-art","game":null,"rarity":"Elite","source":"shop","pass_level":null,"shop_price_coins":1600,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/neon-city.png","html":"items/card-art/neon-city.html"},
{"id":"card-art.gold-circuit","name":"Gold Circuit","kind":"card-art","game":null,"rarity":"Elite","source":"shop","pass_level":null,"shop_price_coins":1600,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/gold-circuit.png","html":"items/card-art/gold-circuit.html"},
{"id":"card-art.aurora","name":"Aurora","kind":"card-art","game":null,"rarity":"Legendary","source":"shop","pass_level":null,"shop_price_coins":2800,"bundle":null,"animated":true,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/aurora.png","html":"items/card-art/aurora.html"},
{"id":"card-art.diamond-plate","name":"Diamond Plate","kind":"card-art","game":null,"rarity":"Legendary","source":"shop","pass_level":null,"shop_price_coins":2800,"bundle":null,"animated":true,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/diamond-plate.png","html":"items/card-art/diamond-plate.html"},
{"id":"card-art.frost","name":"Frost","kind":"card-art","game":null,"rarity":"Elite","source":"shop","pass_level":null,"shop_price_coins":1600,"bundle":"Frozen Lake","animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/card-art/frost.png","html":"items/card-art/frost.html"},
{"id":"card-art.neon-wave","name":"Neon Wave","kind":"card-art","game":null,"rarity":"Rare","source":"pass-free","pass_level":32,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/card-art/neon-wave.png","html":"items/card-art/neon-wave.html"},
{"id":"card-art.static","name":"Static","kind":"card-art","game":null,"rarity":"Rare","source":"pass-premium","pass_level":14,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/card-art/static.png","html":"items/card-art/static.html"},
{"id":"card-art.grid-runner","name":"Grid Runner","kind":"card-art","game":null,"rarity":"Epic","source":"pass-premium","pass_level":44,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/card-art/grid-runner.png","html":"items/card-art/grid-runner.html"},
{"id":"card-art.neon-pulse","name":"Neon Pulse","kind":"card-art","game":null,"rarity":"Elite","source":"pass-premium","pass_level":10,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/card-art/neon-pulse.png","html":"items/card-art/neon-pulse.html"},
{"id":"card-art.neon-skyline","name":"Neon Skyline","kind":"card-art","game":null,"rarity":"Legendary","source":"pass-free","pass_level":60,"shop_price_coins":null,"bundle":null,"animated":true,"exclusive_forever":true,"finish_or_note":null,"png":"items/card-art/neon-skyline.png","html":"items/card-art/neon-skyline.html"},
{"id":"card-art.neon-circuit","name":"Neon Circuit","kind":"card-art","game":null,"rarity":"Legendary","source":"pass-premium","pass_level":60,"shop_price_coins":null,"bundle":null,"animated":true,"exclusive_forever":true,"finish_or_note":null,"png":"items/card-art/neon-circuit.png","html":"items/card-art/neon-circuit.html"},
{"id":"frame.plain","name":"Plain","kind":"frame","game":null,"rarity":null,"source":"free-starter","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/frame/plain.png","html":"items/frame/plain.html"},
{"id":"frame.bronze","name":"Bronze","kind":"frame","game":null,"rarity":"Common","source":"pass-free","pass_level":6,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/frame/bronze.png","html":"items/frame/bronze.html"},
{"id":"frame.silver","name":"Silver","kind":"frame","game":null,"rarity":"Rare","source":"pass-free","pass_level":26,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/frame/silver.png","html":"items/frame/silver.html"},
{"id":"frame.gold","name":"Gold","kind":"frame","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"art deco","png":"items/frame/gold.png","html":"items/frame/gold.html"},
{"id":"frame.obsidian","name":"Obsidian","kind":"frame","game":null,"rarity":"Elite","source":"shop","pass_level":null,"shop_price_coins":1600,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/frame/obsidian.png","html":"items/frame/obsidian.html"},
{"id":"frame.diamond","name":"Diamond","kind":"frame","game":null,"rarity":"Legendary","source":"shop","pass_level":null,"shop_price_coins":2800,"bundle":null,"animated":true,"exclusive_forever":false,"finish_or_note":null,"png":"items/frame/diamond.png","html":"items/frame/diamond.html"},
{"id":"frame.founding","name":"Founding","kind":"frame","game":null,"rarity":null,"source":"earned-founding-player","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":true,"exclusive_forever":true,"finish_or_note":null,"png":"items/frame/founding.png","html":"items/frame/founding.html"},
{"id":"frame.top-500","name":"Top 500","kind":"frame","game":null,"rarity":null,"source":"earned-top-500","pass_level":null,"shop_price_coins":null,"bundle":null,"animated":true,"exclusive_forever":true,"finish_or_note":null,"png":"items/frame/top-500.png","html":"items/frame/top-500.html"},
{"id":"frame.neon-circuit","name":"Neon Circuit","kind":"frame","game":null,"rarity":"Elite","source":"pass-premium","pass_level":34,"shop_price_coins":null,"bundle":null,"animated":true,"exclusive_forever":true,"finish_or_note":null,"png":"items/frame/neon-circuit.png","html":"items/frame/neon-circuit.html"},
{"id":"name-colour.gold-leaf","name":"Gold Leaf","kind":"name-colour","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/name-colour/gold-leaf.png","html":"items/name-colour/gold-leaf.html"},
{"id":"name-colour.chrome","name":"Chrome","kind":"name-colour","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/name-colour/chrome.png","html":"items/name-colour/chrome.html"},
{"id":"name-colour.sapphire","name":"Sapphire","kind":"name-colour","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"retro sticker","png":"items/name-colour/sapphire.png","html":"items/name-colour/sapphire.html"},
{"id":"name-colour.amethyst","name":"Amethyst","kind":"name-colour","game":null,"rarity":"Elite","source":"shop","pass_level":null,"shop_price_coins":1600,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"halftone","png":"items/name-colour/amethyst.png","html":"items/name-colour/amethyst.html"},
{"id":"name-colour.emerald-glow","name":"Emerald Glow","kind":"name-colour","game":null,"rarity":"Elite","source":"shop","pass_level":null,"shop_price_coins":1600,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"neon tube","png":"items/name-colour/emerald-glow.png","html":"items/name-colour/emerald-glow.html"},
{"id":"name-colour.prism","name":"Prism","kind":"name-colour","game":null,"rarity":"Legendary","source":"shop","pass_level":null,"shop_price_coins":2800,"bundle":null,"animated":true,"exclusive_forever":false,"finish_or_note":"animated","png":"items/name-colour/prism.png","html":"items/name-colour/prism.html"},
{"id":"name-colour.neon-pink","name":"Neon Pink","kind":"name-colour","game":null,"rarity":"Common","source":"pass-free","pass_level":10,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/name-colour/neon-pink.png","html":"items/name-colour/neon-pink.html"},
{"id":"name-colour.neon-cyan","name":"Neon Cyan","kind":"name-colour","game":null,"rarity":"Rare","source":"pass-premium","pass_level":3,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/name-colour/neon-cyan.png","html":"items/name-colour/neon-cyan.html"},
{"id":"name-colour.neon-red","name":"Neon Red","kind":"name-colour","game":null,"rarity":"Rare","source":"pass-premium","pass_level":18,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/name-colour/neon-red.png","html":"items/name-colour/neon-red.html"},
{"id":"name-colour.electric-orange","name":"Electric Orange","kind":"name-colour","game":null,"rarity":"Epic","source":"pass-premium","pass_level":35,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":"pixel","png":"items/name-colour/electric-orange.png","html":"items/name-colour/electric-orange.html"},
{"id":"name-colour.neon-flux","name":"Neon Flux","kind":"name-colour","game":null,"rarity":"Legendary","source":"pass-premium","pass_level":20,"shop_price_coins":null,"bundle":null,"animated":true,"exclusive_forever":true,"finish_or_note":null,"png":"items/name-colour/neon-flux.png","html":"items/name-colour/neon-flux.html"},
{"id":"game-skin.free-cell.royal-damask","name":"Royal Damask","kind":"game-skin","game":"Free Cell","rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"art deco","png":"items/game-skin/free-cell--royal-damask.png","html":"items/game-skin/free-cell--royal-damask.html"},
{"id":"game-skin.free-cell.holo-foil","name":"Holo Foil","kind":"game-skin","game":"Free Cell","rarity":"Elite","source":"shop","pass_level":null,"shop_price_coins":1600,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"holographic","png":"items/game-skin/free-cell--holo-foil.png","html":"items/game-skin/free-cell--holo-foil.html"},
{"id":"game-skin.free-cell.neon-card-back","name":"Neon card back","kind":"game-skin","game":"Free Cell","rarity":"Epic","source":"pass-premium","pass_level":4,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/game-skin/free-cell--neon-card-back.png","html":"items/game-skin/free-cell--neon-card-back.html"},
{"id":"game-skin.full-house.midnight-felt","name":"Midnight Felt","kind":"game-skin","game":"Full House","rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/game-skin/full-house--midnight-felt.png","html":"items/game-skin/full-house--midnight-felt.html"},
{"id":"game-skin.full-house.crimson-velvet","name":"Crimson Velvet","kind":"game-skin","game":"Full House","rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/game-skin/full-house--crimson-velvet.png","html":"items/game-skin/full-house--crimson-velvet.html"},
{"id":"game-skin.full-house.neon-felt","name":"Neon felt","kind":"game-skin","game":"Full House","rarity":"Epic","source":"pass-premium","pass_level":12,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/game-skin/full-house--neon-felt.png","html":"items/game-skin/full-house--neon-felt.html"},
{"id":"game-skin.crazy-golf.watermelon","name":"Watermelon","kind":"game-skin","game":"Crazy Golf","rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/game-skin/crazy-golf--watermelon.png","html":"items/game-skin/crazy-golf--watermelon.html"},
{"id":"game-skin.crazy-golf.disco","name":"Disco","kind":"game-skin","game":"Crazy Golf","rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"mirror tiles","png":"items/game-skin/crazy-golf--disco.png","html":"items/game-skin/crazy-golf--disco.html"},
{"id":"game-skin.crazy-golf.neon-glow","name":"Neon Glow","kind":"game-skin","game":"Crazy Golf","rarity":"Rare","source":"pass-free","pass_level":14,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/game-skin/crazy-golf--neon-glow.png","html":"items/game-skin/crazy-golf--neon-glow.html"},
{"id":"game-skin.crazy-golf.plasma","name":"Plasma","kind":"game-skin","game":"Crazy Golf","rarity":"Epic","source":"pass-premium","pass_level":32,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/game-skin/crazy-golf--plasma.png","html":"items/game-skin/crazy-golf--plasma.html"},
{"id":"game-skin.cue-ball.pixel-pool","name":"Pixel Pool","kind":"game-skin","game":"Cue Ball","rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"8-bit","png":"items/game-skin/cue-ball--pixel-pool.png","html":"items/game-skin/cue-ball--pixel-pool.html"},
{"id":"game-skin.cue-ball.galaxy-set","name":"Galaxy Set","kind":"game-skin","game":"Cue Ball","rarity":"Elite","source":"shop","pass_level":null,"shop_price_coins":1600,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/game-skin/cue-ball--galaxy-set.png","html":"items/game-skin/cue-ball--galaxy-set.html"},
{"id":"game-skin.cue-ball.neon-8-ball","name":"Neon 8-ball","kind":"game-skin","game":"Cue Ball","rarity":"Rare","source":"pass-free","pass_level":36,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/game-skin/cue-ball--neon-8-ball.png","html":"items/game-skin/cue-ball--neon-8-ball.html"},
{"id":"game-skin.cue-ball.neon-ball-set","name":"Neon ball set","kind":"game-skin","game":"Cue Ball","rarity":"Epic","source":"pass-premium","pass_level":42,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/game-skin/cue-ball--neon-ball-set.png","html":"items/game-skin/cue-ball--neon-ball-set.html"},
{"id":"game-skin.top-bins.comet","name":"Comet","kind":"game-skin","game":"Top Bins","rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/game-skin/top-bins--comet.png","html":"items/game-skin/top-bins--comet.html"},
{"id":"game-skin.top-bins.retro-leather","name":"Retro Leather","kind":"game-skin","game":"Top Bins","rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/game-skin/top-bins--retro-leather.png","html":"items/game-skin/top-bins--retro-leather.html"},
{"id":"game-skin.top-bins.neon-football","name":"Neon football","kind":"game-skin","game":"Top Bins","rarity":"Epic","source":"pass-premium","pass_level":16,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/game-skin/top-bins--neon-football.png","html":"items/game-skin/top-bins--neon-football.html"},
{"id":"game-skin.apex.racing-stripes","name":"Racing Stripes","kind":"game-skin","game":"Apex","rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/game-skin/apex--racing-stripes.png","html":"items/game-skin/apex--racing-stripes.html"},
{"id":"game-skin.apex.molten-gold","name":"Molten Gold","kind":"game-skin","game":"Apex","rarity":"Legendary","source":"shop","pass_level":null,"shop_price_coins":2800,"bundle":null,"animated":true,"exclusive_forever":false,"finish_or_note":"animated shine","png":"items/game-skin/apex--molten-gold.png","html":"items/game-skin/apex--molten-gold.html"},
{"id":"game-skin.apex.neon-paint","name":"Neon paint","kind":"game-skin","game":"Apex","rarity":"Epic","source":"pass-premium","pass_level":47,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/game-skin/apex--neon-paint.png","html":"items/game-skin/apex--neon-paint.html"},
{"id":"game-skin.curl-champ.glacier","name":"Glacier","kind":"game-skin","game":"Curl Champ","rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":"Frozen Lake","animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/game-skin/curl-champ--glacier.png","html":"items/game-skin/curl-champ--glacier.html"},
{"id":"game-skin.curl-champ.aurora","name":"Aurora","kind":"game-skin","game":"Curl Champ","rarity":"Elite","source":"shop","pass_level":null,"shop_price_coins":1600,"bundle":"Frozen Lake","animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/game-skin/curl-champ--aurora.png","html":"items/game-skin/curl-champ--aurora.html"},
{"id":"game-skin.curl-champ.neon-stones","name":"Neon stones","kind":"game-skin","game":"Curl Champ","rarity":"Epic","source":"pass-premium","pass_level":25,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/game-skin/curl-champ--neon-stones.png","html":"items/game-skin/curl-champ--neon-stones.html"},
{"id":"world-theme.apex.neon-night","name":"Apex: Neon Night","kind":"world-theme","game":"Apex","rarity":"Legendary","source":"pass-premium","pass_level":45,"shop_price_coins":null,"bundle":null,"animated":true,"exclusive_forever":true,"finish_or_note":"A night circuit under a neon city: kerbs chase in cyan and pink, grandstand lights glow, stars twinkle.","png":"items/world-theme/apex--neon-night.png","html":"items/world-theme/apex--neon-night.html"},
{"id":"world-theme.crazy-golf.neon-course","name":"Crazy Golf: Neon Course","kind":"world-theme","game":"Crazy Golf","rarity":"Legendary","source":"pass-free","pass_level":50,"shop_price_coins":null,"bundle":null,"animated":true,"exclusive_forever":true,"finish_or_note":"Black-light mini golf: glowing green edges, a neon windmill that turns, a pulsing cup.","png":"items/world-theme/crazy-golf--neon-course.png","html":"items/world-theme/crazy-golf--neon-course.html"},
{"id":"world-theme.curl-champ.neon-rink","name":"Curl Champ: Neon Rink","kind":"world-theme","game":"Curl Champ","rarity":"Elite","source":"pass-premium","pass_level":24,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":"Dark ice with neon rings, glowing hog line and lit-up stones.","png":"items/world-theme/curl-champ--neon-rink.png","html":"items/world-theme/curl-champ--neon-rink.html"},
{"id":"world-theme.cue-ball.neon-table","name":"Cue Ball: Neon Table","kind":"world-theme","game":"Cue Ball","rarity":"Elite","source":"pass-premium","pass_level":54,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":"A black table with a faint grid, neon rails and glowing pockets.","png":"items/world-theme/cue-ball--neon-table.png","html":"items/world-theme/cue-ball--neon-table.html"},
{"id":"avatar-finish.chrome","name":"Chrome","kind":"avatar-finish","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"mirror metal","png":"items/avatar-finish/chrome.png","html":"items/avatar-finish/chrome.html"},
{"id":"avatar-finish.carbon","name":"Carbon","kind":"avatar-finish","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"carbon weave","png":"items/avatar-finish/carbon.png","html":"items/avatar-finish/carbon.html"},
{"id":"avatar-finish.comic-ink","name":"Comic Ink","kind":"avatar-finish","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"halftone and ink outline","png":"items/avatar-finish/comic-ink.png","html":"items/avatar-finish/comic-ink.html"},
{"id":"avatar-finish.holographic","name":"Holographic","kind":"avatar-finish","game":null,"rarity":"Elite","source":"shop","pass_level":null,"shop_price_coins":1600,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"foil sheen","png":"items/avatar-finish/holographic.png","html":"items/avatar-finish/holographic.html"},
{"id":"avatar-finish.wireframe","name":"Wireframe","kind":"avatar-finish","game":null,"rarity":"Elite","source":"shop","pass_level":null,"shop_price_coins":1600,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"glowing outline grid","png":"items/avatar-finish/wireframe.png","html":"items/avatar-finish/wireframe.html"},
{"id":"avatar-finish.lightning-core","name":"Lightning Core","kind":"avatar-finish","game":null,"rarity":"Legendary","source":"shop","pass_level":null,"shop_price_coins":2800,"bundle":null,"animated":true,"exclusive_forever":false,"finish_or_note":"animated: glowing core, crackling arcs","png":"items/avatar-finish/lightning-core.png","html":"items/avatar-finish/lightning-core.html"},
{"id":"avatar-special-edition.neon-captain-joulz","name":"Neon Captain Joulz","kind":"avatar-special-edition","game":null,"rarity":"Elite","source":"pass-premium","pass_level":1,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":"special-edition helmet","png":"items/avatar-special-edition/neon-captain-joulz.png","html":"items/avatar-special-edition/neon-captain-joulz.html"},
{"id":"avatar-finish.neon-glow","name":"Neon Glow","kind":"avatar-finish","game":null,"rarity":"Elite","source":"pass-premium","pass_level":40,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":"glow finish","png":"items/avatar-finish/neon-glow.png","html":"items/avatar-finish/neon-glow.html"},
{"id":"avatar-accessory.neon-bolt","name":"Neon Bolt","kind":"avatar-accessory","game":null,"rarity":"Epic","source":"pass-premium","pass_level":52,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":"accessory","png":"items/avatar-accessory/neon-bolt.png","html":"items/avatar-accessory/neon-bolt.html"},
{"id":"reaction.banter","name":"Banter","kind":"reaction","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"die-cut stickers, 4 emotes","png":"items/reaction/banter.png","html":"items/reaction/banter.html"},
{"id":"reaction.retro-arcade","name":"Retro Arcade","kind":"reaction","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"8-bit, 4 emotes","png":"items/reaction/retro-arcade.png","html":"items/reaction/retro-arcade.html"},
{"id":"reaction.captains-calls","name":"Captain's Calls","kind":"reaction","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"speech bubbles, 4 emotes","png":"items/reaction/captains-calls.png","html":"items/reaction/captains-calls.html"},
{"id":"reaction.holo-stickers","name":"Holo Stickers","kind":"reaction","game":null,"rarity":"Elite","source":"shop","pass_level":null,"shop_price_coins":1600,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":"holographic foil, 4 emotes","png":"items/reaction/holo-stickers.png","html":"items/reaction/holo-stickers.html"},
{"id":"reaction.spark","name":"Spark","kind":"reaction","game":null,"rarity":"Common","source":"pass-free","pass_level":22,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":"single emote: a happy spark","png":"items/reaction/spark.png","html":"items/reaction/spark.html"},
{"id":"reaction.zap","name":"Zap","kind":"reaction","game":null,"rarity":"Rare","source":"pass-premium","pass_level":8,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":"single emote: a determined bolt","png":"items/reaction/zap.png","html":"items/reaction/zap.html"},
{"id":"reaction.clutch","name":"Clutch","kind":"reaction","game":null,"rarity":"Rare","source":"pass-premium","pass_level":28,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":"single emote","png":"items/reaction/clutch.png","html":"items/reaction/clutch.html"},
{"id":"reaction.neon-signs","name":"Neon Signs","kind":"reaction","game":null,"rarity":"Epic","source":"pass-premium","pass_level":22,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":"neon tube words, 4 emotes","png":"items/reaction/neon-signs.png","html":"items/reaction/neon-signs.html"},
{"id":"reaction.live-wire","name":"Live Wire","kind":"reaction","game":null,"rarity":"Elite","source":"pass-premium","pass_level":49,"shop_price_coins":null,"bundle":null,"animated":true,"exclusive_forever":true,"finish_or_note":"animated, electric, 4 emotes","png":"items/reaction/live-wire.png","html":"items/reaction/live-wire.html"},
{"id":"celebration.confetti-pop","name":"Confetti Pop","kind":"celebration","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/celebration/confetti-pop.png","html":"items/celebration/confetti-pop.html"},
{"id":"celebration.spotlight","name":"Spotlight","kind":"celebration","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/celebration/spotlight.png","html":"items/celebration/spotlight.html"},
{"id":"celebration.fireworks","name":"Fireworks","kind":"celebration","game":null,"rarity":"Elite","source":"shop","pass_level":null,"shop_price_coins":1600,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/celebration/fireworks.png","html":"items/celebration/fireworks.html"},
{"id":"celebration.shockwave","name":"Shockwave","kind":"celebration","game":null,"rarity":"Elite","source":"shop","pass_level":null,"shop_price_coins":1600,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/celebration/shockwave.png","html":"items/celebration/shockwave.html"},
{"id":"celebration.gold-rush","name":"Gold Rush","kind":"celebration","game":null,"rarity":"Legendary","source":"shop","pass_level":null,"shop_price_coins":2800,"bundle":null,"animated":true,"exclusive_forever":false,"finish_or_note":"animated: coins rain, crown glows","png":"items/celebration/gold-rush.png","html":"items/celebration/gold-rush.html"},
{"id":"celebration.power-surge","name":"Power Surge","kind":"celebration","game":null,"rarity":"Legendary","source":"pass-premium","pass_level":30,"shop_price_coins":null,"bundle":null,"animated":true,"exclusive_forever":true,"finish_or_note":"animated: lightning strikes the podium","png":"items/celebration/power-surge.png","html":"items/celebration/power-surge.html"},
{"id":"celebration.circuit-overload","name":"Circuit Overload","kind":"celebration","game":null,"rarity":"Elite","source":"pass-premium","pass_level":58,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":"podium entrance","png":"items/celebration/circuit-overload.png","html":"items/celebration/circuit-overload.html"},
{"id":"tile-style.brushed-gold","name":"Brushed Gold","kind":"tile-style","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/tile-style/brushed-gold.png","html":"items/tile-style/brushed-gold.html"},
{"id":"tile-style.blueprint","name":"Blueprint","kind":"tile-style","game":null,"rarity":"Epic","source":"shop","pass_level":null,"shop_price_coins":1000,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/tile-style/blueprint.png","html":"items/tile-style/blueprint.html"},
{"id":"tile-style.obsidian-glass","name":"Obsidian Glass","kind":"tile-style","game":null,"rarity":"Elite","source":"shop","pass_level":null,"shop_price_coins":1600,"bundle":null,"animated":false,"exclusive_forever":false,"finish_or_note":null,"png":"items/tile-style/obsidian-glass.png","html":"items/tile-style/obsidian-glass.html"},
{"id":"tile-style.circuit-trace","name":"Circuit Trace","kind":"tile-style","game":null,"rarity":"Common","source":"pass-free","pass_level":16,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/tile-style/circuit-trace.png","html":"items/tile-style/circuit-trace.html"},
{"id":"tile-style.neon-dots","name":"Neon Dots","kind":"tile-style","game":null,"rarity":"Rare","source":"pass-premium","pass_level":38,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/tile-style/neon-dots.png","html":"items/tile-style/neon-dots.html"},
{"id":"tile-style.neon-grid","name":"Neon Grid","kind":"tile-style","game":null,"rarity":"Epic","source":"pass-premium","pass_level":7,"shop_price_coins":null,"bundle":null,"animated":false,"exclusive_forever":true,"finish_or_note":null,"png":"items/tile-style/neon-grid.png","html":"items/tile-style/neon-grid.html"}
]$catalogue$::jsonb) WITH ORDINALITY AS x(e, ord)
  LEFT JOIN (VALUES ('Apex', 'racing'), ('Crazy Golf', 'minigolf'), ('Cue Ball', 'pool'), ('Curl Champ', 'curling'), ('Free Cell', 'freecell'), ('Full House', 'pokersquares'), ('Top Bins', 'freekick')) AS g(name, game_type) ON g.name = e ->> 'game'
ON CONFLICT (id) DO NOTHING;

-- The avatar builder's options from docs/art/avatars/ (avatars.json and source/avatars.py), only what the art states:
-- each avatar's own accent colour (avatars.json "accent") and its background, the avatar's game scene on the
-- #1E2640 backdrop (avatars.py avatar_svg), both the default. The art names no feature or accessory options and no
-- other accents or backgrounds (docs/economy/README.md "Avatar options: the gap"); a later migration adds those rows.
INSERT INTO public.avatar_options (avatar_id, kind, option_id, is_default, sort_order) VALUES
  ('captain-joulz', 'accent', '#22e4ff', true, 0),
  ('captain-joulz', 'background', 'scene', true, 0),
  ('gemstone', 'accent', '#ffffff', true, 0),
  ('gemstone', 'background', 'scene', true, 0),
  ('hover', 'accent', '#b26bff', true, 0),
  ('hover', 'background', 'scene', true, 0),
  ('apex', 'accent', '#22e4ff', true, 0),
  ('apex', 'background', 'scene', true, 0),
  ('pinball', 'accent', '#e2c07a', true, 0),
  ('pinball', 'background', 'scene', true, 0),
  ('crazy-golf', 'accent', '#ff3b5c', true, 0),
  ('crazy-golf', 'background', 'scene', true, 0),
  ('iron-wall', 'accent', '#e2c07a', true, 0),
  ('iron-wall', 'background', 'scene', true, 0),
  ('wavefront', 'accent', '#22e4ff', true, 0),
  ('wavefront', 'background', 'scene', true, 0),
  ('breaker', 'accent', '#22e4ff', true, 0),
  ('breaker', 'background', 'scene', true, 0),
  ('fission', 'accent', '#ff6bd6', true, 0),
  ('fission', 'background', 'scene', true, 0),
  ('tempo', 'accent', '#22e4ff', true, 0),
  ('tempo', 'background', 'scene', true, 0),
  ('nucleus', 'accent', '#eef2ff', true, 0),
  ('nucleus', 'background', 'scene', true, 0),
  ('blackout', 'accent', '#06080f', true, 0),
  ('blackout', 'background', 'scene', true, 0),
  ('hanoi', 'accent', '#e2c07a', true, 0),
  ('hanoi', 'background', 'scene', true, 0),
  ('polypotions', 'accent', '#22e4ff', true, 0),
  ('polypotions', 'background', 'scene', true, 0),
  ('safe-cracker', 'accent', '#e2c07a', true, 0),
  ('safe-cracker', 'background', 'scene', true, 0),
  ('coral-pop', 'accent', '#ff6bd6', true, 0),
  ('coral-pop', 'background', 'scene', true, 0),
  ('swish', 'accent', '#06080f', true, 0),
  ('swish', 'background', 'scene', true, 0),
  ('flightpath', 'accent', '#22e4ff', true, 0),
  ('flightpath', 'background', 'scene', true, 0),
  ('home-run', 'accent', '#06080f', true, 0),
  ('home-run', 'background', 'scene', true, 0),
  ('cue-ball', 'accent', '#eef2ff', true, 0),
  ('cue-ball', 'background', 'scene', true, 0),
  ('blockzone', 'accent', '#22e4ff', true, 0),
  ('blockzone', 'background', 'scene', true, 0),
  ('spacewalk', 'accent', '#22e4ff', true, 0),
  ('spacewalk', 'background', 'scene', true, 0),
  ('meteor', 'accent', '#ffe600', true, 0),
  ('meteor', 'background', 'scene', true, 0),
  ('moon-climb', 'accent', '#ff3b5c', true, 0),
  ('moon-climb', 'background', 'scene', true, 0),
  ('curl-champ', 'accent', '#e2c07a', true, 0),
  ('curl-champ', 'background', 'scene', true, 0),
  ('top-bins', 'accent', '#3ddc84', true, 0),
  ('top-bins', 'background', 'scene', true, 0),
  ('lightbender', 'accent', '#ffffff', true, 0),
  ('lightbender', 'background', 'scene', true, 0),
  ('cryptogrid', 'accent', '#22e4ff', true, 0),
  ('cryptogrid', 'background', 'scene', true, 0),
  ('high-rise', 'accent', '#ff8a3d', true, 0),
  ('high-rise', 'background', 'scene', true, 0),
  ('rainbow-bridge', 'accent', '#ff8a3d', true, 0),
  ('rainbow-bridge', 'background', 'scene', true, 0),
  ('orbit', 'accent', '#e2c07a', true, 0),
  ('orbit', 'background', 'scene', true, 0)
ON CONFLICT (avatar_id, kind, option_id) DO NOTHING;

-- Every existing account: a wallet (0 coins), a loadout (the default avatar) and the starter items. The counts go to
-- the deploy log through migration_log.note (the Management API returns no plain notices); a second run reports 0.
DO $backfill$
DECLARE
  n_accounts integer;
  n_wallets integer;
  n_loadouts integer;
  n_items integer;
BEGIN
  SELECT count(*) INTO n_accounts FROM public.profiles;
  INSERT INTO public.coin_wallets (user_id) SELECT user_id FROM public.profiles ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS n_wallets = ROW_COUNT;
  INSERT INTO public.loadouts (user_id) SELECT user_id FROM public.profiles ON CONFLICT (user_id) DO NOTHING;
  GET DIAGNOSTICS n_loadouts = ROW_COUNT;
  INSERT INTO public.inventory_items (user_id, item_id, how)
  SELECT p.user_id, c.id, 'starter'
    FROM public.profiles p CROSS JOIN public.catalogue_items c
   WHERE c.source = 'free-starter'
  ON CONFLICT (user_id, item_id) DO NOTHING;
  GET DIAGNOSTICS n_items = ROW_COUNT;
  PERFORM migration_log.note('notice', format(
    'economy backfill: %s accounts; %s starter inventory rows inserted, %s wallets and %s loadouts created',
    n_accounts, n_items, n_wallets, n_loadouts));
END
$backfill$;
