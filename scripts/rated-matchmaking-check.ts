/**
 * rated-matchmaking-check (wave 3, W3b; docs/rated/matchmaking-interface.md): the pure rules of rated matchmaking,
 * no database, no browser (~1 s).
 *
 * - the switches: only bo3 with Mixed / All puzzles / All arcade at launch; anything else refused; testers only until
 *   RATED_PLAY_FOR_EVERYONE;
 * - the queue: ±50 widening by 50 every 2 s to ±200, a recorded run from 8 s; pairing only within the same format and
 *   choice, never with oneself, placement only with placement and placed only with placed, nearest rating first;
 * - recorded-run choice: nearest rating, 14 days, same version, format and choice, never one's own, never the same
 *   owner twice in a row, 5 uses a day; the fallback only when no rated run is near enough; placement takes beginners;
 * - playback: never a point the run hadn't reached, nothing before the end without a timeline, hidden in the last 20 %;
 * - the result: games won, then total, then time; rematch inside 8 s only;
 * - rated chat: quick phrases only for guests and under-18s.
 */
import {
  BAND_MAX,
  bandFor,
  bestPartner,
  canPair,
  chooseRecordedRun,
  FORMAT_GAMES,
  gameVersionOf,
  HIDDEN_FINISH_SHARE,
  matchOutcome,
  matchSettings,
  openOptions,
  opponentScoreHidden,
  RATED_FORMATS,
  RATED_CHOICES,
  RATED_SWITCHES,
  ratedOptionRefusal,
  ratedPlayOpenFor,
  RECORDED_AFTER_MS,
  RECORDED_DAILY_USES,
  RECORDED_WINDOW_MS,
  recordedAgeLabel,
  recordedDue,
  recordedRefusal,
  recordedViewAt,
  rematchAgreed,
  rematchOpen,
  REMATCH_WINDOW_MS,
  timelineValid,
  typeFitsChoice,
  type QueueEntry,
  type RecordedCandidate,
  type RecordedContext,
  type RecordedGame,
  type RatedSwitches,
} from "../src/lib/rated/matchmaking";
import { RATED_CHOICES_ON, RATED_FORMATS_ON } from "../src/config/matchmakingConfig";
import { RATED_PLAY_FOR_EVERYONE } from "../src/config/ratedConfig";
import { ratedChatMessage, QUICK_PHRASES_ONLY_MESSAGE } from "../src/lib/rated/ratedChat.server";
import { chatPolicy } from "../src/lib/safety/chatPolicy";
import { dealRoomRounds } from "../src/lib/duel/roomDeal";
import { dealtSignature } from "../src/lib/duel/dealSignature";
import { puzzleDef } from "../src/lib/duel/catalogue";

let passes = 0;
const failures: string[] = [];
function check(ok: boolean, label: string): void {
  if (ok) passes++;
  else {
    failures.push(label);
    console.log(`  FAIL ${label}`);
  }
}

/* ------------------------------------------------------------------ switches */
{
  check(RATED_PLAY_FOR_EVERYONE === false, "launch: rated play is testers-only");
  const onFormats = RATED_FORMATS.filter((f) => RATED_FORMATS_ON[f]);
  const onChoices = RATED_CHOICES.filter((c) => RATED_CHOICES_ON[c]);
  check(onFormats.join(",") === "bo3", `launch: only best of 3 is on (${onFormats.join(",")})`);
  check(onChoices.join(",") === "mixed,puzzles,arcade", `launch: only Mixed, All puzzles, All arcade (${onChoices.join(",")})`);
  check(ratedOptionRefusal("bo3", "mixed") === null && ratedOptionRefusal("bo3", "arcade") === null, "switches: bo3 Mixed / arcade allowed");
  for (const f of RATED_FORMATS.filter((f) => !RATED_FORMATS_ON[f])) check(ratedOptionRefusal(f, "mixed") !== null, `switches: ${f} refused`);
  for (const c of RATED_CHOICES.filter((c) => !RATED_CHOICES_ON[c])) check(ratedOptionRefusal("bo3", c) !== null, `switches: ${c} refused`);
  check(ratedOptionRefusal("bo9", "mixed") !== null && ratedOptionRefusal("bo3", "chess") !== null && ratedOptionRefusal(undefined, null) !== null, "switches: unknown options refused");
  check(!ratedPlayOpenFor(false) && ratedPlayOpenFor(true), "switches: testers only while the switch is off");
  const everyone: RatedSwitches = { ...RATED_SWITCHES, forEveryone: true };
  check(ratedPlayOpenFor(false, everyone), "switches: everyone once flipped");
  const bo5on: RatedSwitches = { ...RATED_SWITCHES, formats: { ...RATED_SWITCHES.formats, bo5: true } };
  check(ratedOptionRefusal("bo5", "mixed", bo5on) === null && openOptions(bo5on).formats.includes("bo5"), "switches: a format switched on is offered and allowed");
  check(openOptions().formats.join(",") === "bo3" && openOptions().choices.length === 3, "switches: the phone is offered only what is on");
}

