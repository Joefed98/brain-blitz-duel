-- The input type a result was played with (31 Oct 2026, the computer layout; docs/desktop-layout.md):
-- "touch", "mouse", "keyboard" or a mix ("mouse+keyboard"), so leaderboards can be split by device later.
-- Recording only: grading and scoring never read it. New nullable columns, no default: every stored row
-- keeps its values (nothing is rewritten), and rows from before this migration stay null.
-- Until this is applied the server's best-effort writes (src/lib/duel/inputType.server.ts) fail quietly
-- and nothing else changes. RLS is unchanged (clients never write these tables).

alter table public.round_results add column if not exists input_type text;
-- Play again's archive keeps every round_results column (beta-recording-check). restart_duel_room is not
-- redefined here, so it does not copy input_type yet: an archived round's input_type stays null (a follow-up).
alter table public.round_results_archive add column if not exists input_type text;
alter table public.async_results add column if not exists input_type text;
alter table public.practice_plays add column if not exists input_type text;

alter table public.round_results drop constraint if exists round_results_input_type_check;
alter table public.round_results add constraint round_results_input_type_check
  check (input_type is null or input_type ~ '^(touch|mouse|keyboard)(\+(mouse|keyboard))*$');
alter table public.async_results drop constraint if exists async_results_input_type_check;
alter table public.async_results add constraint async_results_input_type_check
  check (input_type is null or input_type ~ '^(touch|mouse|keyboard)(\+(mouse|keyboard))*$');
alter table public.practice_plays drop constraint if exists practice_plays_input_type_check;
alter table public.practice_plays add constraint practice_plays_input_type_check
  check (input_type is null or input_type ~ '^(touch|mouse|keyboard)(\+(mouse|keyboard))*$');
