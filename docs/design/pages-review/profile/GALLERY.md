# Profile pages · review (phase 2, step 3)

14 Nov 2026 · the Profile session. Built to the style guide's
[phone/profile.png](../../style-guide/phone/profile.png) and [desktop/profile.png](../../style-guide/desktop/profile.png).
Phone pictures at 390 × 844 (shrunk to 300 px wide), dark theme unless named; before = main, after = this branch.
Drawn by `bun scripts/shots/profile-pages-shots.ts --tag=before|after` from the screens in `scripts/screens/profile.ts`.

## Your Profile (an account placed in rated play)

| Before | After |
|---|---|
| ![](01-profile-rated-before.png) | ![](01-profile-rated-after.png) |
| ![](02-profile-rated-scrolled-before.png) | ![](02-profile-rated-scrolled-after.png) |

Card, Customise card, Ratings (Joulz Rating, Puzzles, Arcade tiles), strongest categories, Mastery (stars, bar, gem),
Recent matches, the Badges row and the Friends strip, then the sections Profile already had.

## An account without rated play · a guest

| Before | After |
|---|---|
| ![](03-profile-unrated-before.png) | ![](03-profile-unrated-after.png) |
| ![](04-profile-guest-before.png) | ![](04-profile-guest-after.png) |

No Ratings section at all without rated play (the same rule as Home; the old "arrives with rated play" note is gone).
A guest keeps the Display name box; Customise and Friends open the save-your-progress sheet.

## New pages: Badges and your card

| Badges (`/badges`) | Your card (`/card`) |
|---|---|
| ![](05-badges-after.png) | ![](06-card-after.png) |

## Friends

| Before | After |
|---|---|
| ![](07-friends-before.png) | ![](07-friends-after.png) |
| ![](08-friend-profile-before.png) | ![](08-friend-profile-after.png) |
| ![](09-add-friend-before.png) | ![](09-add-friend-after.png) |

## Customise

| Before | After |
|---|---|
| ![](10-customise-avatar-before.png) | ![](10-customise-avatar-after.png) |
| ![](11-customise-card-before.png) | ![](11-customise-card-after.png) |

## Light theme

| Before | After |
|---|---|
| ![](12-profile-light-before.png) | ![](12-profile-light-after.png) |

## Tablet and computer

The card column becomes the page's side column (left, sticky); the sections fill the rest.

| Before | After |
|---|---|
| ![](14-tablet-profile-before.png) | ![](14-tablet-profile-after.png) |
| ![](13-desktop-profile-before.png) | ![](13-desktop-profile-after.png) |