/* ------------------------------------------------------------------ the deal */
{
  check(FORMAT_GAMES.bo3 === 3 && FORMAT_GAMES.bo5 === 5 && FORMAT_GAMES.bo7 === 7, "formats: best of N deals N games");
  for (const choice of ["mixed", "puzzles", "arcade"] as const) {
    for (let seed = 1; seed <= 40; seed++) {
      const types = dealRoomRounds(matchSettings("bo3", choice), { seed: seed * 7919 }).types;
      const fits = types.length === 3 && types.every((t) => typeFitsChoice(t, choice)) && new Set(types).size === 3;
      if (!fits) {
        check(false, `deal: ${choice} seed ${seed} gives three different games of the choice (${types.join(",")})`);
        break;
      }
      if (choice === "puzzles" && types.some((t) => puzzleDef(t).category === "arcade")) check(false, `deal: All puzzles dealt an arcade game (${types})`);
      if (choice === "arcade" && types.some((t) => puzzleDef(t).category !== "arcade")) check(false, `deal: All arcade dealt a puzzle (${types})`);
    }
    passes++;
  }
  const a = dealRoomRounds(matchSettings("bo3", "mixed"), { seed: 123 }).types.join(",");
  const b = dealRoomRounds(matchSettings("bo3", "mixed"), { seed: 123 }).types.join(",");
  check(a === b, "deal: the same seed deals the same games (one deal for both players)");
  check(gameVersionOf({ type: "x", tieRev: 1, floodRev: 3, speedPar: 1 }) === "floodRev=3 speedPar=1", "version: the room's tie stamp is left out");
}

/* ------------------------------------------------------------------ the queue */
{
  const steps = [0, 1999, 2000, 3999, 4000, 6000, 7999, 8000, 20_000].map(bandFor);
  check(steps.join(",") === "50,50,100,100,150,200,200,200,200", `bands: ±50 widening by 50 every 2 s to ±200 (${steps.join(",")})`);
  check(bandFor(-5) === 50 && BAND_MAX === 200, "bands: never below 50, never above 200");
  check(!recordedDue(7_999) && recordedDue(8_000) && RECORDED_AFTER_MS === 8_000, "queue: a recorded run from 8 s");
  const e = (userId: string, rating: number, joinedAtMs: number, over: Partial<QueueEntry> = {}): QueueEntry => ({
    userId, format: "bo3", choice: "mixed", rating, joinedAtMs, placement: false, ...over,
  });
  const now = 100_000;
  check(canPair(e("a", 1000, now), e("b", 1050, now), now), "pair: within ±50 at once");
  check(!canPair(e("a", 1000, now), e("b", 1051, now), now), "pair: not past ±50 at once");
  check(canPair(e("a", 1000, now - 2000), e("b", 1100, now), now), "pair: ±100 after 2 s (the longer waiter's band)");
  check(!canPair(e("a", 1000, now - 1999), e("b", 1100, now), now), "pair: not ±100 before 2 s");
  check(canPair(e("a", 1000, now - 6000), e("b", 1200, now), now) && !canPair(e("a", 1000, now - 7900), e("b", 1201, now), now), "pair: ±200 from 6 s, never wider");
  check(!canPair(e("a", 1000, now), e("b", 1000, now, { format: "bo5" }), now), "pair: never another format");
  check(!canPair(e("a", 1000, now), e("b", 1000, now, { choice: "puzzles" }), now), "pair: never another choice");
  check(!canPair(e("a", 1000, now), e("a", 1000, now), now), "pair: never oneself");
  // Placement (Joe, 11 Nov 2026): two placement players pair live with each other in the normal band; a placed player never
  // pairs with a placement player, however close or long the wait.
  const pl = (id: string, rating: number, at: number) => e(id, rating, at, { placement: true });
  check(!canPair(e("a", 1000, now), pl("b", 1000, now), now) && !canPair(pl("a", 1000, now - 7_900), e("b", 1000, now - 7_900), now), "pair: a placed player never with a placement player");
  check(canPair(pl("a", 1000, now), pl("b", 1040, now), now), "pair: two placement players pair live within ±50 at once");
  check(!canPair(pl("a", 1000, now), pl("b", 1120, now), now) && canPair(pl("a", 1000, now - 4_000), pl("b", 1120, now), now), "pair: placement pairs widen as anyone's do (±150 from 4 s)");
  check(bestPartner(pl("me", 1000, now), [e("placed", 1000, now - 5_000), pl("new", 1100, now - 4_000)], now)?.userId === "new", "pair: a placement searcher is offered only placement partners");
  const me = e("me", 1000, now - 3000);
  const best = bestPartner(me, [e("x", 1090, now - 100), e("y", 970, now - 50), e("z", 970, now - 900), e("w", 1300, now - 7000)], now);
  check(best?.userId === "z", `pair: the nearest rating, then the longest wait (${best?.userId})`);
  check(bestPartner(me, [e("p", 1000, now, { choice: "arcade" })], now) === null, "pair: nobody of the same choice, nobody");
}

