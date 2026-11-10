-- Accounts (Wave 1, train 1, session 1; 10 Nov 2026; docs/accounts/README.md). Non-destructive and idempotent: it
-- only creates objects (schemas, a sequence, two tables, functions, triggers, policies and a pg_cron job), and is safe
-- to apply more than once. No existing table, row or column is changed by applying it.
--
-- An account is a profile row on top of the device's existing Supabase auth user. A guest who signs up keeps the same
-- auth user id (Supabase links the email or Google identity to the anonymous user), so every result, async attempt,
-- challenge, practice play and beta row stays theirs with nothing copied. A user with no profile is a guest.
--
-- What clients may do (RLS and column grants, as Supabase applies them):
--   * a signed-in player reads their own profile row (every column) and updates only `colour` and `country` on it;
--   * nobody reads another player's row: other players' public fields (username, colour, player number, founding)
--     come only from public.public_profiles(uuid[]), which never returns a date of birth, a country or a status;
--   * the date of birth, player number, founding flag and creation time can't be changed by anyone but the admin
--     functions below (a trigger holds them, the service role included);
--   * everything else (creating a profile, renames, deletion) goes through the server (src/lib/account/), on the
--     service-role functions here.
--
-- The daily clean-up (accounts.run_daily_cleanup, pg_cron 03:41 UTC) removes accounts 30 days after deletion was
-- requested and guests 13 months after their last game. It deletes and rewrites rows only inside function bodies,
-- each statement with a WHERE; see the README's "Daily clean-up" for exactly what it touches.

/* ------------------------------------------------------------------ schema for the private parts */

-- Not in PostgREST's exposed schemas; anon and authenticated get nothing here.
CREATE SCHEMA IF NOT EXISTS accounts;
REVOKE ALL ON SCHEMA accounts FROM PUBLIC, anon, authenticated;

/* ------------------------------------------------------------------ player numbers */

-- From 2, never reused (a sequence never hands a number out twice). #1 is reserved for
-- accounts.admin_assign_player_one, which Joe runs once on his own account.
CREATE SEQUENCE IF NOT EXISTS public.profile_player_number_seq START WITH 2 MINVALUE 2;
REVOKE ALL ON SEQUENCE public.profile_player_number_seq FROM PUBLIC, anon, authenticated;

/* ------------------------------------------------------------------ profiles */

