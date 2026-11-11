# Analytics (Wave 0 night 2, 9 Nov 2026)

Our own analytics in Supabase, written mostly by the server, so we can see who plays, what they play and where they
drop off. Nothing players see changes. The beta tables (`docs/beta-sql.md`) are untouched and still written; these
events go alongside them.

## Where it lives

| Piece | File |
|---|---|
| Table, write RPC, view, retention, pg_cron job | `supabase/migrations/20261109140000_analytics_events.sql` |
| The one writer (fire-and-forget) | `src/lib/data/events.server.ts` (`recordEvents`) |
| The event list (phone and server) | `src/lib/analytics/events.ts` |
| Phone events: server function and rules | `src/lib/analytics/analytics.functions.ts` (`recordClientEventsFn`), `clientEvents.server.ts` |
| Phone events: the queue | `src/lib/analytics/clientEvents.ts` (`trackClientEvent`) |
| Check | `scripts/analytics-events-check.ts` |

## Privacy

- Schema `analytics` is not in the API's exposed schemas, and anon / authenticated have no grant on the schema, the
  table, the view or the functions. The server writes through `public.record_analytics_events(jsonb)`, which only
  `service_role` may execute (security definer; at most 50 rows a call). Even `service_role` can't read the table:
  it's read in the dashboard (as `postgres`).
- RLS is on with no policies.
- Stored: event, occurred_at, received_at, player_id (the Supabase auth user id; anonymous players have one),
  game, mode, score, completed, duration_ms, room_id, app_version (the build id), platform (`ios` / `android` /
  `desktop`, worked out on the server from the user agent, which is then dropped), input_type, props (a small object).
- Never stored: emails, IP addresses, user agents, names. The view reads names from the existing tables.

## The events

