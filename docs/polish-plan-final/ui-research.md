# UI polish research — Joulz (main 774e5ddb, 18 Nov 2026)

Read-only survey for the UI polish plan. Paths are absolute under `/home/user/brain-blitz-duel/`. Line numbers are as of this commit.

---

## A. The launch screen (owner note 1: bolt filling bottom-to-top with sparks and a sound, maybe Captain Joulz holding it)

### What draws it

- `src/components/nav/LaunchSplash.tsx` (28 lines). Mounted once in `src/routes/__root.tsx:261` (`<LaunchSplash />`, directly after `<Outlet />`, before `AppUpdateOverlay` / `CelebrationLayer`). It renders, with the server-rendered page:
  - `<div className="jz-nav jz-launch" data-launch data-skin="play" data-done=… role="status" aria-label="Joulz is starting">` (line 21)
  - `<NavArt name="bolt" size={96} />` (line 22): a raster WebP from the 3D art kit, **not** the vector LogoMark. `NavArt` is `src/components/nav/NavArt.tsx` (an `<img>` with srcSet 1x/2x; 2x only, no 3x for the bolt). Source map `src/components/nav/navArt.data.ts:18` → `/nav/bolt-1x.webp` (2.4 KB) and `/nav/bolt-2x.webp` (5.0 KB) in `public/nav/`, cut by `bun scripts/nav-art.ts [--check]`.
  - `<span data-one-line className="jz-launch-name"><AppWordmark /></span>` (lines 23–25): the wordmark (white JOULZ + gold vector bolt) under the art bolt.
- Duration: **none fixed**. `useEffect(() => setStarted(!hold), [hold])` (line 19) flips `data-done` on the first client effect, i.e. the moment React hydrates. `hold` is only for `scripts/safe-area-harness.tsx`. CSS `.jz-launch[data-done] { display: none; }` (`src/polish-layout/nav.css:441–443`). So the splash is visible from first server paint until hydration and no longer; there is no exit animation, no minimum display time.
- Styling `src/polish-layout/nav.css:416–466`: `position: fixed; inset: 0; z-index: 200; display: flex; column; gap: 20px; background: var(--jz-surface)` (the panel colour `#0F1424`, **not** `--jz-bg`). The bolt `<img>` gets `animation: jz-launch-in var(--jz-dur-win) var(--jz-ease-out) both` (900 ms; opacity 0.4→1, scale 0.9→1, lines 437–453). Reduced motion: `animation: none` (455–457). `@media (scripting: none)` hides it (461–463). Light theme recolours the wordmark text (434–436).
- What hands over: nothing explicit. The hydrated page simply becomes interactive beneath it; the header's `AppWordmark` then runs its own charge-in (below).

### The vector logo and the existing "charge" animation

- `src/components/brand/logoGeometry.ts`: `LOGO_BOX = { w: 26, h: 34 }` (line 6), `LOGO_UPPER` / `LOGO_LOWER` point lists (9, 15), `LOGO_TRAIL` (22) and `LOGO_LEAD` (29) speed-line geometry, `LOGO_HAIRLINE_PX = 1.5` (28), `LOGO_PATHS = { bolt, trail, lead }` (31; both bolt halves are one path, so no seam), `BRAND_GOLD #E2C07A` (46), `BRAND_INK #06080F` (48), `RING_GOLD` metal stops (52), `LOGO_COLOURS` (80; variants `gold` / `inverted`).
- `src/components/brand/LogoMark.tsx` (169 lines). Props `variant`, `width=17`, `height=22`, `viewBox="0 0 26 34"`, `lineWidth`, `charge`, `depth`. **`charge` is the existing fill animation** (lines 5–12, 14–36, 121–127, 129–166): SMIL `<animate>` on clip-path rects — the bolt facets fill **top to bottom** over `CHARGE_FILL_S = 0.45` s (clip grows `height` from 0 to 34 at y=0), then the two speed lines streak out over `CHARGE_LINE_S = 0.3` from `CHARGE_LINE_AT_S = 0.3`. Easing `keySplines="0.35 0 0.25 1"`. The owner wants bottom-to-top: the `ChargeClip` `axis="down"` rect would need a `y` animation (grow from `y = 34` upwards) — today only `"left"` animates `x`.
  - `depth` (lines 77–81, 107–119, 132–138): the Prepare-to-Duel large bolt in `--jz-metal-gold-1..3` + `--jz-art-gold-deep` gradient with a shine and 0.13-unit edge stroke. The splash could reuse this for a filled "metal" bolt.
- `src/components/brand/AppWordmark.tsx` (47 lines): the header wordmark. Decides `charge` from `logoChargeWanted()` (line 20), plays `logoChargeSound()` (27) and stops charging after `LOGO_CHARGE_MS + 100` (28). Re-charges on `onAppOpen` (32–38). Markup `.ap-wordmark` / `.ap-wordmark-text` / `.ap-wordmark-mark` (40–44), styled in `src/polish-layout/app-pages.css` (`.ap-wordmark`).
- `src/components/brand/wordmark.ts`: `WORDMARK_TEXT`, weight 900, stretch 118 %, `loadWordmarkFace()` for canvases.
- `src/lib/fx/celebrations.ts`: `LOGO_CHARGE_MS = 600` (55); `logoChargeWanted()` (151–154: once per app open, only on the path the app opened on, only with celebrations on); `logoChargeSound()` (160–163: plays `celebrationSound("logoCharge")` **only if `soundUnlocked()`**, "an iPhone blocks sound before the first tap, so the app's first charge-in is silent"); `noteLogoCharged()` (165); `onAppOpen()` (178–196: `pageshow` persisted, or back after `APP_REOPEN_HIDDEN_MS` 30 s hidden). Sound slot `shared.celebrate.logoCharge` → `/sounds/sfx_logo_charge.mp3`, 687 ms, volume 0.6 (`src/lib/fx/manifest.ts:207`).
- Reduced motion: `polish-layout/celebrations.css` draws the mark finished (per LogoMark comment line 54–55).

### App icon / iOS launch screens