CREATE TABLE IF NOT EXISTS public.profiles (
  user_id uuid PRIMARY KEY REFERENCES auth.users (id) ON DELETE CASCADE,
  -- Shown as typed; 3–16 letters, numbers and underscores (src/lib/names/username.ts holds the same rule).
  username text NOT NULL CHECK (username ~ '^[A-Za-z0-9_]{3,16}$'),
  -- Unique ignoring capitals.
  username_key text NOT NULL CHECK (username_key = lower(username)),
  -- One of the 32 player colours (src/lib/duel/playerLook.ts PLAYER_COLOURS).
  colour smallint NOT NULL CHECK (colour BETWEEN 0 AND 31),
  -- Full date; age is worked out when needed. Never under 13 at sign-up (the server refuses and stores nothing).
  date_of_birth date NOT NULL CHECK (date_of_birth >= DATE '1900-01-01'),
  -- Assigned by the trigger below from public.profile_player_number_seq (never by a caller).
  player_number integer NOT NULL CHECK (player_number >= 1),
  -- Accounts created before 26 Jan 2027 00:00 UK time (set by the trigger below, never by a caller).
  founding boolean NOT NULL DEFAULT false,
  -- ISO 3166-1 alpha-2 (the 249 assigned codes, src/lib/account/country.ts), from the phone's region setting; never
  -- from an IP address.
  country text CHECK (country IS NULL OR country = ANY ('{
    AD,AE,AF,AG,AI,AL,AM,AO,AQ,AR,AS,AT,AU,AW,AX,AZ,BA,BB,BD,BE,BF,BG,BH,BI,BJ,BL,BM,BN,BO,BQ,BR,BS,BT,BV,BW,BY,
    BZ,CA,CC,CD,CF,CG,CH,CI,CK,CL,CM,CN,CO,CR,CU,CV,CW,CX,CY,CZ,DE,DJ,DK,DM,DO,DZ,EC,EE,EG,EH,ER,ES,ET,FI,FJ,FK,
    FM,FO,FR,GA,GB,GD,GE,GF,GG,GH,GI,GL,GM,GN,GP,GQ,GR,GS,GT,GU,GW,GY,HK,HM,HN,HR,HT,HU,ID,IE,IL,IM,IN,IO,IQ,IR,
    IS,IT,JE,JM,JO,JP,KE,KG,KH,KI,KM,KN,KP,KR,KW,KY,KZ,LA,LB,LC,LI,LK,LR,LS,LT,LU,LV,LY,MA,MC,MD,ME,MF,MG,MH,MK,
    ML,MM,MN,MO,MP,MQ,MR,MS,MT,MU,MV,MW,MX,MY,MZ,NA,NC,NE,NF,NG,NI,NL,NO,NP,NR,NU,NZ,OM,PA,PE,PF,PG,PH,PK,PL,PM,
    PN,PR,PS,PT,PW,PY,QA,RE,RO,RS,RU,RW,SA,SB,SC,SD,SE,SG,SH,SI,SJ,SK,SL,SM,SN,SO,SR,SS,ST,SV,SX,SY,SZ,TC,TD,TF,
    TG,TH,TJ,TK,TL,TM,TN,TO,TR,TT,TV,TW,TZ,UA,UG,UM,US,UY,UZ,VA,VC,VE,VG,VI,VN,VU,WF,WS,YE,YT,ZA,ZM,ZW}'::text[])),
  created_at timestamptz NOT NULL DEFAULT now(),
  -- The last rename that counts towards the 90-day limit (a forced rename doesn't set it).
  username_changed_at timestamptz,
  -- The one free change within 7 days of sign-up has been used.
  free_change_used boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'warned', 'banned')),
  -- Set when the player asks to delete their account; the clean-up removes it 30 days later unless cancelled.
  deletion_requested_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS profiles_username_key_idx ON public.profiles (username_key);
CREATE UNIQUE INDEX IF NOT EXISTS profiles_player_number_idx ON public.profiles (player_number);
CREATE INDEX IF NOT EXISTS profiles_deletion_idx ON public.profiles (deletion_requested_at)
  WHERE deletion_requested_at IS NOT NULL;

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.profiles FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.profiles TO authenticated;
GRANT UPDATE (colour, country) ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;

DROP POLICY IF EXISTS profiles_read_own ON public.profiles;
CREATE POLICY profiles_read_own ON public.profiles
  FOR SELECT TO authenticated USING (user_id = auth.uid());

DROP POLICY IF EXISTS profiles_update_own ON public.profiles;
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() AND deletion_requested_at IS NULL)
  WITH CHECK (user_id = auth.uid());

-- Founding Player: an account created before 26 Jan 2027 00:00 UK time (src/config/accountConfig.ts FOUNDING_CUTOFF_ISO).
CREATE OR REPLACE FUNCTION accounts.is_founding(p_created_at timestamptz)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$ SELECT p_created_at < TIMESTAMPTZ '2027-01-26 00:00:00 Europe/London' $$;
REVOKE ALL ON FUNCTION accounts.is_founding(timestamptz) FROM PUBLIC, anon, authenticated;

-- The fields only the database decides. On insert: the player number from the sequence, the founding flag from the
-- creation time, a fresh account's rename and status fields. On update: the date of birth, player number, founding
-- flag and creation time keep their values unless an admin function below has set its flag for the transaction.
CREATE OR REPLACE FUNCTION accounts.profiles_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.player_number := nextval('public.profile_player_number_seq');
    NEW.created_at := now();
    NEW.founding := accounts.is_founding(NEW.created_at);
    NEW.username_changed_at := NULL;
    NEW.free_change_used := false;
    NEW.status := 'active';
    NEW.deletion_requested_at := NULL;
    RETURN NEW;
  END IF;
  IF coalesce(current_setting('accounts.admin_date_of_birth', true), '') <> 'on' THEN
    NEW.date_of_birth := OLD.date_of_birth;
  END IF;
  IF coalesce(current_setting('accounts.admin_player_number', true), '') <> 'on' THEN
    NEW.player_number := OLD.player_number;
  END IF;
  NEW.founding := OLD.founding;
  NEW.created_at := OLD.created_at;
  NEW.user_id := OLD.user_id;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION accounts.profiles_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS profiles_guard ON public.profiles;
