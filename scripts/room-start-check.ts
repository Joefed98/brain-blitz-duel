/**
 * room-start-check (13 Nov 2026, Security C1a): the host's Start claims the room before its rounds are built, then
 * writes the start in one transaction (supabase/migrations/20261117500000_room_start_claim.sql; startRoomFn in
 * src/lib/duel/duel.functions.ts). Through the real room functions, RPCs and row level security on a local PostgreSQL:
 *
 * - two Starts at once deal once (one game_started event, one set of round records), both answer ok;
 * - while a fresh claim holds: Start builds nothing, settings and categories are refused ("The rounds are being dealt.");
 *   a claim 61 s old is abandoned: settings save and Start deals;
 * - a deal that fails part-way (a check-only switch, never read in production) gives the claim back at once;
 * - the start is all or nothing: with duel_secrets unavailable nothing is stored and the room stays waiting;
 * - a start whose settings changed since its claim, or with too few players, gives the claim back and starts nothing;
 * - the RPCs are refused to a device; a started room plays its own deal (deal_origin_id) and holds its public halves;
 * - rated and Arena match rooms start through the same RPC (createDealtMatchRoom).
 *
 * Needs the PostgreSQL 16 binaries (preinstalled on GitHub's ubuntu runners). No browser.
 */

import { lobby, roomCheck, uid, withRoomHarness } from "./room-checks-lib";

const t = roomCheck(
  "room-start-check",
  "the host's Start claims the room, deals once, refuses settings while dealing, gives the claim back on a failure, and starts in one transaction.",
);
const { check, section } = t;
const ALI = uid(1);
const BO = uid(2);
const CY = uid(3);
const DEE = uid(4);

