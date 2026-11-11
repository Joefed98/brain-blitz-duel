/**
 * rated-matchmaking-check (wave 3, W3b; docs/rated/matchmaking-interface.md): the pure rules of rated matchmaking,
 * no database, no browser (~1 s).
 *
 * - the switches: only bo3 with Mixed / All puzzles / All arcade at launch; anything else refused; testers only until
 *   RATED_PLAY_FOR_EVERYONE;
 * - the queue: ±50 widening by 50 every 2 s to ±200, a recorded run from 8 s; pairing only within the same format and
 *   choice, never with oneself or a placement player, nearest rating first;
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
import { RATED_CHOICES_ON, RATED_FORMATS_ON, RATED_PLAY_FOR_EVERYONE } from "../src/config/ratedConfig";
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
  check(!canPair(e("a", 1000, now), e("b", 1000, now, { placement: true }), now), "pair: never a placement player (they play recorded runs)");
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

/* ------------------------------------------------------------------ result and rematch */
{
  const o = matchOutcome([
    { a: 150, b: 120, aTimeMs: 30_000, bTimeMs: 20_000 },
    { a: 90, b: 140, aTimeMs: 30_000, bTimeMs: 20_000 },
    { a: 100, b: 100, aTimeMs: 25_000, bTimeMs: 26_000 },
  ]);
  check(o.winsA === 2 && o.winsB === 1 && o.winner === "a", "result: games won (a level score goes to less time used)");
  const level = matchOutcome([
    { a: 150, b: 100, aTimeMs: 1, bTimeMs: 1 },
    { a: 100, b: 140, aTimeMs: 1, bTimeMs: 1 },
    { a: 100, b: 100, aTimeMs: 5, bTimeMs: 5 },
  ]);
  check(level.winsA === 1 && level.winsB === 1 && level.winner === "a", "result: level on games, the higher total");
  check(matchOutcome([{ a: 1, b: 1, aTimeMs: 1, bTimeMs: 1 }]).winner === "draw", "result: level on everything, a draw");
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

console.log(`rated-matchmaking-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log("FAIL");
  process.exit(1);
}
console.log("PASS: rated matchmaking's switches, queue, recorded-run choice, playback, hidden finish, result, rematch and chat rules.");
