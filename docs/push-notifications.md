# Phone notifications (wave 2, train B, session B2, 11 Nov 2026)

Players who want them get a few useful notifications on their phone, never nagging. Standard web push with Joulz's own
VAPID keys: no third-party notification service and no package. **Off until Joe adds the keys** (below): with the
switch off nothing asks, nothing subscribes, Settings shows no Notifications panel and the server sends nothing.

## What a player gets

| Event | Sent when | Opens |
| --- | --- | --- |
| `friend_request` | someone sends you a friend request (B1 calls `notifyFriendRequest`) | Profile |
| `friend_accepted` | a request you sent is accepted (B1: `notifyFriendAccepted`) | Profile |
| `friend_challenge` | a friend challenges you (B1: `notifyFriendChallenge`) | the challenge |
| `room_invite` | a friend invites you to their room (B1: `notifyRoomInvite`) | the room |
| `tournament_starting` | a tournament you entered or asked to be reminded of starts (`notifyTournamentStarting`; **nothing calls it until wave 4**) | Tournaments |
| `daily_streak` | the evening reminder, 19:00–20:59 UK time, only if you have a live streak and haven't played today's Daily | the Daily |

Limits (`src/lib/push/rules.ts`):

- each event has its own switch, under a master "All notifications" switch, all in Settings → Notifications;
- at most **3 a day** (the player's own day, on their device's clock), room invites apart;
- **nothing from 22:00 to 08:00** on the player's clock, except a room invite a friend has just sent (within 2 minutes);
- a notification held back by the cap or quiet hours is dropped, never saved for later;
- the streak reminder once a UK day at most;
- pass rewards, the shop and come-back nudges stay in the app; there is no marketing email.

## Asking

Never on first open. The ask (a small pop-up on a tab page: Play, Practice, Tournaments, Profile; never over a round,
an intro, a reveal or a result) is marked due by a useful moment and shown on the next tab page:

