# S1 PR 1: the check lines, for Joe's approval

A proposal only: this branch is never merged and changes nothing else. `s1-check-lines.patch` beside this file is the
exact change to the check scripts and CLAUDE.md that PR 1 (branch `claude/sweet-noether-bp01mn`, commit 24e273ae) needs.
Approved by Joe on 28 Nov 2026 except the theme-check hunk, which waits for its own approval
(revised in the second commit on this branch: the alias scan widened to all of src, `.ap-tile` dropped, every approval
comment dated 28 Nov 2026). It applies cleanly to 24e273ae (`git apply docs/proposals/s1-check-lines.patch`). Nothing is applied to the PR branch until
Joe approves these exact lines.

## What the patch changes (16 files)

1. **Selectors renamed** (the `th-*` / `ap-*` classes are now `jz-*`): appearance-check (`var(--ap-text)` →
   `var(--jz-text)`), brand-assets-check, celebrations-browser, celebrations-check, identity-everywhere-check,
   identity-screens-check, nav-check, no-wrap-check, practice-challenge-fit-check, safe-area-harness, share-check,
   shots/standings-reveal-shots, standings-reveal-check, theme-check. Each changed line has
   "Changed with Joe's approval, 28 Nov 2026" beside it. No assertion's condition changes, only the class it finds.
2. **theme-check, section 1:** the old assertion "every old font token (`--th-font-*`, `--ap-font`) is `var(--jz-font)`"
   is replaced by two:
   - no `--th-*` or `--ap-*` custom property is defined or read in any `.css`, `.ts` or `.tsx` file under `src`
     (widened from the four stylesheets on 28 Nov 2026, to match its comment);
   - app chrome's font still resolves to Archivo: every `--font-display`, `--font-body` and `--font-mono` the app's own
     scopes set (styles.css `:root`, the page skin, the tab pages, the room screens) is `var(--jz-font)`, at least 12 of
     them (18 today).
   - The cards count drops `[data-skin] .ap-tile`, a selector that matched nothing (on main too).
3. **haptics-check:** `CALL_SITES` gains `"lib/pressFeel.ts": { tick: 1 }`, the light tick on a completed tap in app chrome.
4. **CLAUDE.md:** the haptics paragraph's "Never on button taps, drags or routine hits" now reads "Every tappable control
   in app chrome (buttons, links, tabs, switches, radios, options, menu items; never inside game art) gets the light
   `tick` on a completed tap through `src/lib/pressFeel.ts` (Joe's decision, 27 Nov 2026); never on drags or routine
   in-game hits", keeping the rule that no other `haptic()` call is added outside the listed sites.

## celebrations-off.json (re-recorded with `--record-off` once approved; not in the patch)

What changes: class attribute values on five of its six screens (the renames, and `text-[Npx]` → `jz-text-<role>` from
the one type scale), plus one attribute that isn't a class: on the podium, the confetti canvas's `height` goes from 289
to 284. The canvas takes the podium box's measured height, and the box is 5 px shorter with the scale's text sizes.
Measured by re-recording in a scratch copy of 24e273ae with this patch applied and diffing it against the committed
fixture: with class attributes taken out, standings, final2, lobby3, reveal150 and home are identical and the podium
differs only by that canvas height. Every screen has the same number of class attributes (180, 134, 107, 71, 186, 56).

What doesn't change: celebrations-browser.ts compares the same six screens the same way (`sameMarkup`, exact string after
`markup()`'s normalisation); the patch changes no line of what it counts or allows, only the `.th-score` / `.th-name` /
`ap-date-num` selectors it reads.
