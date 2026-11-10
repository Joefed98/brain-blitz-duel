/**
 * Writes the catalogue seed migration (wave 2 A1; docs/economy/README.md) from docs/art/wave-2/catalogue.json, which
 * is the source of truth: the file's items go into the migration verbatim, as one JSON literal, and the SQL maps them
 * onto public.catalogue_items. Nothing is typed by hand.
 *
 *   bun scripts/economy-catalogue-sql.ts           writes supabase/migrations/20261110160100_economy_catalogue.sql
 *   bun scripts/economy-catalogue-sql.ts --check   fails unless the file is what it would write
 *
 * Merged migrations never change: when catalogue.json gains items later, write a NEW migration (copy this script's
 * output shape; ON CONFLICT DO NOTHING keeps it additive). economy-check proves the database matches the file.
 */

import { readFileSync, writeFileSync } from "node:fs";

import { AVATAR_SCENE_BACKGROUND, GAME_TYPE_BY_NAME } from "../src/lib/economy/slots";

export const SEED_FILE = "supabase/migrations/20261110160100_economy_catalogue.sql";

export function catalogueSeedSql(): string {
  const catalogue = JSON.parse(readFileSync("docs/art/wave-2/catalogue.json", "utf8")) as {
    version: number;
    generated: string;
    items: unknown[];
  };
  const json = `[\n${catalogue.items.map((item) => JSON.stringify(item)).join(",\n")}\n]`;
  if (json.includes("$catalogue$")) throw new Error("catalogue.json holds the dollar-quote tag");
  const avatars = (JSON.parse(readFileSync("docs/art/avatars/avatars.json", "utf8")) as {
    avatars: { slug: string; accent: string }[];
  }).avatars;
  const avatarRows = avatars
    .flatMap((a) => [
      `  ('${a.slug}', 'accent', '${a.accent.toLowerCase()}', true, 0)`,
      `  ('${a.slug}', 'background', '${AVATAR_SCENE_BACKGROUND}', true, 0)`,
    ])
    .join(",\n");
  const games = Object.entries(GAME_TYPE_BY_NAME)
    .map(([name, type]) => `('${name.replace(/'/g, "''")}', '${type}')`)
    .join(", ");
  return `-- The item catalogue (Wave 2, train A, session A1; 10 Nov 2026; docs/economy/README.md). Written by
-- scripts/economy-catalogue-sql.ts from docs/art/wave-2/catalogue.json (version ${catalogue.version}, generated ${catalogue.generated}): its
-- ${catalogue.items.length} items verbatim, never typed by hand. Additive and idempotent: it inserts catalogue rows that aren't there yet
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
  FROM jsonb_array_elements($catalogue$${json}$catalogue$::jsonb) WITH ORDINALITY AS x(e, ord)
  LEFT JOIN (VALUES ${games}) AS g(name, game_type) ON g.name = e ->> 'game'
ON CONFLICT (id) DO NOTHING;

-- The avatar builder's options from docs/art/avatars/ (avatars.json and source/avatars.py), only what the art states:
-- each avatar's own accent colour (avatars.json "accent") and its background, the avatar's game scene on the
-- #1E2640 backdrop (avatars.py avatar_svg), both the default. The art names no feature or accessory options and no
-- other accents or backgrounds (docs/economy/README.md "Avatar options: the gap"); a later migration adds those rows.
INSERT INTO public.avatar_options (avatar_id, kind, option_id, is_default, sort_order) VALUES
${avatarRows}
ON CONFLICT (avatar_id, kind, option_id) DO NOTHING;

-- Every existing account: a wallet (0 coins), a loadout (the default avatar) and the starter items.
INSERT INTO public.coin_wallets (user_id) SELECT user_id FROM public.profiles ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.loadouts (user_id) SELECT user_id FROM public.profiles ON CONFLICT (user_id) DO NOTHING;
INSERT INTO public.inventory_items (user_id, item_id, how)
SELECT p.user_id, c.id, 'starter'
  FROM public.profiles p CROSS JOIN public.catalogue_items c
 WHERE c.source = 'free-starter'
ON CONFLICT (user_id, item_id) DO NOTHING;
`;
}

if (import.meta.main) {
  const sql = catalogueSeedSql();
  if (process.argv.includes("--check")) {
    const ok = readFileSync(SEED_FILE, "utf8") === sql;
    console.log(ok ? `economy-catalogue-sql: ${SEED_FILE} is up to date` : `FAIL ${SEED_FILE} differs from the generator`);
    process.exit(ok ? 0 : 1);
  }
  writeFileSync(SEED_FILE, sql);
  console.log(`wrote ${SEED_FILE}`);
}
