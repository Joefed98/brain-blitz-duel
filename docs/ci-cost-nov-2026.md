# CI cost cut: browser checks only when a PR is ready to merge (1 Nov 2026)

GitHub Actions spend was mostly the headless-browser checks running on every push. They now run only when a PR
is ready to merge. **No check or assertion changed; this changes when checks run, not what they check.**

## What runs when

| When | Workflow | What | Jobs |
| --- | --- | --- | --- |
| Every push to a PR (open, push, reopen, leaving draft) | **Checks** (`checks.yml`) | Every check that starts no browser: scoring, replay, standard, type-level and unit-style checks | `a`–`g` (7) |
| PR labelled `ready-to-merge` (and every new push while the label is on), PR leaving draft, a manual run, weekly on main | **Full suite** (`full-suite.yml`) | Every check that starts Chromium, then **full-suite-passed** | `play1`–`play21` (21) + 1 |

- **Which side a check is on** is worked out from its source in `.github/ci/browser.ts`. A browser check is one that, or a script it imports or spawns, launches Chromium through Playwright. Today that's 32 of the 297 routine checks:
  - arcade-play, arcade-device-bottom, arcade-fill, arcade-lowend, arcade-room-practice
  - bottom-clearance, screen-bottom, touch-highlight, safe-area-screens, first-paint
  - theme, no-wrap, celebrations, chat-notice, share, beta-extras
  - offline, battery, room-16, room-extras, desktop-geometry, app-shell, play-tab-shift
  - demo-intro, replay-board, replay-play, standard-live, onboarding, beat-hold-browser, fission-repeat, help-scroll, practice-switch
- **New checks land on the right side by themselves.** An unlisted fast check runs in `g`; an unlisted browser check runs in `play21`. A browser check listed in a fast shard runs in `play21` instead.
- **ci-shards-check (new, ~1 s) proves the split.** It runs on every push and checks that:
  - every routine check runs exactly once, with every part of a split check;
  - no browser starts on a push;
  - only browser checks run in the full suite;
  - both workflows' matrices match the shard lists;
  - full-suite-passed passes only on the shards' success.

  It caught each of three deliberate mistakes I tried.
- **full-suite-passed** succeeds only when the browser shards job ended in `success`. If any shard failed, was cancelled or was skipped, it fails. On a pull_request event that isn't a ready-to-merge trigger (another label, or a push without the label), both the shards and the summary are skipped, and the captain treats skipped as not passed.

## Every push: cheaper and no double runs

- **Superseded runs are cancelled.**
  - Checks: one group per PR with `cancel-in-progress`, as before.
  - Full suite: the groups are per PR and shard, on the jobs rather than the workflow. That way an unrelated label event can never cancel a real run.
- **Docs-only changes skip CI.** Changes that only touch `docs/**`, `screenshots/**`, `*.md` or `.lovable/**` skip both workflows. The exceptions are the docs a check reads: `docs/beta-sql.md` (challenge-check, daily-check) and `docs/sound-cues/**` (the sound-manifest, sound-batch6, room-moments, logic-polish and word-polish checks).
- **One run per commit.** Both workflows trigger on `pull_request` only, never also on `push`.
- **Weekly runs only when main changed.** The weekly full suite (Sunday 22:41 UTC, main) first asks the API whether main had commits in the past week, and runs nothing if not.

## Cheaper runs

- **Caches** (no change needed):
  - bun's install cache is already cached by `bun.lock`;
  - Playwright's Chromium is cached by the locked Playwright version;
  - Vite's pre-bundled dependencies are cached by the lockfile and config.
- **No browser install on push.** The fast workflow no longer installs anything for a browser, and the browser is installed only in the full suite.
- **Runner types: all standard.** Every job in both workflows (and every job in October's runs) runs on `ubuntu-latest`, the standard runner. None uses a larger or paid runner type, so there was nothing to downgrade.

## Actions minutes per PR, before and after

These are estimates from October's runs. Billed minutes are each job's run time, rounded up to the minute. The repo is private and the usage API reports 0 billable ms here, so I measured job times from run 41258716534, a full run on #227.

**One full run before (27 jobs): about 288 job-minutes.**
- Browser jobs (`play1`–`play20`): about 220.
- Fast jobs `a`–`g`: about 68. `g` alone was 31, about 6 of which were browser checks (help-scroll ~1.8 min, battery ~3.2, practice-switch ~1).

**After:**
- Every push: Checks only, about 62 job-minutes (`a`–`f` about 37, `g` about 25).
- At ready-to-merge: Full suite, about 230 job-minutes (the old play jobs, `play21` about 7, the summary about 1).

**Per PR:** October had 421 Checks runs from 12 to 31 Oct, about 2.6 runs a PR.

| | Before | After |
| --- | --- | --- |
| Pushes (2.6 a PR) | 2.6 × 288 ≈ **750** | 2.6 × 62 ≈ **160** |
| Full suite | (included above) | 1 run ≈ **230** (≈ 345 if the PR is pushed again after labelling) |
| **Per PR** | **≈ 750** | **≈ 390–505** |

- **Saving:** about 35–48 % a PR. Most of it comes from not re-running the 220 browser job-minutes on pushes made while a PR is still in progress.
- **The real "before" was a little lower** than 750, because a superseded run was cancelled part-way.
- **Weekly:** at most about 230 job-minutes a week (about 1,000 a month), and only in weeks main changed.

## The captain's merge steps

Branch protection and rulesets aren't available for a private repo on the Free plan, so this is a rule in CLAUDE.md ("Checks") that the captain follows.

1. **Wait for Checks.** Push the PR's work and main merged in. Wait for Checks to be green on the latest commit and the review to be done.
2. **Add the label only when the PR is otherwise finished** (every push while it is on re-runs the Full suite). Add the `ready-to-merge` label to the PR. The Full suite starts. Leaving draft starts it too.
3. **Wait for full-suite-passed.** It must be green on the same latest commit; a skipped one is not a pass. If a shard fails, fix and push: the label stays on, so both workflows re-run.
4. **Merge.** Merge with a merge commit, with `expectedHeadSha` set to that commit.
5. **If main moves before the merge,** merge main into the PR and push. Both workflows re-run, and you merge on the new commit's results.
6. **Docs-only PRs skip both workflows** and merge without them.
