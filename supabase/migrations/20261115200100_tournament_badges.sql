-- Tournament badges become earnable (wave 4, W4b; 11 Nov 2026; Joe's approval in the W4b prompt, recorded in
-- scripts/badges-check.ts with the date). Non-destructive: seven existing rows of public.badges move from 'waits'
-- (waits_for 'tournaments') to 'earnable' (waits_for NULL); nothing else changes, no row is added or removed.
--
-- Entrant, Trophy Hunter, Arena Ace, Champion, Arena Champion, Score Attack Champion and Serial Winner are awarded by
-- the tournaments code (src/lib/tournaments/tournaments.server.ts) through public.badge_award, which already makes
-- awarding idempotent and pays a Legendary's 250 coins once. Swiss Champion and Knockout Champion keep waiting (W4c).

UPDATE public.badges
   SET status = 'earnable', waits_for = NULL
 WHERE slug IN ('entrant', 'trophy-hunter', 'arena-ace', 'champion', 'arena-champion', 'score-attack-champion', 'serial-winner')
   AND status = 'waits';
