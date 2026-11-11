-- Async attempts: a phone reads its own attempt, and other players' attempts only once they are finished (on a
-- board open to it, as before). Nothing in the app reads this table with a phone's token; the server uses the
-- service role. Additive: one policy replaced, no data touched.

DO $$
BEGIN
  IF to_regclass('public.async_attempts') IS NOT NULL THEN
    DROP POLICY IF EXISTS async_attempts_read ON public.async_attempts;
    CREATE POLICY async_attempts_read ON public.async_attempts FOR SELECT TO authenticated
      USING (user_id = auth.uid() OR (finished_at IS NOT NULL AND public.async_board_open(room_id)));
  END IF;
END
$$;
