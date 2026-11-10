-- Chat and report retention (Wave 1, train 2, session 4; 10 Nov 2026; the privacy policy agreed on 9 Nov 2026;
-- docs/moderation.md "Retention"). Non-destructive to apply: it only creates one function and schedules it; nothing is
-- deleted when this file runs.
--
-- moderation.run_retention() runs daily at 04:17 UTC (pg_cron job `chat-retention`):
--   * room chat messages older than 90 days are deleted, except a message a report points at (kept with the report);
--   * reports, and moderation action lines, are deleted 2 years after they were made (a report's message then goes on
--     the next run, once it is past 90 days).
-- Every run writes one moderation.actions line ('retention', by 'system') with the counts. Deliberately destructive at
-- run time, like the analytics and account clean-ups: every statement in it has a WHERE.

CREATE OR REPLACE FUNCTION moderation.run_retention()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, moderation
AS $$
DECLARE
  n_reports integer := 0;
  n_actions integer := 0;
  n_messages integer := 0;
  v_out jsonb;
BEGIN
  DELETE FROM public.room_reports WHERE created_at < now() - interval '2 years';
  GET DIAGNOSTICS n_reports = ROW_COUNT;
  DELETE FROM moderation.actions WHERE at < now() - interval '2 years';
  GET DIAGNOSTICS n_actions = ROW_COUNT;
  DELETE FROM public.room_messages m
   WHERE m.created_at < now() - interval '90 days'
     AND NOT EXISTS (SELECT 1 FROM public.room_reports r WHERE r.message_id = m.id);
  GET DIAGNOSTICS n_messages = ROW_COUNT;
  v_out := jsonb_build_object('messages', n_messages, 'reports', n_reports, 'actions', n_actions);
  INSERT INTO moderation.actions (action, user_id, report_id, detail, by_role)
  VALUES ('retention', NULL, NULL, v_out, 'system');
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION moderation.run_retention() FROM PUBLIC, anon, authenticated, service_role;

-- pg_cron where the database offers it (Supabase does), as the analytics and account jobs. Without it this only notes
-- a warning in the deploy log (migration_log.note).
DO $retention$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_cron') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_cron WITH SCHEMA pg_catalog;
      PERFORM cron.schedule('chat-retention', '17 4 * * *', 'SELECT moderation.run_retention()');
    EXCEPTION WHEN OTHERS THEN
      PERFORM migration_log.note('warning', format('chat retention not scheduled (pg_cron: %s); see docs/moderation.md', SQLERRM));
    END;
  ELSE
    PERFORM migration_log.note('warning', 'chat retention not scheduled: pg_cron is not available on this database; see docs/moderation.md');
  END IF;
END
$retention$;
