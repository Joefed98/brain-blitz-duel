-- Room codes with digits (7 Nov 2026, from the design audit): new rooms take their four characters from
-- the challenge codes' alphabet (no I, L, O, 0 or 1; src/lib/duel/roomCode.ts). duels.room_code has no
-- format check, so rooms need nothing here; share_events.room_code (20261021120000_beta_share_events.sql)
-- only took four letters, so a share from a new room would be refused. Widened to four capital letters or
-- digits, which every existing row (four letters) still meets. No stored row is changed. Safe to apply
-- whether or not 20261021120000 has been: it does nothing without the table.

DO $$
BEGIN
  IF to_regclass('public.share_events') IS NOT NULL THEN
    ALTER TABLE public.share_events DROP CONSTRAINT IF EXISTS share_events_room_code_check;
    ALTER TABLE public.share_events
      ADD CONSTRAINT share_events_room_code_check CHECK (room_code IS NULL OR room_code ~ '^[A-Z0-9]{4}$');
  END IF;
END $$;
