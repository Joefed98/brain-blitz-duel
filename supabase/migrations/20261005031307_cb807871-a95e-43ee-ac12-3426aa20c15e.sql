CREATE OR REPLACE FUNCTION public.duel_round_ended(_duel_id uuid, _round integer)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  SELECT public.is_duel_participant(_duel_id) AND EXISTS (
    SELECT 1 FROM public.duels d
    WHERE d.id = _duel_id
      AND (
        d.status = 'finished'
        OR d.current_round > _round
        OR (d.current_round = _round AND d.phase IN ('reveal', 'result', 'standings'))
      )
  )
$function$;