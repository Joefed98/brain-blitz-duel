# Accounts (backend)

Wave 1, train 1, session 1 (10 Nov 2026). An account turns today's anonymous device player into a named, signed-in
player without losing anything. This is the server side and the phone's plumbing; the sign-up screens are a later
session.

## How it works

- Every device already has a Supabase auth user (anonymous sign-in, `src/lib/duel/session.ts`).
- **Sign-up from a guest** links an email (or, later, Google) to that same auth user. Supabase keeps the user id and
  only clears `is_anonymous`, so every room, result, Daily attempt, challenge, practice play and beta row stays theirs
  with nothing copied. Then `completeSignUpFn` creates the **profile** row: an account is a profile row.
- **Signing in to an existing account** on a phone with guest progress replaces the phone's session with the account's.
  The guest's rows stay on the guest id and nothing moves. `guestProgressFn` tells the screens what stays behind;
  the phone keeps the left guest's id (`rememberLeftGuest`) in case a merge is wanted later.
- One email carries both a magic link and a 6-digit code (an iPhone home-screen app often opens links in Safari, so
  the code is the reliable path).

The order the screens will call (`src/lib/account/auth.ts` has it at the top):

| Step | Sign-up (guest) | Sign-in (existing account) |
| --- | --- | --- |
| 1 | `startSignUpFn({ method, dateOfBirth, username })`: age gate (under 13 refused, nothing stored), name | `guestProgressFn()`: what stays behind |
| 2 | `sendSignUpEmail(email)` (`updateUser`, the "Change email address" template) | `sendSignInEmail(email)` (`signInWithOtp`, never creates a user; "Magic link" template) |
| 3 | `verifyEmailCode(email, code, "sign-up")` (type `email_change`), or the link | `verifyEmailCode(email, code, "sign-in")` (type `email`), then `noteSignInFn` |
| 4 | `completeSignUpFn({ username, dateOfBirth, colour, country: regionCountry() })` | |

`sendSignUpEmail` answers `existing-account` when the email already has an account: the screens then offer sign-in
with the stays-behind warning.

## Files

| Piece | File |
| --- | --- |
| Migration: profiles, holds, admin log, server and admin functions, clean-up job | `supabase/migrations/20261110120000_accounts_profiles.sql` |
| Migration: the seven account events in `analytics.events`' list | `supabase/migrations/20261110120100_analytics_account_events.sql` |
| Data layer (server) | `src/lib/data/profiles.server.ts` |
| Data layer (phone, RLS) | `src/lib/data/profileReads.ts` |
| Server rules | `src/lib/account/account.server.ts` |
| Server functions | `src/lib/account/account.functions.ts` |
| Phone plumbing (Auth calls) | `src/lib/account/auth.ts` |
| Age rules / the phone's refusal memory | `src/lib/account/age.ts`, `src/lib/account/ageGate.ts` |
| Country (ISO 3166-1 alpha-2, from the region setting) | `src/lib/account/country.ts` |
| Rename limits | `src/lib/account/usernameRules.ts` |
| Switches (Google, Apple), sender | `src/config/accountConfig.ts` |
| Names: the one check | `src/lib/names/names.server.ts` (`checkUsernameRules`, `checkGuestName`, `nameProblem`, suggestions) |
| Names: reserved list | `src/lib/names/reserved.ts` |
| Names: look-alikes | `src/lib/names/lookalike.ts`, `src/lib/names/fold.ts` |
| Names: energy words (review these) | `src/lib/names/energyWords.ts` |
| Email templates | `supabase/templates/email_change.html`, `magic_link.html`, `confirmation.html` |
| Check | `scripts/accounts-check.ts` |

## The rules

- **Usernames**: 3–16 ASCII letters, numbers and underscores; unique ignoring capitals (`username_key`); stored and
  shown as typed. The word filter is the existing one (`offensiveName` in `src/lib/duel/boardName.server.ts`, on the
  chat list in `profanity.server.ts`), read as typed, folded (accents, Cyrillic / Greek look-alikes) and as look-alike
  letters (0→o, 1→i and 1→l, 3→e, 4→a, 5→s, 7→t, @→a, $→s, repeated letters squeezed). Reserved names: one list,
  `src/lib/names/reserved.ts` (Joulz / Duelz / Captain Joulz anywhere in a name; admin, staff, support, moderator,
  official, mod, system and the rest as a whole name or one word of it). A refusal is a plain reason and three
  suggestions.