await withRoomHarness(t, "room-start-check", [ALI, BO, CY, DEE], async (h) => {
  const { q, call, token, duel } = h;
  const { setCheckOverride } = await import("../src/lib/checkOverride");
  const { DEALING_MESSAGE } = await import("../src/lib/duel/dealClaim");
  const { adminDb } = await import("../src/lib/data/db.server");
  const admin = await adminDb();
  const started = (roomId: string) => q(`SELECT count(*) FROM public.room_events WHERE duel_id = '${roomId}' AND event = 'game_started'`);
  const statusOf = (roomId: string) => q(`SELECT status FROM public.duels WHERE id = '${roomId}'`);
  const claimOf = (roomId: string) => q(`SELECT coalesce(start_claimed_at::text, '') FROM public.duels WHERE id = '${roomId}'`);

  await section("two Starts at once", async () => {
    const room = await lobby(h, ALI, [BO]);
    const [a, b] = await Promise.all([
      call(duel.startRoomFn, { roomId: room.roomId }, token(ALI)),
      call(duel.startRoomFn, { roomId: room.roomId }, token(ALI)),
    ]);
    check(a.ok === true && b.ok === true, "both Starts answer ok");
    check(started(room.roomId) === "1", `the room is dealt once (${started(room.roomId)} game_started)`);
    check(statusOf(room.roomId) === "in_progress" && claimOf(room.roomId) === "", "the room is in progress and its claim cleared");
    const records = q(`SELECT jsonb_array_length(round_records)::text FROM public.duel_secrets WHERE duel_id = '${room.roomId}'`);
    check(records === "3", `one set of round records (${records})`);
    check(q(`SELECT deal_origin_id::text FROM public.duels WHERE id = '${room.roomId}'`) === room.roomId, "a room started by its host plays its own deal");
    check(
      q(`SELECT jsonb_array_length(d.puzzles_public)::text || ',' || jsonb_array_length(s.puzzles_public) || ',' || jsonb_array_length(s.puzzles_private) FROM public.duels d JOIN public.duel_secrets s ON s.duel_id = d.id WHERE d.id = '${room.roomId}'`) === "0,3,3",
      "the room row holds no puzzle; the server holds 3 public and 3 private halves",
    );
  });

  await section("while dealing", async () => {
    const room = await lobby(h, ALI, [BO]);
    q(`UPDATE public.duels SET start_claimed_at = now() WHERE id = '${room.roomId}'`);
    const settings = await call(duel.setRoomSettingsFn, { roomId: room.roomId, picks: ["sports"], rounds: 3 }, token(ALI));
    check(settings.ok === false && settings.message === DEALING_MESSAGE, `settings are refused while the rounds are dealt (${JSON.stringify(settings)})`);
    const cats = await call(duel.setRoomModesFn, { roomId: room.roomId, categories: ["word"] }, token(ALI));
    check(cats.ok === false && cats.message === DEALING_MESSAGE, `categories are refused while the rounds are dealt (${JSON.stringify(cats)})`);
    check(/retro/.test(q(`SELECT selected_categories::text FROM public.duels WHERE id = '${room.roomId}'`)), "the room's settings are unchanged");
    const again = await call(duel.startRoomFn, { roomId: room.roomId }, token(ALI));
    check(again.ok === true && started(room.roomId) === "0" && statusOf(room.roomId) === "waiting", "a Start while dealing builds nothing (the claim holds)");
    const look = await call(duel.setPlayerLookFn, { roomId: room.roomId, colour: 7 }, token(BO));
    check(look.ok !== false, `joins and looks still change while dealing (${JSON.stringify(look)})`);
    const join = await call(duel.joinRoomFn, { roomCode: room.roomCode, displayName: "Cy", via: "code" }, token(CY));
    check(join.ok === true, "a player can join while the rounds are dealt");
    // An abandoned claim (older than 60 s): settings save again and the next Start deals.
    q(`UPDATE public.duels SET start_claimed_at = now() - interval '61 seconds' WHERE id = '${room.roomId}'`);
    const saved = await call(duel.setRoomSettingsFn, { roomId: room.roomId, picks: ["retro"], rounds: 3 }, token(ALI));
    check(saved.ok === true, `a claim 61 s old is abandoned: settings save (${JSON.stringify(saved)})`);
    const go = await call(duel.startRoomFn, { roomId: room.roomId }, token(ALI));
    check(go.ok === true && started(room.roomId) === "1" && statusOf(room.roomId) === "in_progress", "a Start after an abandoned claim deals the room");
  });

  await section("a deal that fails", async () => {
    const room = await lobby(h, ALI, [BO]);
    setCheckOverride("__DUELZ_FAIL_ROOM_DEAL__", true);
    const failed = await call(duel.startRoomFn, { roomId: room.roomId }, token(ALI));
    setCheckOverride("__DUELZ_FAIL_ROOM_DEAL__", undefined);
    check(failed.ok === false && /Couldn’t deal the rounds/.test(failed.message), `a failed deal says so (${JSON.stringify(failed)})`);
    check(claimOf(room.roomId) === "" && statusOf(room.roomId) === "waiting" && started(room.roomId) === "0", "the claim is given back at once and the room still waits");
    const retry = await call(duel.startRoomFn, { roomId: room.roomId }, token(ALI));
    check(retry.ok === true && statusOf(room.roomId) === "in_progress", "the host starts again straight away");
  });

  await section("all or nothing", async () => {
    const room = await lobby(h, ALI, [BO]);
    q(`ALTER TABLE public.duel_secrets RENAME TO duel_secrets_off`);
    let threw = false;
    try {
      await call(duel.startRoomFn, { roomId: room.roomId }, token(ALI));
    } catch {
      threw = true;
    } finally {
      q(`ALTER TABLE public.duel_secrets_off RENAME TO duel_secrets`);
    }
    check(threw, "the start fails when the private halves can't be written");
    check(
      statusOf(room.roomId) === "waiting" && q(`SELECT jsonb_array_length(puzzles_public)::text || ',' || jsonb_array_length(round_order) FROM public.duels WHERE id = '${room.roomId}'`) === "0,0" && started(room.roomId) === "0",
      "nothing is stored: the room still waits with no rounds",
    );
    check(claimOf(room.roomId) === "", "the claim is given back");
  });

  await section("the start RPC's own refusals", async () => {
    const room = await lobby(h, ALI, [BO]);
    const claim = await admin.rpc("claim_room_deal", { p_room_id: room.roomId, p_now: new Date().toISOString(), p_stale_ms: 60_000 });
    const stamp = (claim.data as { claimed_at: string }[] | null)?.[0]?.claimed_at ?? "";
    check(!!stamp, "a claim is taken on a waiting room");
    const second = await admin.rpc("claim_room_deal", { p_room_id: room.roomId, p_now: new Date().toISOString(), p_stale_ms: 60_000 });
    check(((second.data as unknown[] | null) ?? []).length === 0, "a second claim is refused while the first is fresh");
    const before = q(`SELECT selected_categories::text FROM public.duels WHERE id = '${room.roomId}'`);
    q(`UPDATE public.duels SET selected_categories = '["sports","rounds:3"]'::jsonb WHERE id = '${room.roomId}'`);
    const args = {
      p_room_id: room.roomId,
      p_claim: stamp,
      p_round_order: ["pinball"],
      p_puzzles_public: [{ type: "pinball" }],
      p_puzzles_private: [{}],
      p_started_at: new Date().toISOString(),
      p_min_players: 2,
    };
    const changed = await admin.rpc("start_dealt_room", { ...args, p_selected_categories: JSON.parse(before) });
    check(changed.data === "lost" && claimOf(room.roomId) === "" && statusOf(room.roomId) === "waiting", `settings changed since the claim: nothing starts, the claim is given back (${changed.data})`);
    const retaken = await admin.rpc("claim_room_deal", { p_room_id: room.roomId, p_now: new Date().toISOString(), p_stale_ms: 60_000 });
    const stamp2 = (retaken.data as { claimed_at: string }[] | null)?.[0]?.claimed_at ?? "";
    const few = await admin.rpc("start_dealt_room", { ...args, p_claim: stamp2, p_min_players: 3 });
    check(few.data === "too_few" && claimOf(room.roomId) === "" && statusOf(room.roomId) === "waiting", `too few players: nothing starts, the claim is given back (${few.data})`);
    const wrong = await admin.rpc("start_dealt_room", { ...args, p_claim: "2026-01-01T00:00:00Z" });
    check(wrong.data === "lost" && statusOf(room.roomId) === "waiting", "a start with someone else's claim is refused");
    const device = h.device(ALI);
    const claimByDevice = await device.rpc("claim_room_deal", { p_room_id: room.roomId, p_now: new Date().toISOString(), p_stale_ms: 60_000 });
    const startByDevice = await device.rpc("start_dealt_room", { ...args, p_claim: stamp2 });
    const releaseByDevice = await device.rpc("release_room_deal", { p_room_id: room.roomId, p_claim: stamp2 });
    check(!!claimByDevice.error && !!startByDevice.error && !!releaseByDevice.error, "a device can't call the claim, start or release functions");
  });

  await section("match rooms", async () => {
    const { createDealtMatchRoom } = await import("../src/lib/rated/rated.server");
    const made = await createDealtMatchRoom(admin, { format: "bo3", choice: "mixed", userIds: [CY, DEE] }, Date.now());
    check(
      q(`SELECT d.status || ',' || d.phase || ',' || jsonb_array_length(d.puzzles_public) || ',' || jsonb_array_length(s.puzzles_public) || ',' || (d.deal_origin_id = d.id)::text || ',' || coalesce(d.start_claimed_at::text, '-') FROM public.duels d JOIN public.duel_secrets s ON s.duel_id = d.id WHERE d.id = '${made.id}'`) ===
        "in_progress,starting,0,3,true,-",
      "a rated or Arena match room starts through the same one-transaction start: holding its 3 public halves, its own deal",
    );
  });
});

t.finish();