CREATE TRIGGER profiles_guard BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION accounts.profiles_guard();

/* ------------------------------------------------------------------ released usernames */

-- A released username (a rename, or an account removed by the clean-up) is held for 30 days: only the account that
-- released it may take it back in that time (user_id null: nobody may).
CREATE TABLE IF NOT EXISTS accounts.username_holds (
  username_key text PRIMARY KEY,
  user_id uuid,
  released_at timestamptz NOT NULL DEFAULT now(),
  held_until timestamptz NOT NULL
);
ALTER TABLE accounts.username_holds ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON accounts.username_holds FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ admin log */

-- Every admin change (a date of birth corrected, player #1 given, a forced rename), for support's records.
CREATE TABLE IF NOT EXISTS accounts.admin_log (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  at timestamptz NOT NULL DEFAULT now(),
  action text NOT NULL,
  user_id uuid,
  detail jsonb,
  by_role text NOT NULL DEFAULT current_user
);
ALTER TABLE accounts.admin_log ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON accounts.admin_log FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ server functions (service role only) */

-- Creates the caller's profile. The server has already checked the name's rules, the age and the colour; here the
-- database checks what only it can: a permanent (non-anonymous) auth user, no profile yet, the name free and not held.
-- Answers 'created', 'exists', 'guest', 'taken' or 'held'.
CREATE OR REPLACE FUNCTION public.create_profile(
  p_user_id uuid, p_username text, p_colour smallint, p_date_of_birth date, p_country text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, accounts
AS $$
DECLARE
  v_key text := lower(p_username);
  v_hold accounts.username_holds%ROWTYPE;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users u WHERE u.id = p_user_id AND u.is_anonymous IS NOT TRUE) THEN
    RETURN 'guest';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
    RETURN 'exists';
  END IF;
  SELECT * INTO v_hold FROM accounts.username_holds WHERE username_key = v_key AND held_until > now() FOR UPDATE;
  IF FOUND AND v_hold.user_id IS DISTINCT FROM p_user_id THEN
    RETURN 'held';
  END IF;
  BEGIN
    INSERT INTO public.profiles (user_id, username, username_key, colour, date_of_birth, country)
    VALUES (p_user_id, p_username, v_key, p_colour, p_date_of_birth, p_country);
  EXCEPTION WHEN unique_violation THEN
    IF EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id) THEN
      RETURN 'exists';
    END IF;
    RETURN 'taken';
  END;
  DELETE FROM accounts.username_holds WHERE username_key = v_key;
  RETURN 'created';
