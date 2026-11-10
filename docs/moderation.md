# Safety and moderation

Wave 1, train 2, session 4 (10 Nov 2026). Keeping bots out, and the tools for players and Joe to deal with bad
behaviour: reports, an automatic chat mute, and Joe's review list with warn, rename and ban. No gameplay, scoring,
stamp or room-flow change beyond refusing banned players and muted chat.

## Files

| Piece | File |
| --- | --- |
| Migration: reports' context, the `moderation` schema, the auto-mute, Joe's functions, the review list, three events | `supabase/migrations/20261110150000_moderation.sql` |
| Migration: chat and report retention (daily job) | `supabase/migrations/20261110150100_chat_retention.sql` |
| Migration: the new-guest limit (Auth hook) and its hourly purge | `supabase/migrations/20261110150200_new_guest_limit.sql` |
| Data layer: reports (extends `insertRoomReport`) | `src/lib/data/chat.server.ts` |
| Data layer: a player's moderation state | `src/lib/data/moderation.server.ts` |
| Server rules (ban, mute; fail open) | `src/lib/safety/moderation.server.ts` |
| A player's notices on open, forced rename | `src/lib/safety/safety.server.ts`, `safety.functions.ts` |
| Report reasons and notices' words | `src/lib/safety/reports.ts` |
| Chat policy (type or quick phrases) | `src/lib/safety/chatPolicy.ts` |
| Quick phrases (**for Joe to review**) | `src/lib/safety/quickPhrases.ts` |
| Turnstile: phone / server | `src/lib/safety/turnstile.ts`, `src/lib/safety/turnstile.server.ts` |
| Turnstile site key (the switch) | `src/config/safetyConfig.ts` |
| Report screens | `src/components/duel/ReportSheet.tsx`, `RoomLobby.tsx` (a name), `RoomChat.tsx` (a message) |
| Notices on open | `src/components/safety/SafetyNotices.tsx` (mounted by `src/routes/__root.tsx`) |
| Checks | `scripts/moderation-check.ts` (~5 s, PostgreSQL), `scripts/moderation-ui-check.tsx` (~3 s, happy-dom) |

## 1. Bots

### Turnstile

Guests are Supabase anonymous sign-ins and accounts use Supabase's email code, so the work is split:

- **Guest creation** (`signInAnonymously`) and **sign-in emails** (`signInWithOtp`): Supabase Auth's own captcha
  protection (Turnstile provider) checks the token. The phone sends it only while the site key is set
  (`src/lib/duel/session.ts`, `src/lib/account/auth.ts`).
- **Account sign-up**: a guest becomes an account by linking an email to its anonymous user (`updateUser`, Supabase's
  `PUT /user`), which Supabase's captcha does not cover. The account itself is made by our server's
  `completeSignUpFn`, which verifies a Turnstile token with Cloudflare when Turnstile is on
  (`turnstile.server.ts`). The sign-up screens pass `turnstileToken: await signUpTurnstileToken()` (auth.ts).
- **The switch**: `TURNSTILE_SITE_KEY` in `src/config/safetyConfig.ts`. Empty (today): no script loads, no token is
  sent, the server doesn't ask: everything behaves as before. The server's check is on only with both the site key
  and the Worker secret; a site key without the secret logs a warning and allows (so a missing secret never locks
  sign-ups).

#### What Joe sets, in this order

1. **Cloudflare dashboard → Turnstile → Add widget**: name `Joulz`; hostnames `joulz.uk` (add `playjoulz.com` and the
   workers.dev host if those should work too); **Widget mode: Invisible**; pre-clearance off. Create. Copy the
   **Site Key** and the **Secret Key**.
2. **Secret key into the Worker**: GitHub → the repo → Settings → Secrets and variables → Actions → New repository
   secret: name `TURNSTILE_SECRET_KEY`, value the secret key (no spaces or line breaks). The Deploy to Cloudflare
   workflow sends it with the next deploy (`.github/workflows/deploy-cloudflare.yml`; it is optional there, so a
   deploy without it keeps whatever the Worker has). Don't add it in the Cloudflare dashboard as well.
3. **Site key into the app**: a PR setting `TURNSTILE_SITE_KEY = "<site key>"` in `src/config/safetyConfig.ts` (it is
   public). Merge it and let it deploy. From then on account sign-up is checked by our server, and phones send tokens
   to Supabase.
