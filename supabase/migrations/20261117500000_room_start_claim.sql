-- Rooms claimed before they are dealt (13 Nov 2026, Security C1a; src/lib/duel/duel.functions.ts startRoomFn).
--
-- The host's Start first takes a claim on the room (claim_room_deal), then builds the rounds, then writes the start in
-- one transaction (start_dealt_room): the room row, the private halves and the public halves, all or nothing. While a
-- fresh claim stands (60 s, DEAL_CLAIM_MS in src/lib/duel/dealClaim.ts) the lobby shows "Dealing…" and the room's
-- settings changes are refused; a change that lands anyway between the read and the claim makes the start give the
-- claim back, so a room never starts on settings other than the ones it was dealt from. A claim older than 60 s is
-- treated as abandoned.
--
-- New rooms keep their public halves in duel_secrets.puzzles_public until each round is released
-- (20261117500100_round_puzzle_release.sql); a null there marks a room started before this, whose duels.puzzles_public
-- holds every round as it always did. Nothing stored is rewritten.
--
-- duels.deal_origin_id is the room whose deal a room plays: itself, or, for a recorded rated match, the room it copied
-- (that room's own origin). Recorded runs never come from a deal a player has already played
-- (20261117500200_recorded_run_origins.sql). Additive only: new columns and functions.

ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS start_claimed_at timestamptz;
ALTER TABLE public.duels ADD COLUMN IF NOT EXISTS deal_origin_id uuid;
ALTER TABLE public.duel_secrets ADD COLUMN IF NOT EXISTS puzzles_public jsonb;

-- The claim: taken only on a waiting room with no fresh claim. Returns the claim stamp and what the deal reads (the
-- settings and scoring as they stood when the claim was taken), or no row.
CREATE OR REPLACE FUNCTION public.claim_room_deal(p_room_id uuid, p_now timestamptz, p_stale_ms integer)
RETURNS TABLE (claimed_at timestamptz, selected_categories jsonb, host_user_id uuid)
LANGUAGE sql SET search_path = public AS $$
  UPDATE public.duels d
     SET start_claimed_at = p_now
   WHERE d.id = p_room_id
     AND d.status = 'waiting'
     AND d.disbanded_at IS NULL
     AND (d.start_claimed_at IS NULL OR d.start_claimed_at < p_now - make_interval(secs => p_stale_ms / 1000.0))
  RETURNING d.start_claimed_at, d.selected_categories, d.host_user_id
$$;

-- A claim given back (the build failed, or the start was refused): only the exact claim, so a newer one is untouched.
CREATE OR REPLACE FUNCTION public.release_room_deal(p_room_id uuid, p_claim timestamptz)
RETURNS boolean LANGUAGE sql SET search_path = public AS $$
  WITH released AS (
    UPDATE public.duels SET start_claimed_at = NULL
     WHERE id = p_room_id AND start_claimed_at = p_claim
    RETURNING id
  )
  SELECT EXISTS (SELECT 1 FROM released)
$$;

-- The start, in one transaction: 'started', 'lost' (the room moved on, the claim isn't this one, or the settings the
-- deal read, p_selected_categories, have changed since the claim; the claim is given back for those) or 'too_few'
-- (fewer than p_min_players still in the room; the claim is given back). The room starts in p_phase, its Prepare to
-- Duel phase 'starting' (the caller names it; nothing else is accepted).
CREATE OR REPLACE FUNCTION public.start_dealt_room(
  p_room_id uuid,
  p_claim timestamptz,
  p_round_order jsonb,
  p_puzzles_public jsonb,
  p_puzzles_private jsonb,
  p_started_at timestamptz,
  p_min_players integer,
  p_phase text,
  p_deal_origin uuid DEFAULT NULL,
  p_selected_categories jsonb DEFAULT NULL
)
RETURNS text LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_room public.duels%ROWTYPE;
  v_present integer;
BEGIN
  IF p_phase IS DISTINCT FROM 'starting' THEN
    RAISE EXCEPTION 'a room starts in its starting phase';
  END IF;
  SELECT * INTO v_room FROM public.duels WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND OR v_room.status <> 'waiting' OR v_room.disbanded_at IS NOT NULL
     OR v_room.start_claimed_at IS DISTINCT FROM p_claim THEN
    RETURN 'lost';
  END IF;
  IF p_selected_categories IS NOT NULL AND v_room.selected_categories IS DISTINCT FROM p_selected_categories THEN
    UPDATE public.duels SET start_claimed_at = NULL WHERE id = p_room_id;
    RETURN 'lost';
  END IF;
  SELECT count(*) INTO v_present FROM public.duel_players WHERE duel_id = p_room_id AND status <> 'left';
  IF v_present < p_min_players THEN
    UPDATE public.duels SET start_claimed_at = NULL WHERE id = p_room_id;
    RETURN 'too_few';
  END IF;
  UPDATE public.duels
     SET round_order = p_round_order,
         round_count = jsonb_array_length(p_round_order),
         puzzles_public = '[]'::jsonb,
         status = 'in_progress',
         current_round = 1,
         phase = p_phase,
         phase_started_at = p_started_at,
         round_started_at = p_started_at,
         start_claimed_at = NULL,
         deal_origin_id = coalesce(p_deal_origin, p_room_id)
   WHERE id = p_room_id;
  INSERT INTO public.duel_secrets (duel_id, puzzles_private, puzzles_public)
  VALUES (p_room_id, p_puzzles_private, p_puzzles_public)
  ON CONFLICT (duel_id) DO UPDATE
    SET puzzles_private = EXCLUDED.puzzles_private, puzzles_public = EXCLUDED.puzzles_public;
  RETURN 'started';
END;
$$;

REVOKE ALL ON FUNCTION public.claim_room_deal(uuid, timestamptz, integer) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.release_room_deal(uuid, timestamptz) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.start_dealt_room(uuid, timestamptz, jsonb, jsonb, jsonb, timestamptz, integer, text, uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_room_deal(uuid, timestamptz, integer) TO service_role;
GRANT EXECUTE ON FUNCTION public.release_room_deal(uuid, timestamptz) TO service_role;
GRANT EXECUTE ON FUNCTION public.start_dealt_room(uuid, timestamptz, jsonb, jsonb, jsonb, timestamptz, integer, text, uuid, jsonb)
  TO service_role;