- `src/lib/brand.ts:57–85`: `APP_SPLASH_MARK = 0.3` (bolt height as a share of screen width), `APP_SPLASHES` — 11 iPhone sizes, each `href: /splash/splash-<w*dpr>x<h*dpr>.png` with a device-width/height/dpr/portrait `media` query. Linked as `apple-touch-startup-image` from `src/routes/__root.tsx:130`. Drawn by `bun scripts/brand-icons.ts` (lines 13, 104): "the gold bolt (LOGO_COLOURS.gold) centred on --jz-bg", no text. Files in `public/splash/` (10 PNGs listed; brand-assets-check `scripts/brand-assets-check.ts:84` requires ≥ 10, unique). Not kept offline (`src/lib/offline/assets.ts:22`). These are static PNGs — iOS shows them before the web view paints, so any animation must happen in `LaunchSplash` after it; the two should match visually (today: PNG shows a flat gold bolt on `#06080F`; LaunchSplash shows a 3D rendered bolt on `#0F1424` with the wordmark — a visible jump).
- `APP_ICONS` (same file, lines ~40–56): apple-touch 180, manifest 192/512/maskable, favicons; the inverted bolt on ring-gold metal.

### Sound before the first tap (can the splash make a sound?)

- `src/lib/sound.ts` header (lines 5–15): "iOS only counts a gesture inside `touchend` / `click` / `pointerup`… Nothing plays and nothing errors before that first gesture." `unlockAudio()` (568–603) creates the `AudioContext` and plays a one-sample silent buffer (`playSilentSample`, 426–437) — "the canonical iOS unlock, must run inside a gesture". `installSoundUnlock()` (610–623) attaches capture listeners for `touchend`, `pointerup`, `click`, `keydown` on `document`; installed from `src/routes/__root.tsx:212`. `soundUnlocked()` (626–628) is what `logoChargeSound` consults.
- Speed fix 1 (CLAUDE.md): the first tap decodes only sound group `core`; `firstTapSoundUrls()` (`sound.ts:123`).
- **Conclusion:** a splash cannot play a sound on a cold open on iOS (and Chrome's autoplay policy is similar). Options the code already supports: (a) a *returning* open (`appReopened()` / `onAppOpen`) where the context already exists — `logoChargeSound()` already plays then; (b) make the splash tappable ("Tap to start") so the first gesture both unlocks audio and triggers the fill + sound; (c) keep the visual fill silent on first open and sound it on re-opens, exactly the current `AppWordmark` rule.

### Captain Joulz art available for the splash

- Approved SVG poses copied byte-for-byte to `public/art/` (`captain-joulz-ready`, `-win`) and drawn by `Captain` from `@/design/art` (CLAUDE.md "First impressions"); canvas `drawCaptain` in `src/lib/arcade/hero.renderer.ts` with `CAPTAIN_POSES`. Rainbow Bridge has `inkbridge-captain-ready` / `-win` renders in `public/strategy/`. Sports has `sportsCaptain.renderer.ts`. None holds a bolt; a "holding the logo" pose would be new art.

---

## B. Home (`/`) — sections, slots, and what appears late (owner note 2)

### Files

- Route: `src/routes/index.tsx` (255 lines). Sections: `src/components/home/HomeSections.tsx` (369). Art: `src/components/home/HomeArt.tsx` + `homeArt.data.ts` (WebP 1x/2x/3x in `public/home/`, built by `scripts/home-art.ts`). Styles: `src/polish-layout/home-play.css` (`.hp-*`). Slots: `src/components/app/PlaySlot.tsx`, `src/lib/playCards.ts`, hide rules `src/polish-layout/app-shell.css:92–131`. Shell/header: `src/components/duel/PhoneShell.tsx:504–644`, `src/components/app/AppHeader.tsx`.

### Order of the page (index.tsx:175–252), top to bottom

| # | Element | Source of data | Reserved before paint? | Can it appear late / shift? |
|---|---|---|---|---|
| 0 | `PhoneShell tabs="play"` header: `AvatarButton` left (`AppHeader.tsx:43–44`, size 36), page title, streak chip (`HeaderLead`, index.tsx:162–168, only when `streakNow > 0`), bell (off: `HOME_BELL`), `CoinCounter` right (`AppHeader.tsx:53–54`, only when `useCoinCount()` non-null). | account (`useAccount`, network), daily record (`useDailyRecord`, network), identity wallet (`useMyIdentity`, network) | No | **Yes**: avatar swaps from guest `PlayerBadge` (colour 0 initial "Y") to the account's `MiniCard` once `useAccount` + `useMyIdentity` answer (`src/components/identity/MyMiniCard.tsx:14–23`; `AvatarButton.tsx:63` marks `data-nav-avatar="loading"` meanwhile). Streak chip pops in when the daily record arrives. Coin counter pops in (accounts with shop on). Same header height, so content below does not move, but the header's contents flash. |
| 1 | `PlaySlot id="intro"` → `IntroCard` (196–205) | device storage | **Yes** (`PLAY_CARDS_BOOT` token `intro`) | No |
| 2 | `PlaySlot id="welcome"` → `ShareWelcomeCard` (206–208) | `?ref=share` + storage | **Yes** (`welcome`) | No |
| 3 | `PlaySlot id="daily"` → `DailyHero` (211–220): the Daily Puzzle / Daily Arcade carousel | `useDailyStatus()` (`src/components/daily/DailyCard.tsx:38–55`, server fn `dailyStatus()` in `src/lib/duel/asyncApi.ts:25`), `useDailyPlayedToday()` (`src/lib/home/homeData.ts:15–37`, `dailyPlayedTodayFn`) | **Yes** (`daily`, unless cache says `available: false`) | Height fixed (`.hp-daily { min-height: 188px }`, home-play.css:106–116). Text lines swap "New today" → "694 played today" / "Done · 742" and the button label Play → Continue/Results in place (`shownDailyStatus`, DailyCard.tsx:61–71 draws the cached status until the server answers). Collapses over 420 ms only if the server says unavailable. **Low shift risk.** |
| 4 | `NextMatch` (222; HomeSections.tsx:144–217) "Your next match": rated quick-match card, else most recent friend, else a Practice suggestion | `useRatedStatus()` (`src/lib/rated/ratedApi.ts:76–102`, network after `useAccount` settles), `useFriendsOverview(accountId)` (homeData.ts:42–58, `friendsApi.overview()`), `warmUpTypes` (device, before paint) | **No** | **Yes, the main culprit.** On first render `rated` is null and `friends` empty, so a device with recent practice shows the Practice card at once; when `useRatedStatus` answers (testers / everyone once `RATED_PLAY_FOR_EVERYONE`), the card re-renders as the rated card (different art: `HomeArt rated` 44 px vs `GameIcon` 56 px; different button: gold 44 vs secondary 48) — content changes in place, height may differ by a few px. A device with **no** practice history renders nothing for this section until rated/friends arrive, then the whole section (SectionHeader + card, ~100 px) **pops in** and pushes everything below down. `pick` is set in an effect after `rated` (140–142), one more re-render. |
| 5 | `RatingTiles` (224; HomeSections.tsx:221–253) "Ratings" with three `StatTile`s | `useRatedStatus()` | **No** | **Yes**: rendered only when `rated` is non-null → the whole section appears after the rated status call (seconds on a slow connection). |
| 6 | `RecentlyPlayed` (226; 257–295) | `recentPracticeTypes()` from device storage in `useBeforePaint` (117–124) | n/a (client-only before paint) | Hydration mismatch risk only: server renders nothing (empty `recent`), client fills before paint. Not a late pop after paint. |
| 7 | `PlaySlot id="homescreen"` → `HomeScreenHint` (228–230) | storage + UA | **Yes** (`homescreen`) | No |
| 8 | `.hp-narrow` → `WeeklyCard` + `FriendsRow` (233–236; phone only, `[data-layout] .hp-narrow { display: none }` home-play.css:409) | `usePass(eligible)` (`src/lib/pass/passApi.ts:116–133`; `eligible = shopOn || cachedPass(playerNumber)`), `useFriendsOverview` | **No** | **Yes**: `WeeklyCard` returns null until `pass.state === "open"` with weekly challenges (network); `FriendsRow` returns null until the overview answers. Both pop in below the fold on most phones but above "How it works". |
| 9 | "How it works" link (238–250) | — | — | Pushed down by 4, 5, 8. |
| aside (desktop/tablet) | `WeeklyCard`, `FriendsRow`, `WeekPanel` (180–187) | as above | No | Same pops, in the right column. |

### The named sources of "appears after a few seconds" on Home

1. **`useRatedStatus`** (`src/lib/rated/ratedApi.ts:76–102`): waits for `useAccount` (itself a network call, `src/lib/account/accountApi.ts:119–131`, `refreshAccount`) then `refreshRated()`; gates `NextMatch`'s rated card and the whole `RatingTiles` section. Nothing is cached on the device for the first paint (unlike daily status, which `playCards.ts` caches).
2. **`useFriendsOverview`** (`src/lib/home/homeData.ts:42–58`): one network call per account id; gates `FriendsRow` and `NextMatch`'s friend fallback.
3. **`usePass`** (`src/lib/pass/passApi.ts:116–133`): gates `WeeklyCard`; `cachedPass` (41–49) only remembers whether the pass is open, not its weekly content, so the card still waits for the server.
4. **`useAccount` → `useMyIdentity`** (`src/lib/identity/identityApi.ts:81–95`): the header avatar swaps guest badge → MiniCard; `CoinCounter` appears (`src/components/app/CoinCounter.tsx:27–40`).
5. **`useDailyRecord`** (`src/lib/badges/badgesApi.ts:276–288`): the streak chip appears in the header once the server (or the device record, set in an effect) answers.
6. **`useDailyPlayedToday`**: text-only change inside the hero.
7. **`useShopOn`** (`src/lib/identity/shopSwitch.ts:54–`) can add the fifth Shop tab for testers once `shopStatus` answers (cached per player number in `duelz-shop-tester:v1`, `src/lib/shop/shopStatus.ts:18, 57–98`, so usually at first paint for a returning tester).

The reservation mechanism that solved this for the Oct 2026 cards — `PLAY_CARDS_BOOT` inline script writing `<html data-play-cards="…">` before paint (`src/lib/playCards.ts:160–180`), `PlaySlot` drawing the last known state (`PlaySlot.tsx:10–18`), CSS hiding unreserved slots (`app-shell.css:107–114`), proved by `scripts/play-tab-shift-check.ts` — only covers `daily | challenge | rejoin | welcome | homescreen | intro` (`PlaySlotId`, playCards.ts:50). `NextMatch`, `RatingTiles`, `WeeklyCard` and `FriendsRow` were added on 14 Nov 2026 **outside** it. A fix that follows the house pattern: add `rated`, `week`, `friends` slot ids with cached last-known state (rated standing, weekly challenge texts, friend ids/looks) in the `duelz-play-cards:v1` record, reserve them in the boot script, and give each section a fixed `min-height` skeleton while pending.

### Hero card specifics (for notes 5 and 6)

- `DailyHero` (HomeSections.tsx:61–98): `<section data-daily-card class="hp-hero">` → `.hp-hero-track[data-scroll-x]` (grid, `grid-auto-columns: 80%`, scroll-snap; home-play.css:91–105) → two `<article class="hp-daily jz-cut-lg" data-hp-daily="puzzle|arcade">`.
  - Puzzle card: `background: linear-gradient(160deg, var(--jz-metal-obsidian-2), var(--jz-metal-obsidian-3))` (117–119, i.e. `#1E2640 → #0B0F1C`), angled cuts, `min-height: 188px`, art `HomeArt dailyPuzzle` (200×125 source, "A board of coloured puzzle blocks", `public/home/dailyPuzzle-{1,2,3}x.webp` 4/8.8/14 KB) absolutely placed `right: -18px; bottom: 10px; width: 58%; max-width: 220px` (125–132); title in `--jz-metal-silver-1`, line in `--jz-metal-silver-2` (158–171); gold `Button size=48` "Play / Continue / Results" bottom-left, `width: min(172px, 52%)` (172–176, line 81–83).
  - Arcade card: `border-radius: var(--jz-radius-lg); clip-path: none; background: var(--jz-surface)` (120–124); art `HomeArt dailyArcade` 64×64 (joystick) in grid row 1 (133–139); **no visible Play button** — the whole card is a transparent `<button class="hp-daily-cover press">` (84–86, 177–181). Owner wants the same style as the puzzle card, a visible play button and larger art.
- The `/daily` page's own hero (`src/routes/daily.tsx:389–460`): `<Panel pad class="dl-hero jz-cut-lg">` with `TournamentArt name="puzzles"|"arcade" size={56}`, kicker "Today" in `--jz-gold-ink`, title, line, then a block gold `Button size=52` Play/Continue or secondary "Your results". CSS `src/polish-layout/tournaments-pages.css:401–430`. Plain `--jz-surface` panel; no gradient, no category colours.
- The older list-row `DailyCard` (`src/components/daily/DailyCard.tsx:78–133`, `DailyPuzzleTile` / `DailyArcadeTile` 44 px SVG tiles in `src/components/app/TabIcons.tsx:8–60`) is still used by `PageAside`'s "daily" panel (`src/components/app/PageAside.tsx`).
- Category colour tokens for a moving gradient: `src/design/tokens.css:224–237` — `--category-word #4D8CFF`, `--category-number #3DDC84`, `--category-speed #FF8A3D`, `--category-attention #FF6BD6`, `--category-pattern #B26BFF`, `--category-logic #2ED3B7`, `--category-arcade #FF4D4D`; arcade groups `--group-retro #36E2F5`, `--group-sports #4CC24A`, `--group-cards #FF5C93`, `--group-action` (= arcade), `--group-strategy #8E80FF`. `[data-cat="…"] { --cat: … }` mapping in `src/polish-layout/theme.css:55–67`. There is no `--jz-cat-*` alias. Note design-lint (`scripts/design-lint.ts`) fails new `@keyframes` that end hidden without a reduced-motion rule, and the reduced-motion global rule zeroes animations — a moving gradient must be `transform`/`background-position` based, loop, and stop under `prefers-reduced-motion` (see `src/lib/arcade/skins/motion.renderer.ts` and the `.pcard` rule for precedent).
- A jigsaw-piece path already exists: `DailyPuzzleTile`'s `piece` path (`TabIcons.tsx:9`).

---

## C. Avatars (owner note 3: drop the circular background)

### Where the circle comes from

- **It is baked into every avatar SVG source**, not added by CSS. `docs/art/avatars/source/avatars.py:79`: each avatar is `<svg viewBox='0 0 100 100'><defs><clipPath id='…c'><circle cx='50' cy='50' r='48'/></clipPath>…</defs><circle cx='50' cy='50' r='48' fill='{bgfill}'/><g clip-path='url(#…c)'>{glow}{g}{over}</g>{rg}</svg>`. `bgfill` is `bg` (line 62; e.g. `#1E2640` = `--jz-surface-2` in `captain-joulz.svg`) or a gem gradient (line 71). Inside the clip: the game scene at 42 % opacity under a 35 % `#06080F` wash, a 25 % dark inner disc (`r=38`), then the figure. Gem looks add rings at r 45.5–49 (lines 72–77).
- `docs/art/avatars/README.md`: 32 avatars, 100×100 box, "thick dark outline (#06080F), a glossy main colour… a faint scene from its game behind it (42 % opacity under a 35 % dark wash)". Files `docs/art/avatars/svg/<slug>.svg` (32 avatars + 10 `gem-example-*.svg`, 42 files), `avatars.json` (slugs, names, `defaultMain`, gem stops), `source/{avatars,avatars2,avlist,scenes}.py`.
- Build: `scripts/player-card-art.ts:158–175` reads `avatars.json` and each `svg/<slug>.svg`, templates the main-colour gradient as `{{m0}} {{m1}} {{m2}}`, prefixes ids, writes `AVATARS` into `src/design/identity/playerCardArt.data.ts:241+` (`{ id, name, defaultMain, svg }`) plus `GEMS`. **Re-run after changing the sources.** Removing the circle means editing the Python (or post-processing in the script: drop the `<circle … r='48' fill=…>` and the clip, keep the figure), then rebuilding.

### Where avatars are drawn

- `src/design/identity/avatars.ts:49–55` `avatarMarkup(look, prefix)`: substitutes the colour stops, then `dressAvatar` for cosmetics (`cosmetics.ts`). `avatarStops` (40–46) = 38 % lighter / main / 28 % darker (`shade`, 27–33). `DEFAULT_AVATAR = captain-joulz, colour -1`.
- `src/design/identity/Avatar.tsx` (24 lines): standalone avatar (Customise picker), `dangerouslySetInnerHTML` at `size`.
- `src/design/identity/PlayerCard.tsx`:
  - Full `PlayerCard` (lines ~76–197): `<span class="pcard-av">` at 58 card units in `.pcard-row` (CSS in `CARD_CHROME_CSS`, `playerCardArt.data.ts:440`: `.pcard-av{flex:none;width:calc(58 * var(--pc-u));height:…}`); a guest instead gets `.pcard-av.pcard-initial` — a **CSS circle** (`border-radius:999px;background:var(--pc-badge)…box-shadow:0 0 0 3u #06080F`).
  - `MiniCard` (253–294): the card's two end slices as a square (`.pcard.pcard-mini`), avatar in `.pcard-mini-av` at `top/left 13%, width/height 74%` (`src/polish-layout/identity.css:432–449`).
  - `NameplateStrip` (300–): `.pcard-strip .pcard-av { width: 30px; height: 30px }` (identity.css:408–411).
- `src/design/identity/NameplateStrip.tsx` / `nameplate.ts`: hidden players draw "a plain neutral disc" (identity.css ~452+).
- Guests everywhere: `src/components/duel/PlayerBadge.tsx:25–50` — an inline-styled **circle** (`borderRadius: "50%"`, background = player colour) with the initial or `PlayerIconSvg`. Used by `MyMiniCard` for guests (`src/components/identity/MyMiniCard.tsx:23`), `FriendFace` without a look (HomeSections.tsx:138–141), lobbies.
- Header avatar: `src/components/nav/AvatarButton.tsx:26–77` → `MyMiniCard` size 36 (header) / 30–32 (rail); `.jz-nav-avatar` wrapper `min 44×44, border-radius: var(--jz-radius-sm)` (`nav.css:90–103`). For an account the header shows the **mini card** (card art + frame square with the avatar inside), which the owner may also read as "a background".
- Cosmetics: `src/design/identity/cosmetics.ts` (`dressAvatar`, `hasCosmetics`, `ensureCosmeticStyles`), data `cosmeticsArt.data.ts`; the `.jzc` class scopes finish/accessory motion. The Neon Bolt / finishes are composited on the same 100×100 box, so dropping the disc must keep their geometry.
- Checks that pin this: `identity-screens-check`, `identity-motion-check` (every item against approved PNGs), `player-strips-check`, `tournament-plates-check`, `celebrations-off.json` (icon markup). Changing `AVATARS` markup will need their fixtures reviewed.

---

## D. Tokens (owner note 4: bolder navy, deeper black)

File: `src/design/tokens.css` (406 lines). Spec: `DESIGN.md` §2 (lines 35–68), light theme §2 (99–108), decisions (321–332). Style guide round 2: `docs/design/style-guide/STYLE-GUIDE.md` (colour table lines 42–70), proposal `tokens.proposed.css`.

### Current values (dark, `:root`, tokens.css:36–88, 192–222)

| Token | Value | Use (DESIGN.md) |
|---|---|---|
| `--jz-bg` | `#06080F` | page background (Decision 1: "navy-black #06080F replaces #0B0B0F") |
| `--jz-bg-raised` / `--jz-raised` | `#0B0F1C` | tab bar, rail, sheets, sticky footers (lines 39, 195) |
| `--jz-surface` | `#0F1424` | panels, rows, cards, tiles, secondary buttons; **also the launch screen background** |
| `--jz-surface-2` | `#1E2640` | secondary buttons, tracks, dividers; the avatar disc colour |
| `--jz-surface-3` | `#28335A` | pressed / selected (196) |
| `--jz-line` | `#1E2640` | hairlines |
| `--jz-well` | `#06080F` | inputs sunk into panels |
| `--jz-navy` / `--jz-navy-edge` | `#1B2644` / `#2E3B63` | "the second control colour beside the champagne gold (the game overhauls, 15 Nov 2026)" (64–66); used in game chrome (Iron Wall panel, Word `data-wa-btn="navy"`), not on pages |
| `--jz-cyan` / `--jz-cyan-panel` | `#22E4FF` / `#112A3A` | live/info; tinted panel for head-to-head, "next up", the public game's date tile. Used in `src/design/components.css:375` (Panel `data-tone="cyan"`), `polish-layout/leaderboards.css:185`, `rated.css:493`, `app-pages.css:414` |
| `--jz-text` / `-2` / `-3` | `#EEF2FF` / `#B5C6DD` / `#8F9BBF` | 16.4 / 10.5 / 6.6 : 1 on surface |
| `--jz-gold` / `--jz-gold-ink` / `--jz-button-gold-face` | `#E2C07A` (all three) | champagne; `--jz-gold-metal` gradient for medals/emblems only; `--jz-gold-ledge #A8843E`; `--jz-on-gold #06080F` |
| `--jz-metal-obsidian-1..4` | `#4A5680 / #1E2640 / #0B0F1C / #36406A` | the Daily Puzzle hero gradient uses -2 → -3 |
| `--screen-edge` | `#070709` (styles.css, kept apart from `--jz-bg` for the fill checks; DESIGN.md:89) | html/body behind pages and the home-bar strip |

Elevation: `--jz-elev-1` (inset top highlight + 4 px ledge), `--jz-elev-2` (sheet shadow). Radii `--jz-radius-sm/md/lg` 8/12/16, cuts `--jz-cut-lg 14px`.

### Light theme hook

- `:root[data-theme="light"]` (tokens.css:282–331) overrides the neutrals and inks; `:root[data-theme="light"] :is(.game-screen, [data-skin-off], .pcard)` (341–406) puts the dark values back for game screens, game art and player cards, and rebuilds the `--th-*` / `--ap-*` aliases. Applied by `src/lib/appearance.ts:58–62` (`applyAppearance` → `data-theme="light"` or removed), boot before paint (line ~116), Settings → Appearance. `polish-layout/light.css` holds page rules that drew fixed darks (9 light overrides), `nav.css` 10 light-theme rules. theme-check proves 50 contrast pairs.

### Who uses what

- Pages (`[data-app-page]`, `app-pages.css:44–`) remap shadcn vars onto `--ap-*` which alias `--jz-*`. `.jz-panel` = `--jz-surface` + 16 px radius (`components.css:366–370`). Tab bar `[data-tab-screen] .app-tabbar.jz-nav-bar { background: var(--jz-raised); border-top: 1px solid var(--jz-line) }` (`nav.css:15–17`). Hero cards: Home daily → obsidian gradient; Shop bundle → `linear-gradient(120deg, --jz-surface-2, --jz-surface 70%)` (`shop.css:79`); Games hero → `color-mix(in oklab, var(--cat) 34%, --jz-surface) → --jz-surface 78%` (`games.css:156–160`); chips → `color-mix(--cat 42%, --jz-surface)` (`games.css:607–611`).
- Changing `--jz-bg`/`--jz-surface*` in tokens.css reaches every page at once; the mirrors must follow: `BRAND_INK` in `src/components/brand/logoGeometry.ts:48` ("mirrors --jz-bg", brand-assets-check), `appearance.ts:21` (light bg mirror), `THEME_COLOR`/manifest background (`brand.ts`, `og-image.ts`, `brand-icons.ts`), `tokens.proposed.css`, and DESIGN.md §2 + the style guide table. design-lint-check forbids new raw hex outside tokens.css. `--screen-edge #070709` is compared against by the bottom/fill checks and should stay as is unless those are re-recorded.
- A "bolder navy" fits the existing `--jz-navy`/`--jz-navy-edge` and `--jz-metal-obsidian-*` ramp; "deeper black" would mean lowering `--jz-bg` toward `--jz-ledge-2 #03050A` and re-checking the 4.5:1 pairs (text-3 on bg is the tightest).

---

## E. Daily cards

Covered in B above (Home `DailyHero`, `/daily` `.dl-hero`, aside `DailyCard`). Additional pointers:

- `src/lib/duel/daily.ts`: `DAILY_KINDS`, `DAILY_TITLE`, `DAILY_ROUNDS`, `DailyStatus/DailyState` (`play | continue | done`).
- `src/components/daily/DailyYou.tsx` (your line on /daily), `DailyShareButton.tsx`.
- Art-kit sources for the hero cards: `docs/design/style-guide/art` (cut by `scripts/home-art.ts` → `public/home/`; `scripts/tournament-art.ts` → `public/tournaments-art/` for `TournamentArt name="puzzles"|"arcade"`).
- The Daily's games can't be read by a phone (server-dealt), so a "category colours" background must use **all** puzzle category tokens, not today's actual categories (same reason `gameOfTheDay.ts` exists).
- Checks touching these: theme-check / no-wrap-check screens (`scripts/theme-screens.ts`, `scripts/daily-fixture.ts`, `scripts/screens/tournaments.ts` with harness mode `dailyarchive`), `play-tab-shift-check` (Home positions within 2 px from first frame), `app-moments-check`, `reduced-motion-end-check`.

---

## F. Shop (owner note 7)

- Route `src/routes/shop.tsx` (102 lines): `PhoneShell tabs="shop" title="Shop"` → `.ap-stack[data-shop-page]` → `Segmented` Shop · Pass · Plus (78–88) → `ShopFront` / `PassScreen` (`src/components/pass/PassScreen.tsx`) / `PlusPart` (`src/components/plus/PlusPart.tsx`). `SOON` copy (43–50). Behind `useShopOn` (testers until `SHOP_TAB_ENABLED`).
- `src/components/shop/ShopFront.tsx` (198): `.shop-front` → optional `.shop-said` status → loading: two `Skeleton`s (200 + 160 px, lines 117–121) → closed: `EmptyState layout="card" tone="cool"` "Opening soon" (122–136) → open: `BundleCard` hero (139–148), "Today" `SectionHeader` + `.shop-grid` of `ItemCard`s (149–163), `CoinPacks` anchored for `?section=coins` (164–166), `BundleSheet`, `ShopConfirm`.
- `BundleCard.tsx` (67): `<section class="shop-hero jz-cut-lg">`, kicker / name / "n items · X separately" / secondary price button with `Coin`, up to three `ShopArt` stills (`data-count`). CSS `shop.css:70–153`: `min-height: 208px; background: linear-gradient(120deg, --jz-surface-2, --jz-surface 70%)`; kicker pill `--jz-surface-3`.
- `ItemCard.tsx` (82): `<article class="shop-tile" data-rarity>` → `.shop-tile-art[data-skin-off]` (4:3, `background: var(--jz-bg)`, `shop.css:170–178`) with `ShopArt` + `.shop-heart` → name → `.shop-rarity-word` + kind → `Button variant="secondary"` price with `Coin` / "Owned" / "Get coins". Tile `background: var(--jz-surface)`, 16 px radius (160–168). Rarity colours `--jz-rarity-epic/elite/legendary` (tokens.css:80–82) used only on the word.
- `CoinPacks.tsx` (94): `<section class="shop-section" id="shop-coins">` → `ul.shop-packs` (2-col grid) → `li.shop-pack` (`--jz-surface`, centred; `shop.css:291–335`) with `.shop-pack-art` = 1–4 stacked `KitArt name="coin" size={44}` overlapping `-20px` (`public/shop-art/coin-{1,2,3}x.webp`, `shopKitArt.data.ts:4`), coins line, price as text or (tester) secondary button. **No motion, no shine**: the "sparkle" the owner wants is absent; the only effect vocabulary available is `gameFx` (`src/lib/fx/kit.ts`: `stars`, `newBest`, `win`, transform/opacity only) and the celebration spark burst (`src/lib/fx/celebrations.ts`, `CelebrationLayer`). Packs data `src/lib/shop/packs.ts:20–25`: 500/£0.99, 1,000/£1.79, 3,000/£4.99, 10,000/£14.99 ("best value" note unused in the UI).
- `ShopArt.tsx` (36): `<img src="/shop/<id>.webp?v=hash" loading="lazy">`, 78 stills in `public/shop/` from `bun scripts/shop-previews.ts` (SHOP_PREVIEWS in `src/lib/shop/shopPreviews.data.ts`); `Heart`, `RARITY_NAMES`, `RarityTag`.
- `ShopConfirm.tsx`, `BundleSheet.tsx`, `ShopBackNotice.tsx` (wishlist-back toast). Styles `src/polish-layout/shop.css` (backgrounds are all `--jz-surface` / `--jz-surface-2` / `--jz-bg`: lines 79, 93, 168, 176, 191, 307, 369, 553, 561, 608, 628 — hence "dark, nothing engaging").
- Pass part: `PassScreen.tsx` (`.pass-loading` skeleton, `.shop-soon` closed state, rewards with `ShopArt`/`CardPiece`/`NamePiece`/`KitArt`, `JoulesBolt`); `src/polish-layout/pass.css` (surfaces only; `--jz-joules` and `--jz-gold` on progress, lines 93, 164).
- Mockups: `docs/design/style-guide/phone/shop.png`, `desktop/shop.png`. Checks: shop-check (server), screens in theme-check/no-wrap-check; shots `bun scripts/shots/shop-shots.ts` → `docs/economy/shop-screenshots/`.

---

## G. Games catalogue (`/practice`, owner note 8)

- Route `src/routes/practice.tsx` (`PhoneShell skin="practice" railTab="practice"` line 738; `aside={<PageAside panels={["public","daily","week"]} />}` line 763). Catalogue `src/components/games/GamesCatalogue.tsx` (335): `CatalogueHeaderTools` (34–66: star total `gm-star-total` + search toggle, drawn in the page header) and `GamesCatalogue` (68–258):
  1. optional `.gm-search` `Input search size=44` (154–168);
  2. `Segmented tone="gold"` Puzzles | Arcade with counts (`.gm-side`, 169–187);
  3. **category chips**: `.gm-cat-tiles[data-scroll-x]` (188–211) → `button.gm-cat-tile[data-cat]` with name + count. CSS `games.css:581–630`: one sideways-scrolling row with a right fade mask; each chip `min 96×64`, `border: 2px solid var(--cat)`, `background: linear-gradient(160deg, color-mix(in oklab, var(--cat) 42%, --jz-surface), --jz-surface)`, 12 px radius; pressed = 3 px border + 2 px ring. (An older `.gm-chips` rule for `.jz-chip`s, games.css:43–68, is no longer used by this markup.)
  4. `LevelSwitch` (difficulty for every game) + `LevelIntro` (212–213);
  5. `.gm-grid` (215–249): optional `HeroTile` spanning all columns, then one `.gm-tile-wrap[data-practice-game]` per game holding `GameTile size="card"` + `TileLevel` (level name + "Best n"). Grid 2 columns on a phone, 3 at `@container (min-width: 400px)` or any `[data-layout]`, 4 at 640, 5 at 900 (`games.css:69–94`).
- `HeroTile` (285–331): `button.gm-hero[data-games-hero][data-cat]` with kicker "Game of the day", name, tag dot, `Stars size="m"`, and `GameIcon size={168}` right (136 px; 168 from 560 cqw). CSS `games.css:146–215`: `min-height: 176px`, angled `clip-path`, `background: linear-gradient(135deg, color-mix(in oklab, var(--cat) 34%, --jz-surface), --jz-surface 78%)`. Game of the day: `src/lib/duel/gameOfTheDay.ts` (FNV-1a of UK day + id, phone-side).
- `GameTile` `src/design/components/GameTile.tsx` (96): `size="card"` (47–67) = `GameIcon size 160` filling a 16 px-cornered `--jz-surface` square + `.jz-tile-card-foot` (name bottom-left in `--jz-white`, `Stars` bottom-right) over a `transparent → color-mix(--jz-art-edge 78%)` band (`components.css:921–952`). Comment line 14–15: "Today's tile art stands in until step 4's key art."
- Tile art: `GameIcon` (`src/components/app/GameIcon.tsx:39–57`) → `<img class="game-icon-img">` from `tileSceneUrl(type)` (`src/components/app/gameIcons/tileScenes.data.ts`, content hash per URL) → `public/tiles/<type>.webp` (104 files, 208 px, ~2–13 KB, built by `bun scripts/shots/tile-scenes.ts` from `scripts/shots/tile-scenes/<category>.tsx` + `backgrounds.ts`). Wrapper `.game-icon { border-radius: 28%; overflow: hidden }` (`app-shell.css:57–65`), category border via `--gi-border` and `data-cat`/`data-group` → `--cat` (`theme.css:55–67`). `StyledGameIcon` for equipped tile styles (E2). Within the card the icon's radius is reset to 0 (`components.css:928–933`).
- Shelves: `src/components/games/gameMeta.ts` `catalogueShelves()` (44–59: six puzzle categories by `CATEGORY_NAMES`, then arcade groups by `arcadeGroupInfo`), `shelfSide`, `catalogueGames`, `onShelf`, `gameTag`, `gameSeconds`, `gameGuide`.
- Game page `src/components/games/GamePage.tsx` (179; comment 26–37): `.gm-page` art (`GameIcon` in `.gm-page-art` on a radial gradient, `games.css:243–262`), back, name, stars, tags, time, guide panel, challenges (`ChallengeRows.tsx`), level selector, sticky gold Play (`.gm-page-play`, gradient to `--jz-bg`, 375–384; two-column from a container width, 386). Link helper `src/lib/nav/gamePage.ts`.
- Mockups `docs/design/style-guide/phone/catalogue.png`, `desktop/catalogue.png`, `intro.png`; review `docs/design/pages-review/games/GALLERY.md`. Checks: `practice-switch-check`, `tile-scenes-check`, screens `scripts/screens/games.ts`; shots `bun scripts/shots/games-shots.ts`.

---

## H. Desktop / tablet layout (owner note 9)

- Breakpoints `src/lib/layoutMode.ts:20–23`: desktop = `(min-width: 1024px) and (min-height: 500px) and (hover: hover) and (pointer: fine)`; tablet = `(min-width: 700px) and (min-height: 500px)` otherwise; phone below. `useLayoutMode()` (44). Rail placement `src/components/nav/navigation.ts:29–48` (`rail` on desktop or landscape tablet main screens, else `bar`).
- `PhoneShell` (`src/components/duel/PhoneShell.tsx:504–644`): sets `data-layout={tablet|desktop}` (576), `data-nav-rail` (577), `data-tab-screen`, `data-skin`, `data-shell-column="page"|"game"` (597), `data-app-page` (599). Draws `AppRail` (592) when `railHere`, `BannerSlot` on desktop tab pages except profile/shop (616), the route's `aside` on `wider && tabPage` (620), the room panel / arena panel (622–628), `PlayBar` + `AppTabBar` only when `!railHere` (630–631). The page column keeps the phone classes `mx-auto max-w-[430px] pad-safe` (603).
- `AppRail` `src/components/app/AppRail.tsx` (106): `nav.dk-rail.jz-nav.jz-nav-rail[data-app-rail=full|compact]`: logo (AppWordmark / LogoMark), `AvatarButton` (30/32 px with name), `PlayBar variant="rail"`, `TabBar variant="rail"`, footer search form, `CoinCounter place="rail"`, settings. Widths `--dk-rail 240px`, `--dk-rail-compact 76px`, `--dk-aside 320px`, `--dk-panel 380px` (`src/polish-layout/desktop-layout.css:23–26`).
- `PageAside` / `BannerSlot` / `WeekPanel` `src/components/app/PageAside.tsx` (174): banner = `aside.dk-banner[data-banner-slot]` 112 px from `src/config/banners.ts` (house promotions; hidden when none, which is today's state: `PUBLIC_GAMES` empty); panels `public | daily | week` as `.ap-section`s with `.jz-panel`s.
- CSS: `src/polish-layout/desktop.css` (100): page column `max-width: 480px` (21–24), puzzle column ≤ 560×1000, arcade ≤ 640×1120 (26–40), hover brightness. `src/polish-layout/desktop-layout.css` (720): tablet `@media (min-width: 700px)` (257–294): tab pages a grid `minmax(0,1fr) 280px`, `max-width: 980px`, non-tab pages 600 px; desktop `@media (min-width: 1024px)…` (298–): tab pages `padding-left: 240px`, grid `minmax(0,1fr) 320px`, `max-width: 1240px`, `padding: 28px 32px 40px`, banner spanning both columns, aside in column 2 spanning 40 rows (300–329); the old Practice list rules (332–404, `[data-practice-tools]`, `[data-practice-group]` — markup replaced by the catalogue, mostly dead); non-tab pages `padding-left: 76px`, `max-width: 760px` (408–415); room panel 380 px (411, 425); game modes wide/tall/rotate (437–486); `data-dk-fade` edges.
- **Which pages have a desktop-specific layout vs. the centred phone column:**
  - Two-column tab pages (main + 320 px aside): Home (`index.tsx:180–187`, aside = WeeklyCard, FriendsRow, WeekPanel), Games (`practice.tsx:763`), Tournaments (`tournaments.tsx:217`), Profile (`profile.tsx:151`). Shop and More have **no aside** → a single column that is `grid-column: 1` of a 1fr/320px grid, so the right 320 px is empty.
  - Catalogue-specific: `.gm-grid` 3–5 columns by container width; `.gm-chips` wraps under `[data-layout]`; `GamePage` two columns at a container width (`games.css:386`).
  - Everything else (More, Settings, Leaderboards, Daily, Challenges, Friends, Customise, account, rooms' lobby/results): the phone column centred at 480 px (desktop.css) / 760 px with the compact rail (desktop-layout.css:414–415); room screens add the 380 px `RoomPanel`.
  - Game screens: own modes (`DESKTOP_MODES`, `src/lib/duel/desktopModes.ts`), the arena side panel (`ArenaGamePanel`, `src/lib/gameFrame/arena.ts`).
- Checks: desktop-layout-check (`play22`/`play23`), desktop-geometry-check (1366×768, 1440×900, 1920×1080, 1280×720), nav-check, `NAV_SIZES` in theme/no-wrap. Mockups `docs/design/style-guide/desktop/*.png` (home, catalogue, shop, more, profile, play, list, intro, puzzle, arcade, sheet, challenges). Docs `docs/desktop-layout.md`.

---

## I. The other pages, one line each

- **More** `src/routes/more.tsx` (157): `PhoneShell tabs="more"` → `.jz-nav.jz-nav-page[data-more-page]` → grouped `Row`s (`.jz-nav-row` with `NavArt` icon): Profile, Friends (waiting badge), Leaderboards · Challenges, Daily · Plus (shop on), Settings, Support (lines 63–86), then `.jz-more-brand` wordmark footer (89). Light theme reaches this page in full (`nav.css:466–`). Mockup `phone/more.png`.
- **Profile** `src/routes/profile.tsx` (310): `PhoneShell tabs="profile"` with settings icon button (147), `ProfileCard` (114; `src/components/identity/ProfileCard.tsx`, the player card + Customise), `ProfileRatings` (161), Mastery stars panel with `Progress` and gem `ProfileArt` (167–195), Recent matches (202–250, device history, `PlaceDisc`), `ProfileBadges`, `ProfileFriends`, `SeasonSection`, `TrophyCabinet` (258–264), guest "Get started" steps (270–292), `FeedbackLink`; aside at 151. Styles `src/polish-layout/profile.css`.
- **Settings** `src/routes/settings.tsx` (81) → `src/components/settings/SettingsPage.tsx` (`SettingsHead` + `SettingsBody`): grouped rows in this order — Account, Appearance (Dark/Light/Match device), Sound (`VolumeSliders`), Game controls, Notifications, Offline, … (comment lines 2–12); `PhoneShell skin="profile" bare` (68); `?section=notifications` scroll. Styles `src/polish-layout/settings.css`.
- **Tournaments hub** `src/routes/tournaments.tsx` (244): `PhoneShell tabs="tournaments"` + `PageAside daily/week` (217); `ComingSoon` (`TournamentArt trophy 96`, 87) when the hub isn't open, else `TournamentHubSections` (`src/components/tournaments/TournamentHub.tsx`: Upcoming | Your results on a `Segmented`, hero cards for live events, list rows with art-kit icons; comment 2–9) + `HallOfFame`; public-games sections (`PublicGameNext`, `PublicGameRow`, "Coming up", "Your results" with `PlaceDisc`). Styles `src/polish-layout/tournaments.css`, `tournaments-pages.css`.
- **Leaderboards** `src/routes/leaderboards.tsx` (66): `PhoneShell skin="profile" bare`; `SkeletonPage rows=6` until the account is known, then `RatingBoardsScreen` (`src/components/leaderboards/LeaderboardScreens.tsx`: board picker sheet / `data-board-side` list on desktop, Global/Country/Friends, season/peak, `BoardPodium` full cards, `NameplateStrip` rows, pinned own row). Styles `src/polish-layout/leaderboards.css`.

---

## Cross-cutting constraints the plan must respect

- `scripts/design-lint.ts` (design-lint-check): no new hex/rgb/hsl outside `tokens.css`, no non-Archivo fonts, no `--jz-*` defined elsewhere, new `@keyframes` ending hidden need a reduced-motion rule; `design-lint-ignore` for deliberate exceptions.
- Reduced motion: the global rule in `styles.css` jumps every animation to its end; `reduced-motion-end-check` lists allowed pure effects (`EFFECTS`). Any looping gradient / sparkle must be in that list or stop under `prefers-reduced-motion`.
- `play-tab-shift-check` (Home positions within 2 px from first frame, 414×896, slow server), `first-impressions-screens-check`, `theme-check` + `no-wrap-check` (every screen, dark and light, `scripts/screens/*.ts`; never edit `THEME_SCREENS` or shard parts — add an area file), `nav-check`, `app-shell-check`, `identity-screens-check` / `identity-motion-check` (avatars vs approved PNGs), `brand-assets-check` (token mirrors, splash count), `celebrations-off.json` fixture (markup with celebrations off).
- Art regeneration commands: avatars `bun scripts/player-card-art.ts [--check]`; nav art `bun scripts/nav-art.ts`; home art `scripts/home-art.ts`; tiles `bun scripts/shots/tile-scenes.ts`; shop stills `bun scripts/shop-previews.ts`; icons `bun scripts/brand-icons.ts`; link preview `bun scripts/og-image.ts`.
