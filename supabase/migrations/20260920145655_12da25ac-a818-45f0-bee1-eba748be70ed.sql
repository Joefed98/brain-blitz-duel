-- Defense in depth: all room writes happen in trusted server code using the
-- service role, so browser clients must hold no write privileges at all and
-- must not reach the private tables.

REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.duels FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.duel_players FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.round_results FROM anon, authenticated;
REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.room_messages FROM anon, authenticated;
REVOKE ALL ON public.room_reports FROM anon, authenticated;
REVOKE ALL ON public.duel_secrets FROM anon, authenticated;

-- Reads stay participant-scoped through the existing policies.
GRANT SELECT ON public.duels TO authenticated;
GRANT SELECT ON public.duel_players TO authenticated;
GRANT SELECT ON public.round_results TO authenticated;
GRANT SELECT ON public.room_messages TO authenticated;

GRANT ALL ON public.duels TO service_role;
GRANT ALL ON public.duel_players TO service_role;
GRANT ALL ON public.round_results TO service_role;
GRANT ALL ON public.room_messages TO service_role;
GRANT ALL ON public.room_reports TO service_role;
GRANT ALL ON public.duel_secrets TO service_role;

-- RLS helper functions: signed-in players need EXECUTE for the read policies to
-- evaluate, but nothing else should be able to call them directly.
REVOKE ALL ON FUNCTION public.is_duel_participant(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.my_duel_slot(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.duel_round_ended(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_duel_participant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_duel_slot(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.duel_round_ended(uuid, integer) TO authenticated, service_role;

-- Write paths are server-only; make that explicit with restrictive policies so
-- a future permissive policy cannot accidentally open client writes.
DROP POLICY IF EXISTS "No client writes to duels" ON public.duels;
CREATE POLICY "No client writes to duels" ON public.duels AS RESTRICTIVE
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (false);

DROP POLICY IF EXISTS "No client writes to players" ON public.duel_players;
CREATE POLICY "No client writes to players" ON public.duel_players AS RESTRICTIVE
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (false);

DROP POLICY IF EXISTS "No client writes to results" ON public.round_results;
CREATE POLICY "No client writes to results" ON public.round_results AS RESTRICTIVE
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (false);

DROP POLICY IF EXISTS "No client writes to messages" ON public.room_messages;
CREATE POLICY "No client writes to messages" ON public.room_messages AS RESTRICTIVE
  FOR ALL TO anon, authenticated USING (true) WITH CHECK (false);