4. **Only after step 3 is live**: Supabase dashboard → Authentication → **Attack Protection** (called "Bot and Abuse
   Protection" on some projects) → **Enable Captcha protection** on → provider **Turnstile by Cloudflare** → Captcha
   secret: the same secret key → Save. (Doing this before step 3 stops phones making guests.)

Undoing it: switch Supabase's captcha off first, then empty the site key.

Checks use Cloudflare's published test keys: secrets `1x0000000000000000000000000000000AA` (always passes),
`2x0000000000000000000000000000000AA` (always fails), `3x0000000000000000000000000000000AA` (token already spent);
invisible site keys `1x00000000000000000000BB` (passes) and `2x00000000000000000000BB` (blocks).

### The new-guest limit (200 an hour per network)

Supabase Auth limits anonymous sign-ins to 30 an hour per address by default. Ours is 200 an hour per network,
counted in `public.take_rate_limit` (the counter `src/lib/data/limits.server.ts` takeRateLimit calls) under the bucket
`new-guest`. Supabase Auth makes guests itself, not our server, so the count runs where Auth asks before creating any
user: its **Before User Created** hook, set to `public.before_user_created_guest_limit`. Refused: HTTP 429 "Lots of
new players from this network. Try again in a while." The numbers are `NEW_GUEST_LIMIT` in
`src/lib/duel/rateLimit.server.ts` (moderation-check proves they match).

The network key is the first 16 bytes of SHA-256('duelz-ip:' + address) as a uuid, exactly as the server's
`addressKey` (`public.network_key`). The address is never stored. Expired keys are deleted on every hook call and by
the hourly pg_cron job `new-guest-purge` (07 past the hour), so a key lives at most about an hour; it is never written
with an event or a profile.

What Joe sets (Supabase dashboard):

1. Authentication → **Auth Hooks** → Add hook → **Before User Created** → type **Postgres** → schema `public` →
   function `before_user_created_guest_limit` → enable. (The migration grants it to `supabase_auth_admin`.)
2. Authentication → **Rate Limits** → "Rate limit for anonymous users" (sign-ins per hour per IP): raise from 30 to
   **1000**, so Supabase's own limit sits above ours and ours decides.

Until the hook is set nothing changes (Supabase's 30 stays).

## 2. Chat rules

- **Rooms count as friends**: everyone in a room types, guests and under-18s included. Every message goes through the
  word filter on the server (`sendRoomMessageFn`: `cleanChatText`, then `censorChat` on what is stored). Messages can
  only be written by that server function (RLS: no client writes on `room_messages`).
- **The policy**: `chatPolicy(context, player)` in `src/lib/safety/chatPolicy.ts`. `"room"` → `"type"` for everyone.
  `"rated"` (wave 3) and `"tournament"` (wave 4), where strangers meet → `"quick_phrases"` for guests and under-18s
  (and an unknown age), `"type"` for adult accounts. The later waves call it and enforce it on the server.
- **Quick phrases**: `src/lib/safety/quickPhrases.ts`, 20 phrases with stable ids plus the room's six reactions. **Joe:
  please review the list.** Not shown in rooms.

## 3. Reports

- **Two taps**: tap another player's name in the lobby, or a chat message (a long press still works), then a reason:
  offensive name, abusive chat or cheating. The same plain thank-you whatever happens.
- **Stored** in `public.room_reports` (the existing table, new columns): the room, the message id and its text, the
  reported player and their name at the time, the reason, the UK day, whether it counts, resolution. Filed through
  `insertRoomReport` (`chat.server.ts`) → `public.file_room_report`.
- **The reporter is never revealed**: nothing a player can read names a reporter (`room_reports` has no client grant,
  the notices carry no ids).
- **Counting**: one report per reporter per reported player per UK day counts; repeats are stored and ignored for the
  mute. Self-reports, outsiders, unknown reasons and seats nobody holds are refused.
- Server functions: `reportMessageFn({ roomId, messageId, reason? })` (reason defaults to abusive chat, so older phones
  still work) and `reportPlayerFn({ roomId, slot, reason })`. Both under the existing report rate limit (20 per 10 min).

## 4. Automatic chat mute

Three counting reports for **abusive chat or offensive name**, from **three different players**, within **24 hours**:
the player's room chat (messages and reactions) is muted for 24 hours, enforced by `sendRoomMessageFn` and
`allowReactionFn`. They see "Chat is paused for 24 hours after reports from other players." in chat. Cheating
reports never mute. Joe lifts it early with `moderation.unmute`; reports filed before a mute started or was lifted
never count towards a new one. Logged as `auto_mute` by `system`.

## 5. Joe's review list (Supabase dashboard → SQL editor)

The `moderation` schema isn't exposed to the API: anon, authenticated and even the service role have nothing in it
(the server reaches it only through `public.file_room_report`, `public.moderation_status` and
`public.moderation_ack`). A player is named by their **username** (accounts, any capitals) or their **user id**
(guests: take it from the queue's `user_id`).

```sql
-- The queue: newest first, one row per reported player.
SELECT user_id, name, has_account, reasons, messages, players_reporting, reports, open_reports,
       latest_report, muted_until, banned_until, status, report_ids
  FROM moderation.report_queue;
SELECT * FROM moderation.report_queue WHERE status = 'open';

-- A one-time notice on their next open (up to 300 characters).
SELECT moderation.warn('Spammer99', 'Keep chat friendly, please.');

-- A temporary energy name on their next open, then they must pick a new one (doesn't count towards their changes).
SELECT moderation.force_rename('BadName');
SELECT moderation.force_rename('3f0c6a8e-1d2b-4c5d-9e8f-0a1b2c3d4e5f');   -- a guest, by user id

-- Ban from making or joining rooms and from chat (Practice and offline play still work).
SELECT moderation.ban('Spammer99', 7);      -- 7 days (1 to 3650)
SELECT moderation.ban('Spammer99', NULL);   -- permanent
SELECT moderation.unban('Spammer99');

-- Lift a chat mute early.
SELECT moderation.unmute('Spammer99');

-- Mark reports resolved: one by its id (from report_ids), or every open one about a player, with an optional note.
SELECT moderation.resolve('5b1e…');
SELECT moderation.resolve('Spammer99', 'warned in chat');

-- The log of every action (Joe's, the automatic mute, the server's steps, the daily retention).
SELECT at, action, user_id, report_id, detail, by_role FROM moderation.actions ORDER BY at DESC;
```

Every action writes one `moderation.actions` line (who: the database role that ran it, `postgres` from the
dashboard, `system` for the automatic mute and the server's own steps; what; when) and one `moderation_action`
analytics event with its type only. For accounts, `warn` and `ban` / `unban` also set `public.profiles.status`
(`warned`, `banned`, `active`).

What the player sees:

- **Warned**: on their next open of a tab page, "A note from Joulz" with the note, once.
- **Force-renamed**: on their next open, an account is renamed at once to an energy name (`energyName` from
  `src/lib/names`, through accounts' `forceRename`, kind `forced`), then "Pick a new name", checked by the same names
  module, also forced (never counting towards the change limit). A guest gets an energy room name on the phone, then
  picks a new one.
- **Banned**: making or joining a room, or chatting, answers "You can’t make or join rooms or chat right now. Practice
  still works. Questions? Email support@joulz.uk."; the same notice shows once per open.

The notices are asked for once per app open, on a tab page, only for a device that already has a session, online, and
never in a browser under automation unless the page sets `window.__DUELZ_ALLOW_SAFETY__`.

A removed user (accounts' clean-up): the reports about them keep their content on a fresh random id, their action
lines too, and their state row goes (a trigger on `auth.users`).

## 5b. Retention (privacy policy, agreed 9 Nov 2026)

`moderation.run_retention()`, daily at 04:17 UTC (pg_cron job `chat-retention`):

- room chat messages older than 90 days are deleted, except a message a report points at (kept with the report);
- reports and moderation action lines are deleted 2 years after they were made (a report's message then goes on the
  next run);
- one `retention` line a run with the counts.

Check it's scheduled: `SELECT jobname, schedule, command FROM cron.job;` should list `chat-retention` (`17 4 * * *`)
and `new-guest-purge` (`7 * * * *`). Run it by hand: `SELECT moderation.run_retention();`.

## 6. Analytics

Through `src/lib/data/events.server.ts`: `report_sent` (props `reason` only, never the message or who was reported),
`chat_muted` (the muted player, no more). `moderation_action` (props `type` only, no player) is written by the
moderation functions themselves, which run in the database where events.server.ts can't: they call the same
`record_analytics_events` that module calls, with the same row shape.