/* ------------------------------------------------------------------ recorded runs */
{
  const DAY = 24 * 60 * 60 * 1000;
  const now = Date.UTC(2026, 10, 20, 12);
  const live = (t: string) => `live:${t}`;
  const game = (type: string, over: Partial<RecordedGame> = {}): RecordedGame => ({ type, signature: live(type), score: 120, finishMs: 40_000, timeline: null, ...over });
  const run = (key: string, over: Partial<RecordedCandidate> = {}): RecordedCandidate => ({
    key, source: "rated", ownerId: `owner-${key}`, ownerRating: 1000, format: "bo3", choice: "mixed",
    games: [game("flood"), game("breaker"), game("reaction")], recordedAtMs: now - 2 * 60 * 60 * 1000, usesToday: 0, ...over,
  });
  const ctx: RecordedContext = { viewerId: "me", rating: 1000, format: "bo3", choice: "mixed", lastOwnerId: null, nowMs: now, liveSignature: live };
  check(recordedRefusal(run("ok"), ctx) === null, "recorded: an ordinary run is eligible");
  check(recordedRefusal(run("own", { ownerId: "me" }), ctx) === "own", "recorded: never your own");
  check(recordedRefusal(run("twice", { ownerId: "last" }), { ...ctx, lastOwnerId: "last" }) === "same_owner_twice", "recorded: never the same player twice in a row");
  check(recordedRefusal(run("old", { recordedAtMs: now - RECORDED_WINDOW_MS - 1 }), ctx) === "too_old" && recordedRefusal(run("edge", { recordedAtMs: now - 14 * DAY }), ctx) === null, "recorded: the last 14 days");
  check(recordedRefusal(run("used", { usesToday: RECORDED_DAILY_USES }), ctx) === "used_up" && recordedRefusal(run("four", { usesToday: 4 }), ctx) === null && RECORDED_DAILY_USES === 5, "recorded: 5 uses a day");
  check(recordedRefusal(run("fmt", { format: "bo5" }), ctx) === "other_format" && recordedRefusal(run("ch", { choice: "puzzles" }), ctx) === "other_format", "recorded: same format and choice");
  check(recordedRefusal(run("ver", { games: [game("flood", { signature: "old" }), game("breaker"), game("reaction")] }), ctx) === "old_version", "recorded: same game version");
  check(recordedRefusal(run("len", { games: [game("flood"), game("breaker")] }), ctx) === "wrong_length", "recorded: exactly the format's games");
  check(recordedRefusal(run("arc", { source: "room", format: null, choice: null }), { ...ctx, choice: "puzzles" }) === "other_choice", "recorded: a fallback run's games must fit the choice");
  check(recordedRefusal(run("ver2"), { ...ctx, liveSignature: dealtSignature }) === "old_version", "recorded: checked against today's live deal by default");

  const pool = [
    run("far", { ownerRating: 1300 }),
    run("near", { ownerRating: 1080 }),
    run("nearer", { ownerRating: 960 }),
    run("fb", { source: "room", format: null, choice: null, ownerRating: null }),
  ];
  const pick = chooseRecordedRun(pool, ctx, 1000);
  check(pick?.candidate.key === "nearer" && pick.fallback === false, `recorded: the nearest-rated rated run (${pick?.candidate.key})`);
  const noNear = chooseRecordedRun([run("far", { ownerRating: 1300 }), run("fb", { source: "daily", format: null, choice: null, ownerRating: null })], ctx, 1000);
  check(noNear?.candidate.key === "fb" && noNear.fallback === true, "recorded: the fallback only when no rated run is near enough");
  const nearOnly = chooseRecordedRun([run("near2", { ownerRating: 1150 }), run("fb", { source: "daily", format: null, choice: null })], ctx, 1000);
  check(nearOnly?.candidate.key === "near2" && !nearOnly.fallback, "recorded: a near rated run beats the fallback");
  const farOnly = chooseRecordedRun([run("far", { ownerRating: 1500 })], ctx, 1000);
  check(farOnly?.candidate.key === "far" && !farOnly.fallback, "recorded: with no fallback either, the nearest rated run however far");
  check(chooseRecordedRun([run("own", { ownerId: "me" }), run("u", { usesToday: 5 })], ctx, 1000) === null, "recorded: nothing eligible, nothing chosen");
  const placement = chooseRecordedRun([run("pro", { ownerRating: 1010 }), run("beg", { ownerRating: 900 })], { ...ctx, beginnerMax: 950 }, 1000);
  check(placement?.candidate.key === "beg", "recorded: placement plays beginners' runs");
  check(recordedAgeLabel(now - 2 * 60 * 60 * 1000, now) === "Recorded run · 2 h ago" && recordedAgeLabel(now - 5 * 60 * 1000, now) === "Recorded run · 5 min ago" && recordedAgeLabel(now - 3 * DAY, now) === "Recorded run · 3 days ago", "recorded: labelled with its real age");

  // Playback.
  const timeline: [number, number][] = [[0, 0], [10_000, 20], [25_000, 60], [40_000, 120]];
  const g = game("breaker", { timeline, finishMs: 40_000, score: 120 });
  const limit = 60_000;
  check(timelineValid(timeline, 120, limit) && !timelineValid([[0, 0], [5_000, 30]], 120, limit) && !timelineValid([[5_000, 10], [1_000, 20]], 20, limit), "playback: a timeline must rise in time and end on the stored score");
  let honest = true;
  for (let ms = 0; ms < limit * (1 - HIDDEN_FINISH_SHARE); ms += 250) {
    const v = recordedViewAt(g, ms, limit);
    const reached = [...timeline].reverse().find(([t]) => t <= ms)?.[1] ?? 0;
    if (v.score !== reached || v.hidden) honest = false;
  }
  check(honest, "playback: every moment shows exactly what the run had reached, never more");
  check(recordedViewAt(g, 9_999, limit).score === 0 && recordedViewAt(g, 10_000, limit).score === 20, "playback: at its real pace");
  check(!recordedViewAt(g, 39_999, limit).finished && recordedViewAt(g, 40_000, limit).finished, "playback: finished at the run's real finish time");
  const noTimeline = game("flood", { timeline: null });
  let silent = true;
  for (let ms = 0; ms < limit; ms += 500) if (recordedViewAt(noTimeline, ms, limit).score !== null) silent = false;
  check(silent, "playback: a game without a timeline shows nothing until the game's end");
  check(opponentScoreHidden(48_000, limit) && !opponentScoreHidden(47_999, limit) && recordedViewAt(g, 48_000, limit).hidden && recordedViewAt(g, 48_000, limit).score === null, "hidden finish: the final 20 % of the game's time");
  check(opponentScoreHidden(72_000, 90_000) && !opponentScoreHidden(71_999, 90_000), "hidden finish: 20 % of each game's own time");
}