- a first friend request sent or received, a friend's challenge (B1 calls `notePushMoment("friend_request_sent" |
  "friend_request_received" | "challenge_received", true)` from `src/lib/push/pushClient.ts`);
- a finished Daily (already wired, through `FinishedGameCounter`).

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
- `src/lib/push/push.server.ts` / `push.functions.ts`: save and remove a device, the switches, the ask's answer, a tap.
- `src/lib/data/push.server.ts`: every database call (typed, one call each).
- `src/lib/push/pushClient.ts`: the phone's half (the ask, subscribing on the offline worker's registration, sign-out,
  renewing on each open, `?notif=` taps). `src/components/push/`: the ask and the settings panel.
- `src/lib/push/sw.push.js`: the `push` and `notificationclick` listeners, appended by `swPlugin.ts` after the offline
  worker (`sw.template.js`, unchanged: the offline install, activate, message and fetch handlers are exactly as before).
- `src/routes/api/push/daily-reminder.ts`: `POST /api/push/daily-reminder` with `Authorization: Bearer <PUSH_CRON_SECRET>`,
  run by `.github/workflows/push-reminder.yml` at 18:37 and 19:37 UTC (one of the two is 19:37 UK time in both GMT and
  BST; a run outside 19:00–20:59 UK does nothing). About 60 Actions minutes a month.

### Database (`supabase/migrations/20261111120000_push_notifications.sql`)

- `push_subscriptions`: one row per account and device (endpoint, keys, the device's time zone). Hangs off
  `profiles`, so guests can't have one and an account's removal takes them. The server writes; a player can read and
  delete their own.
- `notification_settings`: the master switch and six event switches (a player reads and changes their own), plus the
  ask's record (the server's).
- `notification_log`: one row per notification sent (the cap and once-only keys); service role only; kept 30 days
  (pg_cron `push-log-retention`, 04:29 UTC).
- `push_reserve`, `push_streak_candidates`, `push_played_daily`, `push_log_retention`: service role only.

**The Daily streak:** `push_streak_candidates` and `push_played_daily` read the Daily's own attempts (an attempt on
yesterday's Daily = a live streak; any attempt today = played) until train C's server-side streak (C2) lands; then only
those two function bodies change, in a new migration.

Sign-out removes the device's row and unsubscribes the browser (`forgetPushOnSignOut`, before the session ends). An
account deletion request removes every device of the account.

## Turning it on: the keys (Joe)

You need three values: a public key, a private key and a scheduler key. They are made once and kept. Making a new pair
later stops every phone's notifications until each player turns them on again.

1. **Make the keys** on your own computer, in the repo folder:

   ```bash
   bun scripts/push-vapid-keys.ts
   ```

   It prints `PUSH_PUBLIC_KEY`, `VAPID_PRIVATE_KEY` and `PUSH_CRON_SECRET` and stores nothing. (Without Bun: `npx
   web-push generate-vapid-keys` gives the same kind of public and private key, nothing added to the repo; and any 43
   random letters and digits do for the scheduler key, e.g. from `openssl rand -base64 32`.) Never paste the private
   key or the scheduler key into a chat, an issue or a commit.
2. **Add the two secrets in GitHub:** the repo → Settings → Secrets and variables → Actions → New repository secret:
   - name `VAPID_PRIVATE_KEY`, value the private key;
   - name `PUSH_CRON_SECRET`, value the scheduler key.

   No spaces or line breaks before or after (the deploy fails on stray whitespace). The deploy workflow sends both to
   the Worker on the next deploy to `main`; the reminder workflow reads `PUSH_CRON_SECRET` itself.
3. **Deploy once** so the Worker has them: merge anything to `main` or run Actions → Deploy to Cloudflare → Run
   workflow. Check the run's log has no warning "VAPID_PRIVATE_KEY is not set".
4. **Turn it on:** in a PR, set `PUSH_PUBLIC_KEY` in `src/config/pushConfig.ts` to the public key (it's public: fine in
   the repo) and merge it. From that deploy, accounts get the ask at a useful moment and the Notifications panel in
   Settings.
5. Optional: Actions → Push reminder → Run workflow; its log shows `"inWindow": false` outside 19:00–20:59 UK, and a
   count of players reminded inside it (never who).

To switch it off again, set `PUSH_PUBLIC_KEY` back to `""` (nothing asks or sends; existing rows stay and are used again
if it comes back on).

## Testing on a phone (Joe)

Use an account (guests are never asked). To see the ask without waiting for a moment, finish a Daily, then open Play.

**Android (Chrome):** open joulz.uk, sign in, finish a Daily, go to Play: "Turn on notifications?" → Turn on → Allow.
Settings → Notifications shows "On this phone" on. From another account, send a friend request (once B1 is in) or invite
this account to a room: the notification arrives, and a tap opens the right screen. Turn one event's switch off and
repeat: nothing arrives. Sign out: the next event doesn't arrive.

**iPhone (iOS 16.4 or later):** in Safari, sign in and finish a Daily, go to Play: the how-to appears instead ("Add Joulz
to your Home Screen…"). Tap Share → Add to Home Screen, open Joulz from the Home Screen icon, sign in if asked, open
Settings → Notifications → "On this phone" → Allow. Then as on Android. Notifications show on the lock screen and in
Notification Centre; a tap opens the Home Screen app.

**The reminder:** play yesterday's Daily but not today's, keep the phone's notifications on, and run Actions → Push
reminder → Run workflow between 19:00 and 20:59 UK time: one notification, and no second one on a second run.

**Quiet hours:** anything but a fresh room invite sent between 22:00 and 08:00 (the phone's own time) doesn't arrive.

## Checks

push-notifications-check (~5 s, shard `e`, PostgreSQL): the RFC 8291 example byte for byte, every message decrypting on
a stand-in push service with a verified VAPID JWT, the six events and their switches, the cap (atomic) and quiet hours,
the reminder, subscriptions (guests refused, sign-out, gone, deletion), the switch off, the 30-day ask, RLS, the service
worker's listeners and the three analytics events. The offline worker's own checks (offline-delta-check,
offline-media-refresh-check, offline-check) run unchanged.
