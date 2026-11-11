-- Rated play's badges become earnable (wave 3, session W3a; 11 Nov 2026; Joe's approval in the W3a brief;
-- docs/badges/catalogue.md, docs/badges/README.md "To make a badge earnable"). Additive: the 13 badges that waited
-- for rated play (First Win, Placed, Hot Streak, Comeback Kid, Clean Sweep, Podium Regular, Unstoppable, Giant Slayer,
-- Storm Chaser, Lightning Strikes, Top 500, Revenge, Photo Finish) move from waits to earnable; nothing else changes.
-- The server checks their rules from public.rated_badge_facts (src/lib/badges/rules.server.ts) and awards them through
-- public.badge_award as before. Idempotent: a second run changes nothing.
UPDATE public.badges
   SET status = 'earnable', waits_for = NULL
 WHERE slug IN ('first-win', 'placed', 'hot-streak', 'comeback-kid', 'clean-sweep', 'podium-regular', 'unstoppable',
                'giant-slayer', 'storm-chaser', 'lightning-strikes', 'top-500', 'revenge', 'photo-finish')
   AND status = 'waits' AND waits_for = 'rated-play';

DO $note$
DECLARE
  n integer;
BEGIN
  SELECT count(*) INTO n FROM public.badges WHERE status = 'earnable';
  IF to_regprocedure('migration_log.note(text, text)') IS NOT NULL THEN
    PERFORM migration_log.note('notice', format('rated badges: %s badges earnable', n));
  END IF;
END
$note$;
