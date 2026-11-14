/**
 * round-release-check (13 Nov 2026, Security C1a): a new room's puzzles are readable round by round
 * (supabase/migrations/20261117500100_round_puzzle_release.sql). Through the real room functions, the release trigger
 * and row level security on a local PostgreSQL, read from a device's own client:
 *
 * - after the start, the room row holds no puzzle and nothing is released; round 1 lands as its intro begins, exactly
 *   its stored public half, never round 2; a player outside the room reads nothing;
 * - calls for a round that hasn't begun answer nothing (move checks, reveal, replay, submit);
 * - each later round lands with its own intro; the finished room reads every round, the full list on its row;
 * - Play again's next game starts hidden again; a disbanded room never releases its unplayed rounds;
 * - a room started before this (its full list on the row, nothing held) plays and reads exactly as before;
 * - the server reads the full list for a playing room, as it always did (every grade, reveal and tie-break);
 * - tie-break rounds from the released rounds give the same standings as from the full list, round by round;
 * - a match room (rated, Arena) releases the same way.
 *
 * Needs the PostgreSQL 16 binaries (preinstalled on GitHub's ubuntu runners). No browser.
 */

import { advanceAfter, lobby, phaseOf, roomCheck, uid, withRoomHarness, type RoomHarness } from "./room-checks-lib";

const t = roomCheck(
  "round-release-check",
  "a new room's rounds are readable one at a time from each round's intro, finished rooms in full, older rooms as before, and the server reads what it always did.",
);
const { check, section } = t;
const ALI = uid(1);
const BO = uid(2);
const OUT = uid(3);
const CY = uid(4);
const DEE = uid(5);

