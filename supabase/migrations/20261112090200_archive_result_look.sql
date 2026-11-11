-- Archived rounds keep their look (wave 2, E1; 11 Nov 2026, Joe; docs/skins.md "Replays and ghosts").
--
-- round_results gained `look` in 20261112090100_result_looks.sql; Play again's archive (restart_duel_room) copies
-- every round_results column into round_results_archive, so the archive gets the column too. restart_duel_room is
-- left exactly as it is: a BEFORE INSERT trigger on the archive copies the look from the result row being archived
-- (same id; the archive insert runs before the results are deleted). Display only; nothing reads it to grade,
-- score, rank or deal. Rows archived before this keep a null look; nothing stored is changed.

ALTER TABLE public.round_results_archive ADD COLUMN IF NOT EXISTS look jsonb;

CREATE OR REPLACE FUNCTION public.round_result_archive_look()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.look IS NULL THEN
    BEGIN
      NEW.look := (SELECT r.look FROM public.round_results r WHERE r.id = NEW.id);
    EXCEPTION WHEN OTHERS THEN
      NEW.look := NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.round_result_archive_look() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS round_result_archive_look ON public.round_results_archive;
CREATE TRIGGER round_result_archive_look BEFORE INSERT ON public.round_results_archive
  FOR EACH ROW EXECUTE FUNCTION public.round_result_archive_look();