END;
$$;
REVOKE ALL ON FUNCTION public.create_profile(uuid, text, smallint, date, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_profile(uuid, text, smallint, date, text) TO service_role;

-- Renames an account. p_kind: 'free' (the one change within 7 days), 'limited' (the 90-day change) or 'forced'
-- (moderation: counts towards nothing). The server decides which kind is allowed (src/lib/account/usernameRules.ts);
-- p_expected_changed_at is what it read, so two renames racing can't both pass. The old name is held for 30 days.
-- Answers 'renamed', 'missing', 'stale', 'taken' or 'held'.
CREATE OR REPLACE FUNCTION public.rename_profile(
  p_user_id uuid, p_username text, p_kind text, p_expected_changed_at timestamptz, p_note text DEFAULT NULL)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, accounts
AS $$
DECLARE
  v_row public.profiles%ROWTYPE;
  v_key text := lower(p_username);
  v_hold accounts.username_holds%ROWTYPE;
BEGIN
  IF p_kind NOT IN ('free', 'limited', 'forced') THEN
    RAISE EXCEPTION 'rename_profile: unknown kind %', p_kind;
  END IF;
  SELECT * INTO v_row FROM public.profiles WHERE user_id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'missing';
  END IF;
  IF p_kind <> 'forced' AND (v_row.username_changed_at IS DISTINCT FROM p_expected_changed_at
      OR (p_kind = 'free' AND v_row.free_change_used)) THEN
    RETURN 'stale';
  END IF;
  IF v_key <> v_row.username_key THEN
    SELECT * INTO v_hold FROM accounts.username_holds WHERE username_key = v_key AND held_until > now() FOR UPDATE;
    IF FOUND AND v_hold.user_id IS DISTINCT FROM p_user_id THEN
      RETURN 'held';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles WHERE username_key = v_key) THEN
      RETURN 'taken';
    END IF;
  END IF;
  BEGIN
    UPDATE public.profiles
       SET username = p_username,
           username_key = v_key,
           username_changed_at = CASE WHEN p_kind = 'forced' THEN username_changed_at ELSE now() END,
           free_change_used = free_change_used OR p_kind = 'free'
     WHERE user_id = p_user_id;
  EXCEPTION WHEN unique_violation THEN
    RETURN 'taken';
  END;
  IF v_key <> v_row.username_key THEN
    DELETE FROM accounts.username_holds WHERE username_key = v_key;
    INSERT INTO accounts.username_holds (username_key, user_id, released_at, held_until)
    VALUES (v_row.username_key, p_user_id, now(), now() + interval '30 days')
    ON CONFLICT (username_key) DO UPDATE
      SET user_id = EXCLUDED.user_id, released_at = EXCLUDED.released_at, held_until = EXCLUDED.held_until;
  END IF;
  IF p_kind = 'forced' THEN
    INSERT INTO accounts.admin_log (action, user_id, detail)
    VALUES ('forced_rename', p_user_id, jsonb_build_object('from', v_row.username, 'to', p_username, 'note', p_note));
  END IF;
  RETURN 'renamed';