await withRoomHarness(t, "round-release-check", [ALI, BO, OUT, CY, DEE], async (h) => {
  const { q, call, token, duel } = h;
  const types = await import("../src/lib/duel/types");
  const { adminDb } = await import("../src/lib/data/db.server");
  const { readRoom } = await import("../src/lib/data/rooms.server");
  const admin = await adminDb();
  /** What a device reads of the room's released rounds (RLS applies). */
  const released = async (user: string, roomId: string) => {
    const { data, error } = await h.device(user).from("duel_round_puzzles").select("round_number, puzzle").eq("duel_id", roomId).order("round_number");
    if (error) throw new Error(error.message);
    return (data ?? []) as { round_number: number; puzzle: unknown }[];
  };
  const rowPuzzles = async (user: string, roomId: string) => {
    const { data } = await h.device(user).from("duels").select("puzzles_public").eq("id", roomId).maybeSingle();
    return ((data as { puzzles_public?: unknown[] } | null)?.puzzles_public ?? null) as unknown[] | null;
  };
  const held = (roomId: string) => JSON.parse(q(`SELECT puzzles_public::text FROM public.duel_secrets WHERE duel_id = '${roomId}'`)) as unknown[];
  const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);
  /** Both ready, then intro → puzzle → (no answers) → reveal → result → standings → next round's title, or the end. */
  const playThrough = async (roomId: string, round: number) => {
    await call(duel.readyUpFn, { roomId, roundNumber: round }, token(ALI));
    await call(duel.readyUpFn, { roomId, roundNumber: round }, token(BO));
    for (let i = 0; i < 8 && phaseOf(h, roomId).startsWith(`in_progress:${round}:`); i++) await advanceAfter(h, roomId, ALI, 400_000);
  };

  let roomId = "";
  await section("before the intro", async () => {
    const room = await lobby(h, ALI, [BO]);
    roomId = room.roomId;
    const go = await call(duel.startRoomFn, { roomId }, token(ALI));
    check(go.ok === true && phaseOf(h, roomId) === "in_progress:1:starting", "the room starts");
    check(same(await rowPuzzles(BO, roomId), []), "a player reads no puzzle on the room row after the start");
    check((await released(BO, roomId)).length === 0, "nothing is released while Prepare to Duel shows");
    check((await advanceAfter(h, roomId, BO, 60_000)) === "in_progress:1:round_title" && (await released(BO, roomId)).length === 0, "nothing is released on round 1's title");
  });

  await section("round 1's intro", async () => {
    check((await advanceAfter(h, roomId, BO, 60_000)) === "in_progress:1:intro", "round 1's intro begins");
    const got = await released(BO, roomId);
    check(got.length === 1 && got[0]!.round_number === 1 && same(got[0]!.puzzle, held(roomId)[0]), "round 1 is readable from its intro: exactly its stored public half");
    check((await released(ALI, roomId)).length === 1, "every player of the room reads it");
    check((await released(OUT, roomId)).length === 0, "a player outside the room reads nothing");
    const priv = JSON.stringify(q(`SELECT puzzles_private::text FROM public.duel_secrets WHERE duel_id = '${roomId}'`));
    check(!JSON.stringify(got).includes(priv.slice(10, 40)), "the release carries the public half only");
  });

  await section("a round that hasn't begun", async () => {
    const moves = await call(duel.checkMovesFn, { roomId, roundNumber: 2, moves: "" }, token(BO));
    const reveal = await call(duel.revealAnswerFn, { roomId, roundNumber: 2 }, token(BO));
    const submit = await call(duel.submitAnswerFn, { roomId, roundNumber: 2, answer: "", msRemaining: 1000 }, token(BO));
    const { roundReplayFn } = await import("../src/lib/replay/replay.functions");
    const replay = await call(roundReplayFn, { roomId, roundNumber: 2 }, token(BO));
    const nothing = (r: unknown) => r === null || r === undefined || (r as { ok?: boolean }).ok === false;
    check(nothing(moves) && nothing(reveal) && nothing(submit) && nothing(replay), `move checks, the reveal, submit and replay answer nothing for round 2 (${JSON.stringify([moves, reveal, submit, replay]).slice(0, 200)})`);
    check((await released(BO, roomId)).length === 1, "round 2 is still not readable");
  });

  await section("the server reads the full list", async () => {
    const { data } = await readRoom(admin, roomId);
    check(!!data && same(data.puzzles_public, held(roomId)), "the server's own read of a playing room holds every round, as it always did");
    const { roomTieRounds } = await import("../src/lib/duel/tieBreak");
    const { standings } = await import("../src/lib/duel/scoring");
    const full = held(roomId) as import("../src/lib/duel/types").PuzzleData[];
    const players = q(`SELECT json_agg(p ORDER BY player_slot)::text FROM public.duel_players p WHERE duel_id = '${roomId}'`);
    for (let k = 1; k <= full.length; k++) {
      const results = Array.from({ length: k }, (_, i) =>
        [1, 2].map((slot) => ({ duel_id: roomId, player_slot: slot, round_number: i + 1, score: 100, is_correct: true, ms_remaining: 1000 * (slot + i), reaction_avg_ms: null, correct_count: null, errors: null, extra: null, answer: null, id: `${slot}-${i}`, submitted_at: new Date().toISOString() })),
      ).flat() as never[];
      const a = standings(JSON.parse(players), results, k, new Map(), roomTieRounds(full.slice(0, k)));
      const b = standings(JSON.parse(players), results, k, new Map(), roomTieRounds(full));
      check(same(a, b), `standings after round ${k} from the released rounds equal the full list's`);
    }
  });

  await section("each round, then the finish", async () => {
    const rounds = Number(q(`SELECT round_count FROM public.duels WHERE id = '${roomId}'`));
    for (let round = 1; round <= rounds; round++) {
      await playThrough(roomId, round);
      const phase = phaseOf(h, roomId);
      if (round < rounds) {
        check(phase === `in_progress:${round + 1}:round_title` && (await released(BO, roomId)).length === round, `after round ${round}: round ${round + 1}'s title shows, ${round} round(s) released (${phase})`);
        check((await advanceAfter(h, roomId, BO, 60_000)) === `in_progress:${round + 1}:intro` && (await released(BO, roomId)).length === round + 1, `round ${round + 1} lands with its intro`);
      }
    }
    for (let i = 0; i < 4 && !phaseOf(h, roomId).startsWith("finished"); i++) await advanceAfter(h, roomId, ALI, types.INTRO_MS * 20);
    check(phaseOf(h, roomId).startsWith("finished"), `the room finishes (${phaseOf(h, roomId)})`);
    check(same(await rowPuzzles(BO, roomId), held(roomId)), "the finished room's row holds every round for its players, exactly as dealt");
    check((await released(BO, roomId)).length === rounds, "every round is released at the finish");
  });

  await section("Play again", async () => {
    const again = await call(duel.rematchFn, { roomId }, token(ALI));
    check(again.ok !== false && phaseOf(h, roomId).startsWith("waiting"), `the host plays again (${JSON.stringify(again)})`);
    check((await released(BO, roomId)).length === 0, "the next game shows none of the last game's rounds");
    await call(duel.setRoomSettingsFn, { roomId, picks: ["retro"], rounds: 3 }, token(ALI));
    await call(duel.startRoomFn, { roomId }, token(ALI));
    check(same(await rowPuzzles(BO, roomId), []) && (await released(BO, roomId)).length === 0, "the next game starts hidden again");
    await advanceAfter(h, roomId, BO, 60_000);
    await advanceAfter(h, roomId, BO, 60_000);
    const got = await released(BO, roomId);
    check(got.length === 1 && same(got[0]!.puzzle, held(roomId)[0]), "the next game's round 1 lands with its intro");
  });

  await section("a disbanded room", async () => {
    const room = await lobby(h, ALI, [BO]);
    await call(duel.startRoomFn, { roomId: room.roomId }, token(ALI));
    await advanceAfter(h, room.roomId, BO, 60_000);
    await advanceAfter(h, room.roomId, BO, 60_000);
    q(`UPDATE public.duels SET disbanded_at = now(), status = 'finished' WHERE id = '${room.roomId}'`);
    check((await released(BO, room.roomId)).length === 1 && same(await rowPuzzles(BO, room.roomId), []), "a disbanded room never releases its unplayed rounds");
  });

  await section("a room started before this", async () => {
    // Exactly what a room started before held: every round on its row, nothing held on the server.
    const room = await lobby(h, ALI, [BO]);
    await call(duel.startRoomFn, { roomId: room.roomId }, token(ALI));
    const list = held(room.roomId);
    q(`UPDATE public.duels SET puzzles_public = (SELECT puzzles_public FROM public.duel_secrets WHERE duel_id = '${room.roomId}') WHERE id = '${room.roomId}'`);
    q(`UPDATE public.duel_secrets SET puzzles_public = NULL WHERE duel_id = '${room.roomId}'`);
    check(same(await rowPuzzles(BO, room.roomId), list), "its players read every round on the row from the start, as before");
    await advanceAfter(h, room.roomId, BO, 60_000);
    await advanceAfter(h, room.roomId, BO, 60_000);
    check(phaseOf(h, room.roomId) === "in_progress:1:intro" && (await released(BO, room.roomId)).length === 0, "it releases nothing (its rounds were never held)");
    const { data } = await readRoom(admin, room.roomId);
    check(!!data && same(data.puzzles_public, list), "the server reads it as stored");
  });

  await section("a match room", async () => {
    const { createDealtMatchRoom } = await import("../src/lib/rated/rated.server");
    const made = await createDealtMatchRoom(admin, { format: "bo3", choice: "mixed", userIds: [CY, DEE] }, Date.now());
    check((await released(CY, made.id)).length === 0 && same(await rowPuzzles(CY, made.id), []), "a match room starts with nothing readable");
    await advanceRoom(h, made.id, CY);
    const got = await released(CY, made.id);
    check(got.length === 1 && same(got[0]!.puzzle, held(made.id)[0]), "a match room's round 1 lands with its intro");
    check((await released(ALI, made.id)).length === 0, "a player outside the match reads nothing");
  });
});

/** Prepare to Duel → title → intro for round 1. */
async function advanceRoom(h: RoomHarness, roomId: string, user: string): Promise<void> {
  await advanceAfter(h, roomId, user, 60_000);
  await advanceAfter(h, roomId, user, 60_000);
}

t.finish();
