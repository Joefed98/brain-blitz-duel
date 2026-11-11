# Phone notifications (wave 2, train B, session B2, 11 Nov 2026)

Players who want them get a few useful notifications on their phone, never nagging. Standard web push with Joulz's own
VAPID keys: no third-party notification service and no package. **Off until Joe adds the keys** (below): with the
switch off nothing asks, nothing subscribes, Settings shows no Notifications panel and the server sends nothing.

## What a player gets

| Event | Sent when | Opens |
| --- | --- | --- |
| `friend_request` | B1 records `friend_request_received` (someone sends you a friend request) | Profile |
| `friend_accepted` | B1 records `friend_request_accepted` (a request you sent is accepted) | Profile |
| `friend_challenge` | B1 records `friend_challenge_received` (a friend sends you their challenge) | the challenge |
| `room_invite` | B1 records `room_invite_received` (a friend invites you to their lobby) | the room |
| `tournament_starting` | a tournament you entered or asked to be reminded of starts (`notifyTournamentStarting`). **Called only by the tournaments module (wave 4, W4b: reminders for an entered or reminded event)** (push-notifications-check fails if anything else does) | Tournaments |
| `daily_streak` | the evening reminder, 19:00–20:59 UK time, only with a live Daily streak (train C's, on the account) and today's Daily not played | the Daily |

Limits (`src/lib/push/rules.ts`):

- each event has its own switch, under a master "All notifications" switch, all in Settings → Notifications;
- at most **3 a day** (the player's own day, on their device's clock), room invites apart;
- **nothing from 22:00 to 08:00** on the player's clock, except a room invite a friend has just sent (within 2 minutes);
- a notification held back by the cap or quiet hours is dropped, never saved for later;
- a room invite more than 10 minutes old is never sent (the lobby has moved on);
- the streak reminder once a UK day at most;
- pass rewards, the shop and come-back nudges stay in the app; there is no marketing email.

## How quiet hours know each phone's time zone

When a phone saves its subscription it sends its own IANA time zone (`Intl.DateTimeFormat().resolvedOptions().timeZone`,
e.g. `Europe/London`), and it sends it again on every app open (`syncPushOnOpen`), so a phone that travels catches up
the next time Joulz is opened. The server keeps it on that device's row (`push_subscriptions.time_zone`), refusing
anything Intl doesn't know (read as `Europe/London`). Quiet hours and "today" for the daily cap use the time zone of
the player's most recently used device.

## Asking

Never on first open. The ask (a small pop-up on a tab page: Play, Practice, Tournaments, Profile; never over a round,
an intro, a reveal or a result) is marked due by a useful moment and shown on the next tab page:

- a friend request sent (B1's `friendsApi.request` / `requestByLink` answering "sent");
- a friend request waiting (B1's waiting-requests count above 0);
- a finished Daily (`FinishedGameCounter`).

Accounts only. "Not now" (or the browser's own Block) holds every ask off for **30 days**, on the device and on the
server (`notification_settings.declined_at`). Settings' "On this phone" switch can turn notifications on at any time.

**iPhone:** web push only works in the app added to the Home Screen (iOS 16.4+). On an iPhone in Safari the ask is a
short how-to ("tap Share, then Add to Home Screen…") instead of the opt-in, and Settings says the same.

## How it works

- `src/config/pushConfig.ts`: `PUSH_PUBLIC_KEY` (the public setting; empty = off) and `PUSH_SUBJECT`.
- `src/lib/push/webPush.server.ts`: RFC 8291 encryption (aes128gcm) and RFC 8292 VAPID signing in WebCrypto, the POST
  to the push service. Only known push services (Apple, Google, Mozilla, Microsoft) are ever used.
- `src/lib/push/notify.server.ts`: the one place a notification is decided and sent (switches, quiet hours, then the
  log's atomic reservation `push_reserve` for the cap and once-only keys, then one push per device; a device the push
  service answers 404/410 for is removed). `notification_sent` is recorded here. Never throws.
  - **Friend events:** B1's SQL writes `public.friend_events` in the same transaction as the change.
    `dispatchFriendEvents` claims the events not yet taken (`push_claim_friend_events`, each claimed once, so it is sent
    at most once), reads the friend's username from `public_profiles` and sends. It runs right after B1's change
    (`notifySoon` in `src/lib/friends/friends.server.ts`, in the background with Cloudflare's `waitUntil`) and again
    every 5 minutes from the Cron Trigger, which catches anything the first one missed.
  - **The Daily streak reminder** (`runDailyStreakReminders`): `push_streak_candidates` narrows to accounts with a
    device and the reminder on who started a Daily in the last 60 days and none today (from train C's
    `public.daily_history`), then train C's `dailyStreakFor` (`src/lib/duel/dailyStreak.server.ts`: the account's
    streak, streak freezes included) decides: a streak of 1 or more with today's Daily not played. The message says the
    streak ("You're on 4 days").
- `src/lib/push/push.server.ts` / `push.functions.ts`: save and remove a device, the switches, the ask's answer, a tap.
- `src/lib/data/push.server.ts`: every database call (typed, one call each).
- `src/lib/push/pushClient.ts`: the phone's half (the ask, subscribing on the offline worker's registration, sign-out,
  renewing on each open, `?notif=` taps). `src/components/push/`: the ask and the settings panel.
- `src/lib/push/sw.push.js`: the `push` and `notificationclick` listeners, appended by `swPlugin.ts` after the offline
  worker (`sw.template.js`, unchanged: the offline install, activate, message and fetch handlers are exactly as before).
- **Cron Triggers** (the Worker's own scheduler, no secret): `vite.config.ts` gives nitro two scheduled tasks
  (`src/lib/push/tasks/`); nitro's Cloudflare build writes their schedules into the generated wrangler.json's
  `triggers.crons`, `wrangler deploy` sets them on the Worker, and the Worker's `scheduled` handler runs the task for the
  cron that fired:
  - `*/5 * * * *`: `push:friend-sweep` (friend events not yet sent);
  - `41 * * * *`: `push:daily-reminder`, every hour; it acts only from 19:00 to 20:59 UK time, so it runs twice in the
    window every evening, GMT or BST, and the second run reminds nobody twice (and catches anyone the first missed).

  Both do nothing while the keys aren't set. Cloudflare's free plan allows 5 Cron Triggers a Worker; these are 2.

### Database (`supabase/migrations/20261112060000_push_notifications.sql`)

After train C's `20261111220000_badges_titles.sql` and train B1's `20261111230000_friends.sql` (it reads both).

- `push_subscriptions`: one row per account and device (endpoint, keys, the device's time zone). Hangs off
  `profiles`, so guests can't have one and an account's removal takes them. The server writes; a player can read and
  delete their own.
- `notification_settings`: the master switch and six event switches (a player reads and changes their own), plus the
  ask's record (the server's).
- `notification_log`: one row per notification sent (the cap and once-only keys); service role only; kept 30 days
  (pg_cron `push-log-retention`, 04:29 UTC).
- `push_friend_deliveries`: which of B1's friend events have been claimed; service role only; goes with its event, and
  the retention job drops claims older than 30 days.
- `push_reserve`, `push_streak_candidates`, `push_claim_friend_events`, `push_log_retention`: service role only.
- Three analytics events added to `analytics.events`' list: the migration reads the list from the constraint as it
  stands and adds these three (it never writes the list out), so every event already allowed stays allowed.

Sign-out removes the device's row and unsubscribes the browser (`forgetPushOnSignOut`, before the session ends). An
account deletion request removes every device of the account.

## Turning it on: the keys (Joe)

You need two values: a public key and a private key. They are made once and kept. Making a new pair later stops every
phone's notifications until each player turns them on again.

1. **Make the keys** on your own computer, in the repo folder:

   ```bash
   bun scripts/push-vapid-keys.ts
   ```

   It prints `PUSH_PUBLIC_KEY` and `VAPID_PRIVATE_KEY` and stores nothing. (Without Bun: `npx web-push
   generate-vapid-keys` gives the same kind of pair, nothing added to the repo.) Never paste the private key into a
   chat, an issue or a commit.
2. **Add the private key in GitHub:** the repo → Settings → Secrets and variables → Actions → New repository secret,
   name `VAPID_PRIVATE_KEY`, value the private key, with no spaces or line breaks before or after (the deploy fails on
   stray whitespace). The deploy workflow sends it to the Worker on the next deploy to `main`.
3. **Deploy once** so the Worker has it: merge anything to `main`, or Actions → Deploy to Cloudflare → Run workflow.
   Check the run's log has no warning "VAPID_PRIVATE_KEY is not set".
4. **Turn it on:** in a PR, set `PUSH_PUBLIC_KEY` in `src/config/pushConfig.ts` to the public key (it's public: fine in
   the repo) and merge it. From that deploy, accounts get the ask at a useful moment and the Notifications panel in
   Settings, friend events send, and the evening reminder runs.
5. Optional: Cloudflare dashboard → Workers & Pages → `joulz` → Settings → Trigger events shows the two Cron Triggers
   (`*/5 * * * *` and `41 * * * *`, set by the deploy); Workers Logs show `[push] daily reminder <day>: {...}` with counts
   only (never who) after an evening run.

Nothing else is needed: the Cron Triggers come with the deploy, and there is no scheduler secret. To switch it off
again, set `PUSH_PUBLIC_KEY` back to `""` (nothing asks or sends; existing rows stay and are used again if it comes back
on).

## Testing on a phone (Joe)

Use an account (guests are never asked). To see the ask without waiting, send a friend request, or finish a Daily,
then open Play.

**Android (Chrome):** open joulz.uk, sign in, finish a Daily (or send a friend request), go to Play: "Turn on
notifications?" → Turn on → Allow. Settings → Notifications shows "On this phone" on. From another account, send this
account a friend request: the notification arrives within seconds, and a tap opens Profile. Accept a request from this
account on the other: "now friends" arrives there. Invite this account to a lobby: it arrives and opens the room. Turn
one event's switch off and repeat: nothing arrives. Sign out: the next event doesn't arrive.

**iPhone (iOS 16.4 or later):** in Safari, sign in and send a friend request or finish a Daily, go to Play: the how-to
appears instead ("Add Joulz to your Home Screen…"). Tap Share → Add to Home Screen, open Joulz from the Home Screen
icon, sign in if asked, open Settings → Notifications → "On this phone" → Allow. Then as on Android. Notifications show
on the lock screen and in Notification Centre; a tap opens the Home Screen app.

**The reminder:** play yesterday's Daily but not today's, keep notifications on, and wait for 19:41 or 20:41 UK time:
one notification ("You're on N days…"), never a second that evening.

**Quiet hours:** anything but a fresh room invite between 22:00 and 08:00 (the phone's own time) doesn't arrive.

## Checks

push-notifications-check (shard `e`, PostgreSQL, about 5 s): the RFC 8291 example byte for byte, every message decrypting on
a stand-in push service with a verified VAPID JWT, the six events and their switches, the cap (atomic) and quiet hours,
a real friend request and accept through B1's server functions reaching the other phone, B1's invite and challenge
events, each event sent once, the reminder on C2's real streak, the Cron Trigger schedules, subscriptions (guests
refused, sign-out, gone, deletion), the switch off, the 30-day ask, RLS, the service worker's listeners and the three
analytics events. The offline worker's own checks (offline-delta-check, offline-media-refresh-check, offline-check)
run unchanged.