/* ------------------------------------------------------------------ guests, flagged runs, early finish (Joe, 11 Nov) */
{
  const { ratedAccessFor, matchClinched } = await import("../src/lib/rated/matchmaking");
  const everyone: RatedSwitches = { ...RATED_SWITCHES, forEveryone: true };
  check(!ratedAccessFor({ account: false, tester: false }) && !ratedAccessFor({ account: false, tester: true }) && !ratedAccessFor({ account: true, tester: false }) && ratedAccessFor({ account: true, tester: true }),
    "access: while testers-only, only accounts on the tester list (never a guest)");
  check(ratedAccessFor({ account: false, tester: false }, everyone) && ratedAccessFor({ account: true, tester: false }, everyone), "access: with rated play for everyone, guests and accounts alike");
  const now = Date.UTC(2026, 10, 20, 12);
  const g = (type: string, flagged = false): RecordedGame => ({ type, signature: `v:${type}`, score: 100, finishMs: 1000, timeline: null, flagged });
  const run: RecordedCandidate = { key: "f", source: "room", ownerId: "o", ownerRating: null, format: null, choice: null, games: [g("flood"), g("breaker", true), g("reaction")], recordedAtMs: now - 1000, usesToday: 0 };
  const ctx: RecordedContext = { viewerId: "me", rating: 1000, format: "bo3", choice: "mixed", lastOwnerId: null, nowMs: now, liveSignature: (t) => `v:${t}` };
  check(recordedRefusal(run, ctx) === "flagged", "recorded: a run with a game the server's replay flagged is never used");
  check(chooseRecordedRun([run, { ...run, key: "r", source: "rated", format: "bo3", choice: "mixed", ownerRating: 1000 }], ctx, 1000) === null, "recorded: flagged runs are never chosen, rated or fallback");
  check(recordedRefusal({ ...run, games: [g("flood"), g("breaker"), g("reaction")] }, ctx) === null, "recorded: the same run unflagged is eligible");
  const W = (a: number, b: number) => ({ a, b, aTimeMs: 1, bTimeMs: 1 });
  check(matchClinched([W(150, 100), W(140, 90)], 3) && !matchClinched([W(150, 100)], 3) && !matchClinched([W(150, 100), W(90, 140)], 3), "early finish: best of 3 stops at 2–0, never at 1–0 or 1–1");
  check(!matchClinched([W(150, 100), W(100, 100)], 3), "early finish: 1–0 with a drawn game still goes to game 3 (it can be levelled)");
  check(matchClinched([W(2, 1), W(2, 1), W(2, 1)], 5) && !matchClinched([W(2, 1), W(2, 1), W(1, 2)], 5) && matchClinched([W(2, 1), W(2, 1), W(1, 2), W(2, 1)], 5), "early finish: best of 5 stops at 3–0 and 3–1, not 2–1");
  check(matchClinched([W(1, 2), W(1, 2), W(1, 2), W(1, 2)], 7) && !matchClinched([W(1, 2), W(1, 2), W(1, 2)], 7), "early finish: best of 7 stops at 0–4, not 0–3");
  check(!matchClinched([W(2, 1), W(1, 2), W(1, 1)], 3), "early finish: level on games after every game isn't a clinch (the total decides at the end)");
  check(!matchClinched([W(2, 1), W(2, 1), W(1, 1), W(1, 1)], 5), "early finish: a best of 5 at 2–0 with two drawn games plays game 5 (a drawn game counts for nobody, W3a's rule)");
  {
    // The room's stop agrees with W3a's own check of a match (src/lib/rated/match.ts checkMatch): for every sequence of
    // win / draw / loss in a best of 3, 5 and 7 the room actually plays, W3a takes the match exactly when the room ends
    // it there (decided, or every game played), through the very result toRatingsResult builds.
    const { checkMatch } = await import("../src/lib/rated/match");
    const { toRatingsResult } = await import("../src/lib/rated/ratingsAdapter.server");
    const A = "00000000-0000-4000-8000-0000000000a1";
    const B = "00000000-0000-4000-8000-0000000000b2";
    const types = dealRoomRounds(matchSettings("bo7", "puzzles"), { seed: 77 }).types as string[];
    let agree = true;
    let tried = 0;
    for (const [fmt, n] of [["bo3", 3], ["bo5", 5], ["bo7", 7]] as const) {
      let seqs: number[][] = [[]];
      const all: number[][] = [];
      for (let len = 1; len <= n; len++) {
        seqs = seqs.flatMap((q) => [1, 0, -1].map((r) => [...q, r]));
        all.push(...seqs);
      }
      for (const seq of all) {
        const games = seq.map((r) => W(r === 1 ? 2 : 1, r === -1 ? 2 : 1));
        if (seq.slice(0, -1).some((_, i) => matchClinched(games.slice(0, i + 1), n))) continue; // stopped earlier: never played
        const roomEnds = matchClinched(games, n) || seq.length === n;
        const settlement = {
          matchId: "00000000-0000-4000-8000-00000000c0de", format: fmt, choice: "puzzles" as const, gameMode: "classic" as const,
          kind: "live" as const, rematchOf: null, finishedAt: new Date(now).toISOString(),
          players: [
            { userId: A, slot: 1, ratingBefore: 1000, placement: false, scores: games.map((g) => g.a), timesMs: games.map(() => 1), gamesWon: 0, total: 0 },
            { userId: B, slot: 2, ratingBefore: 1000, placement: false, scores: games.map((g) => g.b), timesMs: games.map(() => 1), gamesWon: 0, total: 0 },
          ],
          games: games.map((_, i) => ({ type: types[i]!, signature: "", winner: "draw" as const })),
          winner: "draw" as const, recorded: null, ratings: null,
        };
        const sent = toRatingsResult(settlement);
        const taken = sent !== null && checkMatch(sent, now).ok;
        tried++;
        if (taken !== roomEnds) agree = false;
      }
    }
    check(agree && tried > 100, `early finish: W3a's checkMatch takes the match exactly where the room ends it (${tried} sequences, best of 3, 5 and 7)`);
  }

}

