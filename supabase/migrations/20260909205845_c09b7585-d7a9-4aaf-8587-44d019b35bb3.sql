REVOKE ALL ON FUNCTION public.is_duel_participant(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.my_duel_slot(uuid) FROM public, anon;
REVOKE ALL ON FUNCTION public.duel_round_ended(uuid, integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.is_duel_participant(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.my_duel_slot(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.duel_round_ended(uuid, integer) TO authenticated, service_role;