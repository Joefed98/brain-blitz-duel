-- The Daily board badges become earnable (wave 4, session W4a; 11 Nov 2026; docs/leaderboards.md, docs/badges/README.md
-- "A new badge rule"). Non-destructive and idempotent: it flips the two catalogue rows C2 seeded as waiting for the
-- Daily boards (20261111220000_badges_titles.sql) to earnable; no player's row is touched and nothing is awarded here.
--
-- Daily Champion: first on a final Daily board that counted 100 or more players. Daily Top 100: in the top 100 of a
-- final Daily board that counted 500 or more (field sizes decided 11 Nov 2026). The rules are in
-- src/lib/badges/rules.server.ts, read from public.daily_board_badge_facts (20261115100000_leaderboards.sql), and
-- awarded through C2's badge_award by syncBadges, like every other rule.

UPDATE public.badges
   SET status = 'earnable', waits_for = NULL
 WHERE slug IN ('daily-champion', 'daily-top-100') AND status = 'waits';
