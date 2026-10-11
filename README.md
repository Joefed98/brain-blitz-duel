# Duelz: Quick Puzzles

Build a mobile-first web app called Duelz — a 1v1 skill-based puzzle duel game. Two friends on two separate phones join the same duel with a short room code, solve the same three timed puzzles at the same moment, and whoever scores more across the three rounds wins.

This is a free MVP for testing with friends. There is no money, no payments, no prizes, no ads, no user accounts, and no leaderboard in this version. Do not build any of those. Do not create any tables, fields, or UI that assume money changes hands. The only goal of this build is a duel loop that feels fast, fair, and fun end to end.

Use lovable cloud for the backend (database + realtime) so the two players stay in sync. Keep the code clean and modular because I will extend this app over many prompts: put each puzzle type in its own component, and keep the scoring and duel-state logic in separate files from the UI.

How a duel works

Player 1 taps "Create duel", enters a display name, and gets a 4-letter room code shown large on screen, with a "Waiting for opponent…" state.

Player 2 taps "Join duel", enters their display name and the code, and joins.

As soon as both players are in, both phones show a 3-second countdown ("3, 2, 1, GO"), then Round 1 starts at the same time on both devices.

Each duel has three rounds, and each round is one puzzle of a different type. The three puzzle types are always Anagram, Quick Arithmetic, and Sequence Recall — one of each per duel, in a random order that is decided when the duel is created (so both players get the same order).

Each round has a 30-second timer. The player submits one answer. Once they submit, their input locks and they see "Waiting for opponent…" until the other player has submitted or the timer runs out.

After each round, both players see a round result screen showing both players' scores for that round and the running total, with a "Next round" button. The next round starts when both players have tapped it (or automatically after 10 seconds).

After round 3, both players see a final result screen: WIN or LOSS in large text, the final totals for both players, a per-round breakdown, and a "Play again" button that creates a fresh duel with the same two players (the creator gets a new code automatically, the joiner is auto-joined).

Critical fairness rule: the puzzle content for all three rounds must be generated once, when the duel is created, and stored in the database, so both players see exactly the same puzzle. Never generate puzzles separately on each device.

Scoring

Correct answer: 100 points + 5 points for every full second remaining on the 30-second clock when the answer was submitted. (So an answer at 22 seconds remaining scores 100 + 110 = 210. Maximum possible per round is 250.)

Wrong answer, or no answer before time runs out: 0 points for that round.

Duel winner is the higher total across all three rounds.

If totals are tied, the player whose combined answer time across the three rounds is lower wins. If still tied, show "DRAW".

Record the exact time remaining (to the millisecond) at the moment of each submission so the tie-break works.

The three puzzle types

1. Anagram. Show a scrambled 6-letter English word as large individual letter tiles. The player types the unscrambled word into a text input (auto-focus it, auto-capitalise, and submit on Enter or a "Submit" button). Include a built-in bank of at least 60 common 6-letter English words. Make sure the scramble is never identical to the original word. Answer check is case-insensitive.

2. Quick Arithmetic. Show one equation such as 47 + 38, 13 × 7, 96 − 29, or 84 ÷ 6. Generate it so the answer is always a whole number between 0 and 999, and subtraction never goes negative. The player types the number into a numeric input (use inputmode="numeric" so the mobile number keypad appears) and submits.

3. Sequence Recall. Show a 3×3 grid of tiles. Five tiles light up one after another in gold, each for 600 ms with a 250 ms gap. Then the grid resets, and the player must tap the same five tiles in the same order. Show small dots above the grid that fill in as they tap. The round is correct only if all five taps match in order. The 30-second timer starts after the sequence has finished playing, not before. The sequence (as a list of tile indices) is part of the stored puzzle content, so both players see the same one.

Screens

Home — Duelz wordmark, a large gold "Create duel" button, a secondary "Join duel" button. Below, a one-line description: "Three puzzles. Thirty seconds each. Fastest brain wins."

Lobby — name entry, then either the big room code with "Waiting for opponent…" (creator) or the code input (joiner). Show both players' names once connected, then the 3-2-1 countdown.

Duel screen — top bar with "ROUND 2 OF 3" and the puzzle type name; a large monospace countdown timer; a slim two-colour score strip (gold = me, teal = opponent) showing running totals; the puzzle in the centre; the input at the bottom within easy thumb reach.

Round result — both players' names and round scores side by side (me in gold on the left, opponent in teal on the right), whoever won the round gets a small "ROUND WON" tag, running totals underneath, "Next round" button.

Final result — WIN / LOSS / DRAW in very large type, final totals, a three-row breakdown table, "Play again" button.

Handle edge cases simply: if the opponent leaves or their connection drops for more than 15 seconds mid-duel, show "Opponent disconnected" with a button back to Home. If someone enters a code that doesn't exist or the duel already has two players, show a clear inline error.

Data model (Supabase)

duels — id, room_code (unique, 4 uppercase letters, no ambiguous letters like I/O), status (waiting / countdown / in_progress / finished), round_order (JSON array of the three puzzle types), puzzles (JSON with the generated content for all three rounds), current_round (1–3), created_at.

duel_players — id, duel_id, player_slot (1 or 2), display_name, session_token (a random string kept in the browser's localStorage so a player can refresh and rejoin), last_seen_at.

round_results — id, duel_id, player_slot, round_number, answer, is_correct, ms_remaining, score, submitted_at.

Use Supabase Realtime subscriptions on duels, duel_players, and round_results so both phones update instantly without polling. Keep it simple — no authentication, no row-level security beyond what's needed for anonymous access to work.

Design

Dark, competitive esports feel. Background is near-black (#0B0B0F), not pure black. Cards and panels a step lighter (#15151C).

Primary accent: warm gold/amber (#F5B82E) — used for everything that is "me", all primary buttons, and win states.

Secondary accent: teal/mint (#2ED3B7) — used for everything that is "the opponent".

Warning red (#FF4D4D) for the timer in its final seconds and for loss states.

Headings in Space Grotesk (bold). Body text in Inter. The countdown timer and all scores in JetBrains Mono so they read like a digital scoreboard. Load these from Google Fonts.

The countdown timer should be the most prominent thing on the duel screen. When 10 seconds remain it shifts to amber; when 5 seconds remain it shifts to red and pulses gently.

Score numbers should count up with a quick animation when they change.

Minimal, uncluttered, generous spacing, large tap targets (minimum 48px). This should feel fast and snappy, not busy. No decorative illustrations.

Mobile-first at 390px wide; it should still look fine on desktop, centred in a phone-width column.

Do not build yet

Do not build sign-in, user accounts, profiles, duel history, leaderboards, tournaments/brackets, payments, prize pools, ads, or matchmaking. I will add these in later prompts. Just don't design in a way that makes them hard to add later — for example, keep display_name on duel_players rather than hard-coding it into the UI, and keep the puzzle generators pluggable so I can add more puzzle types.

Start by building the complete duel flow end to end with all three puzzle types working across two devices. Prioritise getting the timing, sync, and scoring correct over visual polish.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://brain-blitz-duel.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/1c894023-8cb3-44c9-93e8-f86c9e3be667).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