- **Changing a username**: free once within 7 days of sign-up; otherwise once every 90 days, counted from the last
  change that counts (the free one included), or from sign-up. A rename forced by moderation (`forceRename`,
  server-only, logged) counts towards neither. A released name is held 30 days: only its old owner may take it back.
- **Guest room names**: the same filter, reserved and look-alike checks, up to 16 code points (14 before), spaces
  allowed, not unique. Wired into room create and join; the daily's and challenges' board names use the same check
  through `nameRefusal`.
- **Date of birth**: the full date is stored; the age is worked out on the UK calendar day. Under 13: refused, no
  account, no date stored (`under_thirteen_refused` carries neither date nor age); the phone remembers the refusal for
  7 days (`ageGate.ts`). 13–17: `isUnder18` (`accountAgeFlags` for other server code), lifting on the 18th birthday by
  itself. Nobody edits their own date; the admin function below corrects it.
- **Player numbers**: from 2, never reused, assigned by the database at account creation. #1 only through the admin
  function.
- **Founding**: accounts created before 2027-01-26 00:00 UK time (`accounts.is_founding`). The badge, the frame and the
  250 coins come in wave 2 from this flag.
- **Sign-up reward**: nothing paid now. Wave 2's coin ledger can credit 1,000 to every row of `public.profiles`; the
  row's existence and `created_at` are all it needs.
- **Country**: from the phone's region setting (`regionCountry`: `Intl.Locale(tag).region` of the first language tag
  that names one; never guessed from a bare language, never from an IP), nullable, any of the 249 assigned codes
  (checked by the database too); the player changes it later (`updateOwnProfileSettings`).
- **What other players see**: `public.public_profiles(uuid[])`: username, colour, player number, founding. Never a date
  of birth, a country or a status. An account waiting for deletion shows as "Deleted player" at once.

## Sign-up screens (wave 1, train 2, session 3)

