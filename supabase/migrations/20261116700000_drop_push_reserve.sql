-- Phone notifications' unused reservation, 13 Nov 2026 (approved by Joe, 13 Nov 2026: the checks and infrastructure
-- session, item 8). public.push_reserve was replaced by public.push_reserve_at (20261112130000_push_reserve_at.sql:
-- one clock for the cap's count and the log row's stamp) and nothing calls it any more: not the app or the server
-- (src/lib/data/push.server.ts calls push_reserve_at only), not a check, not another function's body, not a cron job
-- (the only push job runs push_log_retention). No CASCADE: if anything did depend on it, this would stop here.
-- No table, column or row is touched; push_reserve_at, the log and every other push function stay as they are.

DROP FUNCTION IF EXISTS public.push_reserve(uuid, text, boolean, timestamptz, integer, text);
