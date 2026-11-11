-- Card backs (wave 2, E1; 11 Nov 2026, Joe's decision; docs/skins.md, docs/art/wave-2/README.md "Card backs").
--
-- The three Free Cell "game skins" (Royal Damask, Holo Foil, Neon card back) become one account-wide card back, kind
-- and slot 'card-back', drawn on Full House's face-down deck: game-skin.free-cell.royal-damask → card-back.royal-damask,
-- game-skin.free-cell.holo-foil → card-back.holo-foil, game-skin.free-cell.neon-card-back → card-back.neon. Names,
-- rarities, sources, prices and pass levels are unchanged; docs/art/wave-2/catalogue.json says the same.
--
-- Anyone who owns one keeps it (the same inventory row, moved in place: same how, time and spend line) and anyone who had it equipped has it in the new slot.
-- The old ids are recorded in public.catalogue_renamed, and a trigger keeps them from ever being inserted again (so
-- the seed migration, 20261110160100, applied again adds nothing). Idempotent: a second run changes nothing.

-- The new kind.
ALTER TABLE public.catalogue_items DROP CONSTRAINT IF EXISTS catalogue_items_kind_check;
ALTER TABLE public.catalogue_items ADD CONSTRAINT catalogue_items_kind_check CHECK (kind IN (
  'card-art', 'frame', 'name-colour', 'avatar-special-edition', 'avatar-finish', 'avatar-accessory', 'reaction',
  'celebration', 'tile-style', 'game-skin', 'world-theme', 'card-back'));

-- Renamed catalogue ids: old → new. Readable by anyone, like the catalogue.
CREATE TABLE IF NOT EXISTS public.catalogue_renamed (
  old_id text PRIMARY KEY,
  new_id text NOT NULL REFERENCES public.catalogue_items (id),
  renamed_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.catalogue_renamed ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.catalogue_renamed FROM PUBLIC, anon, authenticated, service_role;
GRANT SELECT ON public.catalogue_renamed TO anon, authenticated, service_role;
DROP POLICY IF EXISTS catalogue_renamed_read ON public.catalogue_renamed;
CREATE POLICY catalogue_renamed_read ON public.catalogue_renamed FOR SELECT TO anon, authenticated USING (true);

DO $rename$
DECLARE
  r record;
  n_items integer := 0;
  n_owned integer := 0;
  n_equipped integer := 0;
  k integer;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS card_back_equipped (old_id text, user_id uuid, equipped_at timestamptz) ON COMMIT DROP;
  FOR r IN SELECT * FROM (VALUES
      ('game-skin.free-cell.royal-damask', 'card-back.royal-damask', 'items/card-back/royal-damask'),
      ('game-skin.free-cell.holo-foil', 'card-back.holo-foil', 'items/card-back/holo-foil'),
      ('game-skin.free-cell.neon-card-back', 'card-back.neon', 'items/card-back/neon')) AS v(old_id, new_id, path)
  LOOP
    -- The new row, from the old one.
    INSERT INTO public.catalogue_items
      (id, name, kind, slot, game, game_type, rarity, source, pass_level, price_coins, bundle, animated, exclusive,
       exclusive_forever, note, png_path, html_path, sort_order)
    SELECT r.new_id, name, 'card-back', 'card-back', NULL, NULL, rarity, source, pass_level, price_coins, bundle, animated,
           exclusive, exclusive_forever, note, r.path || '.png', r.path || '.html', sort_order
      FROM public.catalogue_items WHERE id = r.old_id
    ON CONFLICT (id) DO NOTHING;
    GET DIAGNOSTICS k = ROW_COUNT;
    n_items := n_items + k;
    -- Equipped: remembered, then cleared (the slot row points at the inventory row being moved).
    INSERT INTO card_back_equipped SELECT r.old_id, user_id, equipped_at FROM public.loadout_slots WHERE item_id = r.old_id;
    DELETE FROM public.loadout_slots WHERE item_id = r.old_id;
    -- Owners keep it, moved in place: the same row, so its how, time and spend line (a purchase's unique ledger_id)
    -- stay exactly as they were. Anyone already holding the new id keeps that row instead.
    DELETE FROM public.inventory_items o WHERE o.item_id = r.old_id
      AND EXISTS (SELECT 1 FROM public.inventory_items n WHERE n.user_id = o.user_id AND n.item_id = r.new_id);
    UPDATE public.inventory_items SET item_id = r.new_id WHERE item_id = r.old_id;
    GET DIAGNOSTICS k = ROW_COUNT;
    n_owned := n_owned + k;
    -- Equipped: into the card-back slot (an account had at most one Free Cell skin equipped).
    INSERT INTO public.loadout_slots (user_id, slot, item_id, equipped_at)
    SELECT user_id, 'card-back', r.new_id, equipped_at FROM card_back_equipped WHERE old_id = r.old_id
    ON CONFLICT (user_id, slot) DO NOTHING;
    GET DIAGNOSTICS k = ROW_COUNT;
    n_equipped := n_equipped + k;
    IF EXISTS (SELECT 1 FROM public.catalogue_items WHERE id = r.new_id) THEN
      INSERT INTO public.catalogue_renamed (old_id, new_id) VALUES (r.old_id, r.new_id) ON CONFLICT (old_id) DO NOTHING;
      DELETE FROM public.catalogue_items WHERE id = r.old_id;
    END IF;
  END LOOP;
  PERFORM migration_log.note('notice', format(
    'card backs: %s catalogue rows renamed, %s owned and %s equipped moved', n_items, n_owned, n_equipped));
END
$rename$;

-- A renamed id never comes back (a later run of an older seed inserts nothing for it).
CREATE OR REPLACE FUNCTION public.catalogue_skip_renamed()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.catalogue_renamed WHERE old_id = NEW.id) THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.catalogue_skip_renamed() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS catalogue_skip_renamed ON public.catalogue_items;
CREATE TRIGGER catalogue_skip_renamed BEFORE INSERT ON public.catalogue_items
  FOR EACH ROW EXECUTE FUNCTION public.catalogue_skip_renamed();