/* ------------------------------------------------------------------ result and rematch */
{
  const o = matchOutcome([
    { a: 150, b: 120, aTimeMs: 30_000, bTimeMs: 20_000 },
    { a: 90, b: 140, aTimeMs: 30_000, bTimeMs: 20_000 },
    { a: 120, b: 100, aTimeMs: 25_000, bTimeMs: 26_000 },
  ]);
  check(o.winsA === 2 && o.winsB === 1 && o.winner === "a", "result: games won");
  const drawn = matchOutcome([{ a: 100, b: 100, aTimeMs: 1_000, bTimeMs: 9_000 }]);
  check(drawn.winsA === 0 && drawn.winsB === 0, "result: a level score is a drawn game (W3a's rule), whatever the time");
  const level = matchOutcome([
    { a: 150, b: 100, aTimeMs: 1, bTimeMs: 1 },
    { a: 100, b: 140, aTimeMs: 1, bTimeMs: 1 },
    { a: 100, b: 100, aTimeMs: 5, bTimeMs: 5 },
  ]);
  check(level.winsA === 1 && level.winsB === 1 && level.winner === "a", "result: level on games, the higher total");
  check(matchOutcome([{ a: 1, b: 1, aTimeMs: 1, bTimeMs: 1 }]).winner === "draw", "result: level on everything, a draw");
  check(matchOutcome([{ a: 1, b: 1, aTimeMs: 1, bTimeMs: 2 }]).winner === "a", "result: level on games and total, less time used");
  const end = 1_000_000;
  check(REMATCH_WINDOW_MS === 8_000 && rematchOpen(end, end + 8_000) && !rematchOpen(end, end + 8_001) && !rematchOpen(end, end - 1), "rematch: open for 8 s after the match");
  check(rematchAgreed(end, [end + 1_000, end + 7_900]) && !rematchAgreed(end, [end + 1_000, end + 8_500]) && !rematchAgreed(end, [end + 1_000, null]) && !rematchAgreed(end, [end + 1]), "rematch: both accept within 8 s");
}

