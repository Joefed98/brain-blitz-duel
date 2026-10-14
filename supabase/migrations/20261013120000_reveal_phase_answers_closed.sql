-- Other players' round_results rows (answers included) become readable only once
-- the round has closed for everyone: the results screen ('result') or later.
-- The submit server function still takes a lagging phone's answer during the
-- 'reveal' phase, so 'reveal' no longer opens the round (found in #43).
-- Mirrors src/lib/replay/access.ts replayRoundClosed and
-- src/lib/duel/answerWindow.ts; proved by scripts/reveal-window-check.ts.
-- A player's own row stays readable throughout (my_duel_slot in the policy).
CREATE OR REPLACE FUNCTION public.duel_round_ended(_duel_id uuid, _round integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_duel_participant(_duel_id) AND _round >= 1 AND EXISTS (
    SELECT 1 FROM public.duels d
    WHERE d.id = _duel_id
      AND (
        d.status = 'finished'
        OR (
          d.status = 'in_progress'
          AND (
            d.current_round > _round
            OR (d.current_round = _round AND d.phase IN ('result', 'standings', 'winner_reveal'))
          )
        )
      )
  )
$function$;
