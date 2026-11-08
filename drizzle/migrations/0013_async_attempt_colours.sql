-- Daily and challenge attempts take the colour wheel's 32 swatches (8 Nov 2026, the security audit's M8).
-- WRITTEN BUT NOT APPLIED until Joe applies it in Lovable. Apply it after 20261021130000_async_rooms_daily.sql.
--
-- 20261021130000 created async_attempts.colour with CHECK (colour BETWEEN 0 AND 9), but phones offer 0–31 since
-- 31 Oct (PLAYER_COLOURS in src/lib/duel/playerLook.ts), so a player with a wheel colour of 10 or more could not
-- start a daily or a challenge. The server now stores such a colour as none until this is applied
-- (insertAttemptRow in src/lib/duel/asyncRoom.server.ts), so applying it is safe at any time; afterwards the
-- chosen colour is kept. No stored row changes (rule 4): every existing colour is already 0–9 or null.

DO $$
BEGIN
  IF to_regclass('public.async_attempts') IS NOT NULL THEN
    -- The inline CHECK's generated name, and this file's own name if it was applied before.
    ALTER TABLE public.async_attempts DROP CONSTRAINT IF EXISTS async_attempts_colour_check;
    ALTER TABLE public.async_attempts DROP CONSTRAINT IF EXISTS async_attempts_colour_range;
    ALTER TABLE public.async_attempts
      ADD CONSTRAINT async_attempts_colour_range CHECK (colour IS NULL OR colour BETWEEN 0 AND 31);
  END IF;
END
$$;