/* ------------------------------------------------------------------ chat */
{
  check(chatPolicy("rated", { isGuest: false, isUnder18: true }) === "quick_phrases" && chatPolicy("rated", { isGuest: true, isUnder18: null }) === "quick_phrases" && chatPolicy("rated", { isGuest: false, isUnder18: false }) === "type", "chat: wave 1's stranger rules in rated matches");
  const typed = ratedChatMessage("quick_phrases", "meet me at the park");
  check(!typed.ok && typed.message === QUICK_PHRASES_ONLY_MESSAGE, "chat: free text refused for quick-phrase players");
  const byId = ratedChatMessage("quick_phrases", "gg");
  const byText = ratedChatMessage("quick_phrases", "Good game!");
  check(byId.ok && byId.text === "Good game!" && byText.ok && byText.text === "Good game!", "chat: a quick phrase goes (by id or exact text)");
  const adult = ratedChatMessage("type", "nice one mate");
  check(adult.ok && adult.text === "nice one mate", "chat: adults with an account type");
}

/* ------------------------------------------------------------------ W3a's shapes */
{
  const { matchRatingFrom, poolAndCategory, ratingsFormat, toRatingsResult } = await import("../src/lib/rated/ratingsAdapter.server");
  const rated = (rating: number) => ({ status: "rated" as const, rating, rd: 80, matches: 9, provisional: false });
  const base = {
    playerId: "p",
    placement: { played: 5, of: 5 as const, done: true, label: null },
    joulz: 1340,
    tier: null,
    pools: { puzzles: rated(1300), arcade: { status: "not_played" as const } },
    categories: null,
  };
  check(matchRatingFrom(base, "puzzles", 1500).rating === 1300 && matchRatingFrom(base, "arcade", 1500).rating === 1500 && matchRatingFrom(base, "mixed", 1500).rating === 1340, "W3a: the rating the match moves (pool; unrated = the starting rating; Mixed the Joulz Rating)");
  check(matchRatingFrom({ ...base, placement: { played: 2, of: 5, done: false, label: "Placement 3 of 5" }, joulz: null, pools: null }, "mixed", 1500).placement === true, "W3a: placement read from placement.done");
  check(poolAndCategory("flood")?.pool === "puzzles" && poolAndCategory("breaker")?.pool === "arcade" && poolAndCategory("breaker")?.category === "retro" && poolAndCategory("nope") === null, "W3a: pool and category from the game");
  const fmt = ratingsFormat("bo3");
  check(fmt.kind === "duel" && fmt.bestOf === 3, "W3a: best of 3 is { duel, bestOf 3 }");
  const settlement = {
    matchId: "m", format: "bo3" as const, choice: "word" as const, gameMode: "classic" as const, kind: "live" as const, rematchOf: null, finishedAt: "2026-11-11T00:00:00Z",
    players: [], games: [], winner: "draw" as const, recorded: null, ratings: null,
  };
  check(toRatingsResult(settlement) === null, "W3a: a single-category choice isn't sent (W3a takes Mixed, All puzzles, All arcade)");
}