END;
$$;
REVOKE ALL ON FUNCTION public.rename_profile(uuid, text, text, timestamptz, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.rename_profile(uuid, text, text, timestamptz, text) TO service_role;

-- Whether a username could be taken by this user now: 'free', 'taken' (another account has it) or 'held' (released
-- by another account in the past 30 days).
CREATE OR REPLACE FUNCTION public.username_status(p_username text, p_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, accounts
AS $$
  SELECT CASE
    WHEN EXISTS (SELECT 1 FROM public.profiles WHERE username_key = lower(p_username) AND user_id IS DISTINCT FROM p_user_id)
      THEN 'taken'
    WHEN EXISTS (SELECT 1 FROM accounts.username_holds
                  WHERE username_key = lower(p_username) AND held_until > now() AND user_id IS DISTINCT FROM p_user_id)
      THEN 'held'
    ELSE 'free' END;
$$;
REVOKE ALL ON FUNCTION public.username_status(text, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.username_status(text, uuid) TO service_role;

-- What a guest has on this user id (shown before signing in to another account on the same phone: it stays here).
CREATE OR REPLACE FUNCTION public.guest_progress(p_user_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'rooms', (SELECT count(DISTINCT duel_id) FROM (
                SELECT duel_id FROM public.duel_players WHERE user_id = p_user_id
                UNION SELECT duel_id FROM public.room_joins WHERE user_id = p_user_id) r),
    'dailies', (SELECT count(*) FROM public.async_attempts a JOIN public.async_rooms ar ON ar.id = a.room_id
                 WHERE a.user_id = p_user_id AND ar.kind <> 'challenge'),
    'challenges', (SELECT count(*) FROM public.async_attempts a JOIN public.async_rooms ar ON ar.id = a.room_id
                    WHERE a.user_id = p_user_id AND ar.kind = 'challenge'),
    'practice', (SELECT count(*) FROM public.practice_plays WHERE user_id = p_user_id),
    'account', EXISTS (SELECT 1 FROM public.profiles WHERE user_id = p_user_id));
$$;
REVOKE ALL ON FUNCTION public.guest_progress(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.guest_progress(uuid) TO service_role;

/* ------------------------------------------------------------------ what other players see */

-- Public fields only, for up to 100 players. An account waiting for deletion shows as "Deleted player" at once.
CREATE OR REPLACE FUNCTION public.public_profiles(p_user_ids uuid[])
RETURNS TABLE (user_id uuid, username text, colour smallint, player_number integer, founding boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.user_id,
         CASE WHEN p.deletion_requested_at IS NULL THEN p.username ELSE 'Deleted player' END,
         CASE WHEN p.deletion_requested_at IS NULL THEN p.colour END,
         CASE WHEN p.deletion_requested_at IS NULL THEN p.player_number END,
         p.founding AND p.deletion_requested_at IS NULL
    FROM public.profiles p
   WHERE p.user_id = ANY (p_user_ids[1:100]);
$$;
REVOKE ALL ON FUNCTION public.public_profiles(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.public_profiles(uuid[]) TO authenticated, service_role;

/* ------------------------------------------------------------------ admin functions (dashboard only) */

-- Corrects an account's date of birth after a support request (docs/accounts/README.md). Logged. Refuses a date that
-- makes the player under 13: such an account should be deleted instead.
--   SELECT accounts.admin_set_date_of_birth('Username', DATE '2001-04-30', 'support ticket 123');
CREATE OR REPLACE FUNCTION accounts.admin_set_date_of_birth(p_username text, p_date_of_birth date, p_note text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, accounts
AS $$
DECLARE
  v_row public.profiles%ROWTYPE;
BEGIN
  IF coalesce(trim(p_note), '') = '' THEN
    RAISE EXCEPTION 'admin_set_date_of_birth: give a note (the support request)';
  END IF;
  SELECT * INTO v_row FROM public.profiles WHERE username_key = lower(p_username) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_set_date_of_birth: no account named %', p_username;
  END IF;
  IF p_date_of_birth > (now() AT TIME ZONE 'Europe/London')::date - interval '13 years' THEN
    RAISE EXCEPTION 'admin_set_date_of_birth: % would make the player under 13; delete the account instead', p_date_of_birth;
  END IF;
  PERFORM set_config('accounts.admin_date_of_birth', 'on', true);
  UPDATE public.profiles SET date_of_birth = p_date_of_birth WHERE user_id = v_row.user_id;
  PERFORM set_config('accounts.admin_date_of_birth', 'off', true);
  INSERT INTO accounts.admin_log (action, user_id, detail)
  VALUES ('set_date_of_birth', v_row.user_id,
          jsonb_build_object('from', v_row.date_of_birth, 'to', p_date_of_birth, 'note', p_note));
  RETURN format('%s: date of birth set to %s', v_row.username, p_date_of_birth);
END;
$$;
REVOKE ALL ON FUNCTION accounts.admin_set_date_of_birth(text, date, text) FROM PUBLIC, anon, authenticated, service_role;

-- Gives player #1 to one account (Joe's own, once). Its earlier number is retired, never handed out again.
--   SELECT accounts.admin_assign_player_one('Username');
CREATE OR REPLACE FUNCTION accounts.admin_assign_player_one(p_username text)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, accounts
AS $$
DECLARE
  v_row public.profiles%ROWTYPE;
  v_holder text;
BEGIN
  SELECT * INTO v_row FROM public.profiles WHERE username_key = lower(p_username) FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_assign_player_one: no account named %', p_username;
  END IF;
  IF v_row.player_number = 1 THEN
    RETURN format('%s is already #1', v_row.username);
  END IF;
  SELECT username INTO v_holder FROM public.profiles WHERE player_number = 1;
  IF FOUND THEN
    RAISE EXCEPTION 'admin_assign_player_one: #1 already belongs to %', v_holder;
  END IF;
  PERFORM set_config('accounts.admin_player_number', 'on', true);
  UPDATE public.profiles SET player_number = 1 WHERE user_id = v_row.user_id;
  PERFORM set_config('accounts.admin_player_number', 'off', true);
  INSERT INTO accounts.admin_log (action, user_id, detail)
  VALUES ('assign_player_one', v_row.user_id, jsonb_build_object('from', v_row.player_number));
  RETURN format('%s is now #1 (was #%s, retired)', v_row.username, v_row.player_number);
END;
$$;
REVOKE ALL ON FUNCTION accounts.admin_assign_player_one(text) FROM PUBLIC, anon, authenticated, service_role;

/* ------------------------------------------------------------------ removing a person */

-- Removes one auth user and their personal data (a deleted account after 30 days, or a guest 13 months after their
-- last game). Results stay so other players' room histories still add up: every row that names the user is given one
-- fresh random id instead (NOT NULL columns) or none (nullable ones), names they chose become "Deleted player", chat
-- messages they sent are deleted, their analytics events lose their player id, and their username is held 30 days.
-- Answers false when the user is gone already.
CREATE OR REPLACE FUNCTION accounts.forget_user(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, accounts
AS $$
DECLARE
  t uuid := gen_random_uuid();
  v_key text;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = p_user_id) THEN
    RETURN false;
  END IF;
  -- Rooms (duel_presence first: its key points at duel_players').
  DELETE FROM public.duel_presence WHERE user_id = p_user_id;
  UPDATE public.duel_players SET user_id = t, display_name = 'Deleted player' WHERE user_id = p_user_id;
  UPDATE public.duels SET host_user_id = t WHERE host_user_id = p_user_id;
  UPDATE public.duel_players_archive SET user_id = t, display_name = 'Deleted player' WHERE user_id = p_user_id;
  UPDATE public.round_results_archive SET user_id = t WHERE user_id = p_user_id;
  UPDATE public.room_joins SET user_id = t WHERE user_id = p_user_id;
  -- Chat: their messages go; their reports stay, detached.
  DELETE FROM public.room_messages WHERE sender_user_id = p_user_id;
  UPDATE public.room_reports SET reporter_user_id = t WHERE reporter_user_id = p_user_id;
  -- The daily, async rooms and challenges.
  UPDATE public.async_attempts SET user_id = t, display_name = 'Deleted player' WHERE user_id = p_user_id;
  UPDATE public.async_results SET user_id = t WHERE user_id = p_user_id;
  UPDATE public.async_events SET user_id = NULL WHERE user_id = p_user_id;
  UPDATE public.async_rooms SET created_by = t WHERE created_by = p_user_id;
  UPDATE public.challenges SET created_by = t WHERE created_by = p_user_id;
  UPDATE public.challenge_events SET user_id = t WHERE user_id = p_user_id;
  -- Practice and the beta records.
  UPDATE public.practice_plays SET user_id = NULL WHERE user_id = p_user_id;
  UPDATE public.share_events SET user_id = t WHERE user_id = p_user_id;
  UPDATE public.terms_events SET user_id = t WHERE user_id = p_user_id;
  DELETE FROM public.rate_limit_hits WHERE user_id = p_user_id;
  -- Analytics (written by the analytics migration; skipped on a database without it).
  IF to_regclass('analytics.events') IS NOT NULL THEN
    EXECUTE 'UPDATE analytics.events SET player_id = NULL WHERE player_id = $1' USING p_user_id;
  END IF;
  -- The account: its name held 30 days for nobody, its admin log entries and profile removed, then the auth user.
  SELECT username_key INTO v_key FROM public.profiles WHERE user_id = p_user_id;
  IF v_key IS NOT NULL THEN
    INSERT INTO accounts.username_holds (username_key, user_id, released_at, held_until)
    VALUES (v_key, NULL, now(), now() + interval '30 days')
    ON CONFLICT (username_key) DO UPDATE SET user_id = NULL, released_at = now(), held_until = now() + interval '30 days';
  END IF;
  UPDATE accounts.username_holds SET user_id = NULL WHERE user_id = p_user_id;
  DELETE FROM accounts.admin_log WHERE user_id = p_user_id;
  DELETE FROM public.profiles WHERE user_id = p_user_id;
  DELETE FROM auth.users WHERE id = p_user_id;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION accounts.forget_user(uuid) FROM PUBLIC, anon, authenticated, service_role;

-- Accounts whose deletion was asked for 30 or more days ago.
CREATE OR REPLACE FUNCTION accounts.accounts_due(p_limit integer)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT user_id FROM public.profiles
   WHERE deletion_requested_at IS NOT NULL AND deletion_requested_at <= now() - interval '30 days'
   ORDER BY deletion_requested_at
   LIMIT p_limit;
$$;
REVOKE ALL ON FUNCTION accounts.accounts_due(integer) FROM PUBLIC, anon, authenticated, service_role;

-- Guests (anonymous auth users with no profile) whose last game, and last sign-in, were 13 or more months ago.
-- Never an account: a user with a profile, or a permanent (non-anonymous) auth user, is never returned.
CREATE OR REPLACE FUNCTION accounts.guests_due(p_limit integer)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT u.id
    FROM auth.users u
   WHERE u.is_anonymous IS TRUE
     AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = u.id)
     AND greatest(u.created_at, u.last_sign_in_at,
           (SELECT max(greatest(dp.joined_at, dp.last_seen_at)) FROM public.duel_players dp WHERE dp.user_id = u.id),
           (SELECT max(rj.joined_at) FROM public.room_joins rj WHERE rj.user_id = u.id),
           (SELECT max(coalesce(aa.finished_at, aa.started_at)) FROM public.async_attempts aa WHERE aa.user_id = u.id),
           (SELECT max(pp.created_at) FROM public.practice_plays pp WHERE pp.user_id = u.id),
           (SELECT max(dpr.last_seen_at) FROM public.duel_presence dpr WHERE dpr.user_id = u.id))
         <= now() - interval '13 months'
   ORDER BY u.created_at
   LIMIT p_limit;
$$;
REVOKE ALL ON FUNCTION accounts.guests_due(integer) FROM PUBLIC, anon, authenticated, service_role;

-- The daily job: up to p_limit accounts and p_limit guests a run, then expired username holds. Answers the counts.
CREATE OR REPLACE FUNCTION accounts.run_daily_cleanup(p_limit integer DEFAULT 500)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, accounts
AS $$
DECLARE
  v_id uuid;
  n_accounts integer := 0;
  n_guests integer := 0;
  n_holds integer := 0;
BEGIN
  FOR v_id IN SELECT accounts.accounts_due(p_limit) LOOP
    IF accounts.forget_user(v_id) THEN n_accounts := n_accounts + 1; END IF;
  END LOOP;
  FOR v_id IN SELECT accounts.guests_due(p_limit) LOOP
    IF accounts.forget_user(v_id) THEN n_guests := n_guests + 1; END IF;
  END LOOP;
  DELETE FROM accounts.username_holds WHERE held_until <= now();
  GET DIAGNOSTICS n_holds = ROW_COUNT;
  RETURN jsonb_build_object('accounts', n_accounts, 'guests', n_guests, 'holds_released', n_holds);
END;
$$;
REVOKE ALL ON FUNCTION accounts.run_daily_cleanup(integer) FROM PUBLIC, anon, authenticated, service_role;

-- pg_cron where the database offers it (Supabase does), as the analytics retention job. Without it this only notes a
-- warning in the deploy log (migration_log.note), so the from-scratch proof still applies.
DO $cleanup$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
      PERFORM cron.schedule('account-cleanup', '41 3 * * *', 'SELECT accounts.run_daily_cleanup()');
    EXCEPTION WHEN OTHERS THEN
      PERFORM migration_log.note('warning', format('account clean-up not scheduled (pg_cron: %s); see docs/accounts/README.md', SQLERRM));
    END;
  ELSE
    PERFORM migration_log.note('warning', 'account clean-up not scheduled: pg_cron is not available on this database; see docs/accounts/README.md');
  END IF;
END
$cleanup$;
