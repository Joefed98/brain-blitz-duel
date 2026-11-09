-- Notes a migration wants in the deploy log (9 Nov 2026; docs/supabase-move/migrations-ci.md "Notices and warnings").
--
-- scripts/migrate.ts applies migrations to the London project through the Management API, which answers with rows
-- only: a plain RAISE NOTICE or RAISE WARNING never reaches the deploy log. A migration that wants a message there
-- calls this instead, at the same level:
--
--   SELECT migration_log.note('warning', 'kept 3 rows with no owner');
--   -- or inside DO / plpgsql:  PERFORM migration_log.note('notice', format('%s rows moved', n));
--
-- It raises the message as RAISE would (so psql and the local run show it as before) and keeps a row, which the
-- live run reads back after the file and prints under it. The rows of a file that fails roll back with it.
-- Nothing here is exposed to the app: the schema isn't in PostgREST's list, and only the owner can use it.

CREATE SCHEMA IF NOT EXISTS migration_log;
REVOKE ALL ON SCHEMA migration_log FROM PUBLIC;

CREATE TABLE IF NOT EXISTS migration_log.notes (
  id bigserial PRIMARY KEY,
  level text NOT NULL CHECK (level IN ('NOTICE', 'WARNING')),
  message text NOT NULL,
  noted_at timestamptz NOT NULL DEFAULT now()
);
REVOKE ALL ON TABLE migration_log.notes FROM PUBLIC;

CREATE OR REPLACE FUNCTION migration_log.note(level text, message text) RETURNS void
LANGUAGE plpgsql
SET search_path = ''
AS $$
DECLARE
  lvl text := upper(coalesce(level, ''));
BEGIN
  IF lvl NOT IN ('NOTICE', 'WARNING') THEN
    RAISE EXCEPTION 'migration_log.note: level must be notice or warning, not %', level;
  END IF;
  INSERT INTO migration_log.notes (level, message) VALUES (lvl, coalesce(message, ''));
  IF lvl = 'WARNING' THEN
    RAISE WARNING '%', message;
  ELSE
    RAISE NOTICE '%', message;
  END IF;
END
$$;
REVOKE ALL ON FUNCTION migration_log.note(text, text) FROM PUBLIC;
