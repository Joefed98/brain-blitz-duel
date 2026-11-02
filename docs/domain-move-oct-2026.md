# Domain move to joulz.uk (31 Oct 2026)

The app now lives at **https://joulz.uk**, connected in Lovable as the primary domain;
`playjoulz.com` and the old `brain-blitz-duel.lovable.app` redirect to it.

## What changed in the repo

- `src/config/appUrl.ts`: `APP_URL = "https://joulz.uk"`, the one place the address lives
  (re-exported from `src/lib/brand.ts`, where `SITE_URL` used to be).
- Built on `APP_URL` instead of the page's own origin (`window.location.origin`):
  - room share links and the share card's text (`ShareResultButton` → `roomShareData`, `/duel/CODE?ref=share`);
  - the lobby's Copy / Share invite (`roomInvite` in `duel.$code.tsx`, `/duel/CODE`);
  - friend challenge links (`ChallengeShare` → `challengeLink`, `/challenge?code=…&ref=challenge`);
  - the daily's Share link (`DailyShareButton` → `dailyShareLink`, `/daily?kind=…&ref=daily`);
  - the public game's calendar file (`downloadCalendar` → `calendarFile`).
- Page head: Open Graph and Twitter card URLs (`LINK_PREVIEW`) on `APP_URL`, plus a new
  `<link rel="canonical">` per path (`canonicalUrl`, no query string).
- `CONTACT_EMAIL` (`src/config/betaConfig.ts`) is `support@joulz.uk`, so the beta terms page
  (`/terms`) now shows the contact line with a mailto link.
- Checks: share-check asserts `APP_URL` and that every share surface builds on it; beta-extras-check
  expects the new `CONTACT_EMAIL` (its "no contact line" pass now stands in an empty value);
  link-preview-check reads `APP_URL`; test URLs in link-join, chat-notice, app-update and
  celebrations checks moved to joulz.uk.
- Unchanged on purpose: `public/manifest.webmanifest` (all its URLs are relative: `/`, `/practice`,
  the icons, so it follows the domain); `public/robots.txt` (no URLs); `previewAuthStorage.ts`'s
  `lovable.app` entry (Lovable's own preview hosts, not our address); the share card image (it draws
  the room code, never a URL).

### Assumptions

- Every link is built on `APP_URL` even from a dev server or Lovable preview, so a link shared from a
  preview leads to the live app (that was the point of a single value). Local checks that open a
  copied link use the path, not the origin.
- The redirects from `brain-blitz-duel.lovable.app` and `playjoulz.com` keep the path and query
  (`/duel/ABCD?ref=share` → `https://joulz.uk/duel/ABCD?ref=share`), so links shared before today
  still work. Worth confirming once on a phone.
- Device records reset (as you said): device storage is per origin, so on joulz.uk each phone starts
  with no remembered look, practice bests, last room, daily streak, challenge list, terms agreement
  (the terms show again once) or offline practice cache, and gets a new anonymous sign-in. Home-screen
  apps added from the old address keep opening it and get redirected; players should re-add the app
  from joulz.uk.

## Things to change by hand (outside the repo)

1. **Lovable Cloud / Supabase Auth**: Site URL `https://joulz.uk`; add `https://joulz.uk/**`
   (and keep `https://brain-blitz-duel.lovable.app/**` while old sessions drain) to the redirect URLs.
   Check any CORS / allowed-origin list for edge functions.
2. **Lovable**: confirm joulz.uk is primary with HTTPS and that both redirects preserve path and query;
   Publish after merging this PR (links only change once it's live).
3. **Email**: create the `support@joulz.uk` mailbox or forwarder (MX records on the joulz.uk DNS), since
   the terms page now shows it.
4. **Sentry** (when `SENTRY_DSN` is set): add `joulz.uk` to the project's Allowed Domains (Security &
   Privacy) if domain filtering is on; any alert or issue-link URLs pointing at the old domain.
5. **Tally** (when `TALLY_URL` is set): any "redirect on completion" or thank-you link back to the app,
   and the form's description text, to `https://joulz.uk`.
6. **Discord**: the server description, welcome / rules channel messages, pinned links and any bot or
   webhook that posts the app's address, to `https://joulz.uk`.
7. **Link previews**: re-scrape `https://joulz.uk/` in the Facebook Sharing Debugger (and similar) so
   the card appears straight away; optionally add joulz.uk to Google Search Console.
8. **App stores / social profiles / beta invites**: anywhere else the old address was posted (testers'
   invite messages, bios, docs outside the repo).