/* ------------------------------------------------------------------ guest names and the Cron Trigger */
{
  const { guestEnergyName } = await import("../src/lib/rated/guestName.server");
  const { checkGuestName } = await import("../src/lib/names/names.server");
  const ids = Array.from({ length: 200 }, (_, i) => `00000000-0000-4000-8000-${String(i).padStart(12, "0")}`);
  const names = ids.map(guestEnergyName);
  check(names.every((n, i) => n === guestEnergyName(ids[i]!)), "guest names: the same player always gets the same name");
  check(names.every((n) => /^[A-Z][a-z]+ [A-Z][a-z]+ \d{1,2}$/.test(n) && checkGuestName(n).ok), `guest names: "Swift Volt 48" style and never refused (${names[0]})`);
  check(new Set(names).size > 150, `guest names: varied across players (${new Set(names).size} of 200)`);
  const { readFileSync } = await import("node:fs");
  const vite = readFileSync("vite.config.ts", "utf8");
  const { MATCHMAKING_CRONS } = await import("../src/lib/rated/tasks/matchmakingTasks.server");
  const cron = MATCHMAKING_CRONS["rated:practice-deals-purge"];
  check(vite.includes(`"${cron}": ["rated:practice-deals-purge"]`) && /withTasks\(nitroTasks\(PUSH_TASKS, RATED_TASKS\), MATCHMAKING_TASKS\)/.test(vite) && vite.includes("practiceDealsPurge.task.ts"),
    `the purge's Cron Trigger is scheduled in vite.config.ts (${cron} UTC), in step with MATCHMAKING_CRONS`);
  const task = readFileSync("src/lib/rated/tasks/practiceDealsPurge.task.ts", "utf8");
  check(/runPracticeDealsPurge\(\)/.test(task) && /"rated:practice-deals-purge"/.test(task), "the task runs the purge under its scheduled name");
}

console.log(`rated-matchmaking-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: rated matchmaking's switches, queue, recorded-run choice, playback, hidden finish, result, rematch and chat rules.");
