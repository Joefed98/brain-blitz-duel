-- Public player ids for room-mates (Security C1b, Joe's decisions of 13 Nov 2026).
--
-- A phone reads its room's players, host and chat through row level security and Realtime. Those reads now carry a
-- public id for each player in place of the account id:
--
-- 1. public.player_public_ids: one public id per account, for life (server only). public.public_id_of(account) answers
--    it, making it on first use; an id with no account behind it (a deleted player's stand-in) gets a fresh id that is
--    kept nowhere.
-- 2. New columns duel_players.public_id, duels.host_public_id and room_messages.sender_public_id, filled by triggers
--    whenever the account id is written, and for every existing row here (new columns only; no existing value changes).
-- 3. Column grants: phones (anon, authenticated) may read every column of the three tables except the account ids
--    (duel_players.user_id, duels.host_user_id, room_messages.sender_user_id). Realtime's postgres_changes check column
--    privileges per column (realtime.apply_rls), so live changes leave the account ids out too.
--    A column added to these tables later is readable by phones only once a migration grants it the same way
--    (public-ids-check fails until it is).
-- 4. public.my_public_id(): the caller's own public id, so a phone can find its own seat.
-- 5. An account's public id goes when its account does (ON DELETE CASCADE; accounts.forget_user deletes the auth user,
--    and its rows are re-keyed to a stand-in, which the triggers give a fresh id).

CREATE TABLE IF NOT EXISTS public.player_public_ids (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  public_id uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.player_public_ids ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.player_public_ids FROM PUBLIC, anon, authenticated;
GRANT SELECT, INSERT, DELETE ON public.player_public_ids TO service_role;

CREATE OR REPLACE FUNCTION public.public_id_of(p_user_id uuid)
RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v uuid;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT public_id INTO v FROM public.player_public_ids WHERE user_id = p_user_id;
  IF FOUND THEN
    RETURN v;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN gen_random_uuid();
  END IF;
  INSERT INTO public.player_public_ids (user_id) VALUES (p_user_id) ON CONFLICT (user_id) DO NOTHING;
  SELECT public_id INTO v FROM public.player_public_ids WHERE user_id = p_user_id;
  RETURN v;
END
$$;
REVOKE ALL ON FUNCTION public.public_id_of(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.public_id_of(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.my_public_id()
RETURNS uuid LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.public_id_of(auth.uid())
$$;
REVOKE ALL ON FUNCTION public.my_public_id() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.my_public_id() TO authenticated, service_role;

-- 2. The columns and their triggers.
ALTER TABLE public.duel_players ADD COLUMN IF NOT EXISTS public_id uuid;
ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS host_public_id uuid;
ALTER TABLE public.room_messages ADD COLUMN IF NOT EXISTS sender_public_id uuid;
CREATE INDEX IF NOT EXISTS duel_players_public_id_idx ON public.duel_players (public_id);

CREATE OR REPLACE FUNCTION public.fill_player_public_id()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_TABLE_NAME = 'duel_players' THEN
    IF TG_OP = 'INSERT' OR NEW.user_id IS DISTINCT FROM OLD.user_id OR NEW.public_id IS NULL THEN
      NEW.public_id := public.public_id_of(NEW.user_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'duels' THEN
    IF TG_OP = 'INSERT' OR NEW.host_user_id IS DISTINCT FROM OLD.host_user_id OR (NEW.host_public_id IS NULL AND NEW.host_user_id IS NOT NULL) THEN
      NEW.host_public_id := public.public_id_of(NEW.host_user_id);
    END IF;
  ELSIF TG_TABLE_NAME = 'room_messages' THEN
    IF TG_OP = 'INSERT' OR NEW.sender_user_id IS DISTINCT FROM OLD.sender_user_id OR NEW.sender_public_id IS NULL THEN
      NEW.sender_public_id := public.public_id_of(NEW.sender_user_id);
    END IF;
  END IF;
  RETURN NEW;
END
$$;
REVOKE ALL ON FUNCTION public.fill_player_public_id() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS duel_players_public_id ON public.duel_players;
CREATE TRIGGER duel_players_public_id BEFORE INSERT OR UPDATE ON public.duel_players
  FOR EACH ROW EXECUTE FUNCTION public.fill_player_public_id();
DROP TRIGGER IF EXISTS duels_host_public_id ON public.duels;
CREATE TRIGGER duels_host_public_id BEFORE INSERT OR UPDATE ON public.duels
  FOR EACH ROW EXECUTE FUNCTION public.fill_player_public_id();
DROP TRIGGER IF EXISTS room_messages_sender_public_id ON public.room_messages;
CREATE TRIGGER room_messages_sender_public_id BEFORE INSERT OR UPDATE ON public.room_messages
  FOR EACH ROW EXECUTE FUNCTION public.fill_player_public_id();

-- Existing rows (Joe's approval, 13 Nov 2026: new columns only, no existing value changes).
UPDATE public.duel_players SET public_id = public.public_id_of(user_id) WHERE public_id IS NULL;
UPDATE public.duels SET host_public_id = public.public_id_of(host_user_id) WHERE host_public_id IS NULL AND host_user_id IS NOT NULL;
UPDATE public.room_messages SET sender_public_id = public.public_id_of(sender_user_id) WHERE sender_public_id IS NULL;

-- 3. What phones may read: every column but the account ids.
DO $$
DECLARE
  t record;
  cols text;
BEGIN
  FOR t IN SELECT * FROM (VALUES ('duel_players', 'user_id'), ('duels', 'host_user_id'), ('room_messages', 'sender_user_id')) AS v(tab, hidden) LOOP
    SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position) INTO cols
      FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = t.tab AND column_name <> t.hidden;
    EXECUTE format('REVOKE SELECT ON public.%I FROM anon, authenticated', t.tab);
    EXECUTE format('GRANT SELECT (%s) ON public.%I TO authenticated', cols, t.tab);
    -- room_messages was readable by anon (row level security gives anon no rows); its columns stay so, the account id
    -- excepted.
    IF t.tab = 'room_messages' THEN
      EXECUTE format('GRANT SELECT (%s) ON public.%I TO anon', cols, t.tab);
    END IF;
  END LOOP;
END
$$;
