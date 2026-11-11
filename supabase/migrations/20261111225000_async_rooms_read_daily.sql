-- Async rooms: phones may read the window columns of the daily rooms only. A challenge's room is
-- reached through the server (its code), never listed directly. Nothing in the app reads this table
-- with a phone's own token; the server uses the service role. Additive: one policy replaced, no data
-- touched.

DO $$
BEGIN
  IF to_regclass('public.async_rooms') IS NOT NULL THEN
    DROP POLICY IF EXISTS async_rooms_read ON public.async_rooms;
    CREATE POLICY async_rooms_read ON public.async_rooms FOR SELECT TO authenticated
      USING (kind IN ('daily_puzzle', 'daily_arcade'));
  END IF;
END
$$;