| Event | Recorded by | Where |
|---|---|---|
| `room_created` | server | `createRoomFn` (duel.functions.ts) |
| `room_joined` | server | `joinRoomFn`, a new seat or a rejoin (`props.via`, `props.rejoin`) |
| `room_started` | server | `startRoomFn`, the claimed start only (`props.players`, `rounds`, `game_index`) |
| `game_started` | server | rooms: `advancePhaseFn` intro → puzzle, one row per active player (`props.round`); daily / challenge: `startAsyncRound` (asyncRoom.server.ts); practice: `practiceStartFn` |
| `game_finished` | server | rooms: `submitAnswerFn` after the result is stored; daily / challenge: `submitAsyncAnswer`; practice: `practiceGradeFn`. Score and completed are the server's grade; duration is the clock less what was left (an arcade run's own length when stored) |
| `room_finished` | server | the room's end: winner reveal reached or last standings (roomPhase.server.ts, `reason: completed`), Finish now, the host leaving or disbanding mid-game |
| `daily_started` | server | `startAttempt` for a daily room, the first start only |
| `daily_finished` | server | the attempt's last round stored (`refreshAttempt`), with the total |
| `challenge_created` | server | `createChallenge` and `createChallengeFromRoom` (challenge.server.ts; `props.source` play / room) |
| `challenge_played` | server | a challenge attempt's last round stored, with the total (the creator's own play too; room players copied into a room's challenge are not plays) |
| `app_opened` | phone | the root route, once a page load (`props.standalone`) |
| `share_tapped` | phone | `sendShareEvent` (shareRef.ts), with the beta `share_tap` (`props.source`, `method`) |
| `invite_opened` | phone | `sendShareEvent`, with the beta `arrival` (a shared room, daily or challenge link; `props.source`, `landing`) |
| `error_shown` | phone | `ErrorState` (`not_found`, `room_not_found`, `challenge_not_found`) and the root error boundary (`page_error`); a short code only, never a message or stack |
| `offline_game_played` | phone | `queueRun` (offline/queue.ts): a run played from a pack or with no connection, queued with its own time |
| `sign_up_started` | server | `startSignUp` (src/lib/account/account.server.ts): sign-up's first step passed, before any email (`props.method`); added by `20261110120100_analytics_account_events.sql` |
| `sign_up_completed` | server | `completeSignUp`: the profile created (`props.method`: email, google, apple) |
| `sign_in` | server | `noteSignIn`, called by the phone after verifying a sign-in (`props.method`) |
| `sign_out` | server | `noteSignOut`, called by the phone just before it signs out |
| `username_changed` | server | `changeUsername` (`props.kind`: free or limited; a forced rename records none) |
| `account_deletion_requested` | server | `requestAccountDeletion`, the first request only |
| `under_thirteen_refused` | server | a date of birth under 13 at sign-up; never a date of birth or an age (named without digits: the event check reads names as `[a-z_]+`) |
| `report_sent` | server | a player reports a message or a name (docs/moderation.md); props `reason` only, never the message or who was reported |
| `chat_muted` | server | the automatic mute starts (three players' reports within 24 hours); the muted player, nothing more |
| `moderation_action` | database | every moderation action (Joe's functions, the automatic mute, the server's steps, retention excluded); props `type` only, no player |
| `save_progress_shown` | server | the "Save your progress" sheet or pop-up shown on a result (`props.prompt` sheet / popup, `props.from` room / daily / challenge), through `recordSaveProgressFn` (src/lib/account/saveProgress.functions.ts: these three only, fixed words only, rate limited); added by `20261110130000_analytics_save_progress_events.sql` |
| `save_progress_tapped` | server | a sign-up way tapped on that sheet or pop-up (`props.method` email / google / apple) |
| `save_progress_dismissed` | server | "Not now" (or the sheet dragged away) |
| `coins_credited` | server / database | coins credited to an account (src/lib/economy/economy.server.ts helpers, Joe's economy functions, refunds); props `reason`, `amount` |
| `coins_spent` | server / database | coins spent (a spend, a shop purchase, a downward admin adjustment); props `reason`, `amount` |
| `item_granted` | server / database | an item added to an inventory (starter items at sign-up, a purchase, the pass, earned, Joe's grant); props `kind`, `rarity`, `source` |
| `item_equipped` | server | an item equipped in a loadout slot (not an unequip); props `kind` |
| `challenge_completed` | server | a server-graded Practice run completed a practice challenge (src/lib/challenges/challenges.server.ts); `game`, mode `practice`, props `challenge` (its id), `level`, `coins` (paid with it; 0 for a guest, whose coins are paid on becoming an account) |
| `leaderboard_viewed` | server | a rating board opened (src/lib/leaderboards/leaderboards.server.ts; the first page only, not further pages); props `board` (joulz, puzzles, arcade or a category), `scope` (global, country, friends), `period` (season, peak) |
| `daily_board_viewed` | server | a Daily top 100 opened (src/lib/leaderboards/leaderboards.server.ts); props `kind` (puzzle, arcade), `day` (YYYY-MM-DD) |
| `rated_match_finished` | server | a rated match was recorded (src/lib/rated/ratings.server.ts), one per live player; props `format` (bo3 / bo5 / bo7 / 4p / 8p), `choice` (mixed / puzzles / arcade), `result` (win / loss / draw), `opponent` (live / recorded) |
| `placement_finished` | server | a player's 5th placement match was recorded; props `tier` (the tier revealed) |
| `tier_changed` | server | a placed player's shown tier changed, after a match or in the standings job; props `from`, `to` (tier ids) |

Mode is `room`, `daily`, `challenge` or `practice` (`rated` comes later with its own migration).

### Phone events

`recordClientEventsFn` (signed-in devices only) accepts at most 20 events a call and only the five phone events.
Every other event, the server-side ones included, is refused, as is any field beyond `event`, `at`, `game` and
`props` (a score, a result, a player id), a score-like prop, a game outside the catalogue, a nested prop or an
error code that isn't a short code. A queued event keeps its time if it is under 30 days old (a time slightly ahead
is held to now). It is rate limited per device through `take_rate_limit` (`ANALYTICS_CLIENT_LIMIT`, 30 calls per
10 minutes). The phone queues events in device storage (`duelz-analytics-queue:v1`, at most 100, the oldest
dropped), sends them 3 s after the last one, and sends again when it comes back online. A browser under automation
(`navigator.webdriver`) queues but doesn't send unless `window.__DUELZ_ALLOW_ANALYTICS__` is set.

### Fire-and-forget

`recordEvents` returns at once and never throws. The write runs in the background (on Cloudflare it's handed to the
request's `waitUntil`), is abandoned after 3 s, and any failure is logged as `[analytics] …`. The check proves a
failing, refused or hanging write changes no response.

## The player activity view

A player is anyone with at least one `game_started`. `analytics.player_activity` has one row per player:
`player_id`, `name` (the latest display name from `duel_players` / `async_attempts`; wave 1's username column goes
first there, see the comment in the migration), `first_seen` (first event of any kind), `last_played` (last
`game_started`), `games_played`, `favourite_games` (top 3 by count, ties by name) and `days_active` (UK days with a
game).

In the dashboard, open the SQL editor:

```sql
SELECT * FROM analytics.player_activity ORDER BY last_played DESC;
```

The table editor shows it too once `analytics` is picked in its schema list.

Some starting queries:

```sql
-- Games started and finished per day and mode (drop-off is started minus finished).
SELECT date_trunc('day', occurred_at) AS day, mode,
       count(*) FILTER (WHERE event = 'game_started') AS started,
       count(*) FILTER (WHERE event = 'game_finished') AS finished
  FROM analytics.events GROUP BY 1, 2 ORDER BY 1 DESC, 2;

-- Most played games this week.
SELECT game, count(*) FROM analytics.events
 WHERE event = 'game_started' AND occurred_at > now() - interval '7 days'
 GROUP BY game ORDER BY 2 DESC;
```

## Retention

Raw events older than 13 months are deleted daily by `analytics.purge_old_events()`, scheduled at 03:17 UTC by
pg_cron as the job `analytics-retention`. The migration enables pg_cron (`CREATE EXTENSION IF NOT EXISTS pg_cron
WITH SCHEMA pg_catalog`) and schedules the job only where the database offers the extension. If it can't, it raises a
warning and carries on, so the local from-scratch proof (a plain PostgreSQL with no pg_cron) still applies.

After the deploy, check on the London project:

```sql
SELECT jobname, schedule, command FROM cron.job WHERE jobname = 'analytics-retention';
```

If no row comes back, pg_cron couldn't be enabled there. The proposed alternative, not built: a Cloudflare cron
trigger (`[triggers] crons` in wrangler, nitro's `cloudflare:scheduled` hook) calling `analytics.purge_old_events()`
through a service-role RPC. Building it needs Joe's approval.