The screens that turn a guest into a signed-in player (docs/mockups/wave-1/ S1–S6 and that folder's README). They
call the backend above and decide nothing themselves.

| Piece | File |
| --- | --- |
| The route: sign-in and sign-up for a guest, Settings → Account for an account | `src/routes/account.tsx` (`/account?from=<path>&start=email`) |
| Sign in (S2), email (S3), inbox with the 6-digit code (S3b), username and colour (S4), birthday (S5), welcome (S6), the sign-in warning, the under-13 message, the deletion cancel offer | `src/components/account/SignUpFlow.tsx` |
| Settings → Account: username (and when it may change next), email, country picker, sign out, delete account (two steps) | `src/components/account/AccountSettings.tsx` |
| "Save your progress": the sheet after the first finished game, the pop-up once after the third if dismissed; shown only on the tab pages | `src/components/account/SaveProgress.tsx` (`FinishedGameCounter` on result screens, `SaveProgressPrompt`), `SaveProgressSlot.tsx` (PhoneShell's tab pages), rules `src/lib/account/saveProgress.ts` |
| The "needs an account" gate for wave 2 (friends, shop) and wave 4 (tournaments) | `src/components/account/AccountGate.tsx` (`<AccountGate what="add friends">…</AccountGate>`) |
| The phone's account state (`useAccount`, `useAccountName`, sign out) | `src/lib/account/accountApi.ts` |
| The prompt's three events (server function) | `src/lib/account/saveProgress.functions.ts`, migration `20261110130000_analytics_save_progress_events.sql` |
| Usernames in rooms, Dailies and challenges | `src/lib/names/playerName.server.ts` (`accountNameOf`), read by `insertPlayer`, `dailyStartFn` and the challenge calls |
| Styles | `src/polish-layout/account.css` |
| Checks | `scripts/account-screens-check.ts` (no browser), `scripts/account-flow-check.ts` (Chromium, the whole email-code flow), the screens in `scripts/theme-screens.ts` `ACCOUNT_SCREENS` (theme-check, no-wrap-check) |

The order of the calls:

- **Account emails are rate limited.** The screens never call Supabase Auth's send endpoints themselves: the sign-in
  lookup and the sign-up code go through `requestSignInEmailFn` / `requestSignUpEmailFn` (account.functions.ts →
  `requestEmailCode` in account.server.ts → `src/lib/data/authEmail.server.ts`), which first take two
  `take_rate_limit` buckets: `IP_ACCOUNT_EMAIL_LIMIT`, 10 a network every 10 minutes (every lookup counts, found or
  not, and sign-up codes share it), and `EMAIL_CODE_LIMIT`, 5 an address every hour from any network (sign-in and
  sign-up together). Over either, nothing is looked up or sent ("Too many tries…"). Keys are hashes of the network
  address and the lower-cased email; neither is stored. account-screens-check proves both. Supabase's own Auth rate
  limits (step 4 below) still apply to anyone calling Auth directly with the public key, so keep them set.
- **New player**: S3 asks for a sign-in email first (it never creates a user); "no account" means a new player, so S4
  and S5 come next, then `startSignUpFn` (the age gate, before any email is sent), then the sign-up email, S3b, and
  `completeSignUpFn` (country from `regionCountry()`), then S6. The birthday screen never mentions an age limit.
- **Existing account**: S3's sign-in email is sent, so it is a sign-in: when this phone's guest has progress
  (`guestProgressFn`) the warning lists what stays behind (Cancel / Continue); then the code, `noteSignInFn`,
  `rememberLeftGuest`. An account waiting for deletion is offered "Keep my account" (`cancelAccountDeletionFn`).
- **Under 13**: the kind message ("You can keep playing as a guest"), `rememberAgeRefusal()`; while it holds, a new
  sign-up goes straight to that message (sign-in to an existing account still works).
- **The link instead of the code**: the inbox listens for the session changing on this phone and carries on.
- **Where "Save your progress" shows** (Joe's decision, 10 Nov 2026): never over a round, its intro or reveal, or any
  result, podium, standings or share screen. A finished game's result screen only counts the game
  (`FinishedGameCounter` → `noteFinishedGame`, which marks the prompt due as `pending` on the device); the prompt shows
  the next time the player lands on a tab page (Play, Practice, Tournaments, Profile: PhoneShell's `tabs` draws
  `SaveProgressSlot`, which takes it once with `takePendingPrompt`), this visit or, if the app was closed on the result,
  the next open. The pop-up after the third game follows the same rule. A guest who signs in first is never asked.
- **Names**: a signed-in player's name boxes show their username with no way to type another, and the server seats
  them under it whatever is sent; guests type up to 16 characters and a refused name shows the plain reason with the
  three suggestions as chips.
- Google and Apple buttons show only while `GOOGLE_SIGN_IN_ENABLED` / `APPLE_SIGN_IN_ENABLED` are on.

## Delete account and the daily clean-up

- `requestAccountDeletionFn`: sets `deletion_requested_at` (the profile is hidden at once) and signs the player out
  everywhere (every refresh token revoked; an access token already issued lapses within the hour, as on Supabase).
- Signing back in within 30 days: `accountStatusFn` shows `deletion`, and `cancelAccountDeletionFn` cancels.
- `accounts.run_daily_cleanup()` runs at 03:41 UTC (pg_cron job `account-cleanup`). It removes, through
  `accounts.forget_user(id)`:
  - accounts 30 days after the request;
  - guests 13 months after their last activity (the latest of their rooms, joins, Daily and challenge attempts,
    practice plays, presence, sign-in and creation): anonymous users with no profile, and half-finished sign-ups (a
    confirmed email but no profile) by the same rule. Never an account (a user with a profile).
- **The brake**: if more than 25 accounts or more than 500 guests are due in one run, it removes nothing, writes a
  `cleanup_braked` warning line to `accounts.admin_log` (with the counts due) and stops. Once Joe has looked,
  `SELECT accounts.run_daily_cleanup(true);` by hand lifts the brake for that one run.
- **The run log**: every run writes exactly one `accounts.admin_log` line, `cleanup` (or `cleanup_braked`), with the
  counts removed, zero included.
- What `forget_user` does: every row that names the user gets one fresh random id instead (NOT NULL columns:
  `duel_players`, `duels.host_user_id`, the archives, `room_joins`, `room_reports.reporter_user_id`, `async_attempts`,
  `async_results`, `async_rooms.created_by`, `challenges.created_by`, `challenge_events`, `share_events`,
  `terms_events`) or none (nullable: `practice_plays`, `async_events`); names they chose in rooms and on boards
  become "Deleted player"; their chat messages, rate-limit counters, presence rows, admin-log entries and profile are
  deleted; `analytics.events.player_id` is cleared; an account's exact username is replaced by "Deleted player" in
  rooms' stored winners (`duels.tournament_history`; names guests typed are left); their username is held 30 days for
  nobody; then the auth user is deleted. Results are kept, so other players' room histories still add up.
- The migrations guard does not flag any of this (the deletes and updates are inside function bodies, each with a
  WHERE). It is deliberately destructive at run time; Joe approved it on 10 Nov 2026 with the brake and the run log.

## What Joe sets in the dashboards

### Supabase (the London project)

1. **Email provider** (Authentication → Sign In / Providers → Email): enabled, *Confirm email* on, *Email OTP length*
   6, *Email OTP expiration* 3600 seconds. Keep *Allow anonymous sign-ins* on and *Allow new users to sign up* on
   (anonymous sign-in and linking need it).
2. **Manual linking** (Authentication → Sign In / Providers, "Allow manual linking"): on. `linkIdentity` (Google
   onto a guest) needs it; email linking works without it.
3. **Sending (Resend SMTP)**: in Resend, add and verify the domain `joulz.uk` (add Resend's SPF, DKIM and return-path
   records in Cloudflare DNS), and create an API key with sending access. In Supabase, Authentication → Emails → SMTP
   Settings → enable custom SMTP:
   - Sender email `hello@joulz.uk`, sender name `Joulz`
   - Host `smtp.resend.com`, port `465`, username `resend`, password: the Resend API key
   - Minimum interval between emails per user: 60 seconds (the default)
   - **Reply-to**: Supabase's SMTP form has no reply-to field. Until a Send Email hook is added, either make
     `hello@joulz.uk` a monitored mailbox that forwards to `support@joulz.uk`, or accept that replies go to hello@.
     The templates' footer names support@joulz.uk.
4. **Rate limits** (Authentication → Rate Limits): with custom SMTP, raise "emails sent per hour" from the default
   (try 100).
5. **Templates** (Authentication → Emails → Templates): paste each body from `supabase/templates/`:
   - *Change email address* (used when a guest makes an account): subject `Your Joulz code: {{ .Token }}`, body
     `email_change.html`
   - *Magic link* (signing in): subject `Your Joulz sign-in code: {{ .Token }}`, body `magic_link.html`
   - *Confirm signup*: subject `Confirm your Joulz account`, body `confirmation.html` (not used by the current flow;
     set so nothing unbranded goes out)
6. **URL configuration** (Authentication → URL Configuration): Site URL `https://joulz.uk`; Redirect URLs add
   `https://joulz.uk/**` (the links land on `https://joulz.uk/profile`).
7. **pg_cron**: already on for analytics. After the deploy, in the SQL editor:
   `SELECT jobname, schedule, command FROM cron.job;` should list `account-cleanup` at `41 3 * * *`.

### Google (when Joe wants Google sign-in)

1. Google Cloud Console → APIs & Services → OAuth consent screen: External; app name Joulz; support email
   support@joulz.uk; authorised domain `joulz.uk`; scopes `openid`, `email`, `profile`; publish the app.
2. Credentials → Create credentials → OAuth client ID → Web application: Authorised JavaScript origins
   `https://joulz.uk`; Authorised redirect URIs `https://<project-ref>.supabase.co/auth/v1/callback` (the project ref
   is in Supabase → Project Settings → General).
3. Supabase → Authentication → Sign In / Providers → Google: enable, paste the client ID and secret, save.
4. Then a PR sets `GOOGLE_SIGN_IN_ENABLED = true` in `src/config/accountConfig.ts` (and the screens offer it).

### Apple

Off (`APPLE_SIGN_IN_ENABLED = false`) until the Apple Developer account exists: then a Services ID, a key and the
Supabase Apple provider, and the switch.

## Admin SQL (Supabase SQL editor, as the dashboard's own user)

None of these can be run by the app, a phone or the service role.

```sql
-- Give player #1 to your own account (once). Its earlier number is retired, never reused.
SELECT accounts.admin_assign_player_one('YourUsername');

-- Correct a date of birth after a support request (refuses a date that makes the player under 13). Logged.
SELECT accounts.admin_set_date_of_birth('TheirUsername', DATE '2001-04-30', 'support request 10 Nov 2026');

-- The log of admin changes.
SELECT at, action, user_id, detail FROM accounts.admin_log ORDER BY at DESC;

-- Run the clean-up now (it also runs daily); answers how many accounts and guests it removed.
SELECT accounts.run_daily_cleanup();

-- After a braked run, once you've looked at what is due: lift the brake for this one run.
SELECT accounts.run_daily_cleanup(true);

-- The clean-up's own lines (one a run).
SELECT at, action, detail FROM accounts.admin_log WHERE action IN ('cleanup', 'cleanup_braked') ORDER BY at DESC;
```
