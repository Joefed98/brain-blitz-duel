/**
 * security-fixes-check (7 Nov 2026): the server-side fixes for the findings docs/audit-nov-2026/security.md marks
 * "before the Supabase move". One section per finding; no browser, no database (~2 s).
 *
 *   H1  practice tokens seal a digest of the public half and every handler that merges the phone's public half
 *       opens the token through it (practiceSeal.server.ts); Hanoi's table is built only for a legal board and the
 *       progress caches are bounded.
 *   M2  one name cleaner (displayName.server.ts) for rooms, the daily, challenges and the room-to-challenge copy;
 *       chat takes the same strip and the stronger mask.
 *   M4  create buckets fail closed on a database error (open only while the counter function is missing); per-address
 *       buckets on the signed-out practice paths and the create paths; per-user buckets on starts and lobby looks.
 *   M5  security headers on every production response (src/lib/securityHeaders.ts, src/server.ts).
 *   M6  a player who left can't answer, READY, check words or moves, or change their look.
 *   M7  demo saves need the server's own switch in production; key guesses are rate limited.
 *   L1  database errors reach the phone as a plain message; a room id that isn't a uuid never reaches the database.
 *   L3  chat's gap and per-room cap as atomic buckets.
 *   L4  room share places up to 16; terms dates are the server's; beta events rate limited.
 *   L7  no room or daily seed in a log line.
 *   L8  a dedicated practice seal key with a key id; older tokens still open.
 *   L13 the standard grader's answer body is cut to the game's cap first.
 *
 *   bun scripts/security-fixes-check.ts
 */
import { readFileSync } from "node:fs";

process.env["SUPABASE_URL"] ??= "https://security-fixes-check.invalid";
delete process.env["SUPABASE_SERVICE_ROLE_KEY"];
delete process.env["PRACTICE_SEAL_KEY"];

const failures: string[] = [];
let passes = 0;
const check = (ok: boolean, message: string) => {
  if (ok) passes++;
  else failures.push(message);
};
const src = (path: string) => readFileSync(path, "utf8");
/** The text of one server function, from its export to the next export. */
function fnText(file: string, name: string): string {
  const text = src(file);
  const at = text.indexOf(`export const ${name} =`);
  if (at < 0) return "";
  const next = text.indexOf("\nexport ", at + 10);
  return text.slice(at, next < 0 ? undefined : next);
}

/* ------------------------------------------------------------------ H1: practice deals ---- */
{
  const seal = await import("../src/lib/duel/practiceSeal.server");
  const { splitPuzzle, mergePuzzle } = await import("../src/lib/duel/secrets");
  const { generateTower } = await import("../src/lib/duel/tower.server");
  const full = generateTower();
  const { pub, priv } = splitPuzzle(full);
  const token = await seal.sealDeal(pub, priv as Record<string, unknown>);
  const opened = await seal.openDeal(token, pub);
  check(!!opened && opened.priv["type"] === "tower" && JSON.stringify(mergePuzzle(opened.pub, opened.priv)) === JSON.stringify(mergePuzzle(pub, priv)), "H1: a deal opens for the public half it was dealt with, merging to the dealt puzzle");
  const roundTrip = JSON.parse(JSON.stringify(pub));
  check(!!(await seal.openDeal(token, roundTrip)), "H1: the public half after a JSON round trip (the phone's copy) still matches");
  check(!!(await seal.openDeal(token, mergePuzzle(pub, priv))), "H1: the full puzzle sent back (the reveal's demo save) matches on its public fields");
  const forged = { ...(pub as unknown as Record<string, unknown>), discs: 14, start: [[14, 13, 12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1], [], [], []] };
  check((await seal.openDeal(token, forged)) === null, "H1: a public half with Hanoi's disc count changed is refused");
  check((await seal.openDeal(token, { ...(pub as unknown as Record<string, unknown>), timeLimitMs: 10_000_000 })) === null, "H1: a public half with the clock changed is refused");
  check((await seal.openDeal(token, { ...(pub as unknown as Record<string, unknown>), type: "sudoku" })) === null, "H1: another game's type is refused");
  const legacy = await seal.seal(priv);
  check((await seal.openDeal(legacy, pub)) === null, "H1: a token sealed without the digest (before the fix) is refused");
  check((await seal.openDeal("not-a-token", pub)) === null && (await seal.openDeal(token, null)) === null, "H1: a malformed token or puzzle is refused, not thrown");
  let threw = false;
  try {
    await seal.openDealOrThrow(token, forged);
  } catch (e) {
    threw = e instanceof Error && /didn’t load/.test(e.message);
  }
  check(threw, "H1: live calls get the usual \"didn’t load\" error for a refused token");
  // Secret fields the phone sends are dropped before the merge (the sealed half always wins, and nothing else rides in).
  const withSecret = { ...(pub as unknown as Record<string, unknown>), solution: [{ from: 0, to: 1 }] };
  const o2 = await seal.openDeal(token, withSecret);
  check(!!o2 && !("solution" in (o2.pub as unknown as Record<string, unknown>)), "H1: a secret field sent by the phone is not part of the public half merged");
  // An arcade deal (no private half): the seed and stamps are bound too.
  const arcadePub = { type: "breaker", seed: 12345, brkRev: 11 } as never;
  const arcadeToken = await seal.sealDeal(arcadePub, { type: "breaker" });
  check(!!(await seal.openDeal(arcadeToken, arcadePub)) && (await seal.openDeal(arcadeToken, { type: "breaker", seed: 1, brkRev: 11 })) === null && (await seal.openDeal(arcadeToken, { type: "breaker", seed: 12345, brkRev: 5 })) === null, "H1: an arcade deal's seed and stamp can't be swapped");

  // Every practice handler that merges the phone's half goes through openDeal, and every deal is sealed with its digest.
  const pf = src("src/lib/duel/practice.functions.ts");
  check(!/\bunseal(Raw)?\([^)]*\)\s*;?\s*\n[^\n]*mergePuzzle\(data\.puzzle/.test(pf) && !/mergePuzzle\(data\.puzzle/.test(pf), "H1: no handler merges the phone's puzzle as sent (mergePuzzle(data.puzzle …) is gone)");
  for (const name of ["practiceGradeFn", "practiceGradeQueuedFn", "practiceCheckMovesFn", "saveIntroDemoFn", "savePuzzleDemoFn"]) {
    check(/openDeal(OrThrow)?\(/.test(fnText("src/lib/duel/practice.functions.ts", name)), `H1: ${name} opens its token through openDeal`);
  }
  const word = fnText("src/lib/duel/practice.functions.ts", "practiceCheckWordFn");
  check((word.match(/openDealOrThrow\(/g) ?? []).length === 2, "H1: practiceCheckWordFn's two sealed games (Roundabout, Lookout) open through openDeal");
  check(!/\bseal\(\{/.test(pf) && (pf.match(/sealDeal\(/g) ?? []).length >= 4, "H1: every practice deal (live, intro example, pack) is sealed with sealDeal");
  const queued = fnText("src/lib/duel/practice.functions.ts", "practiceGradeQueuedFn");
  check(/reason: "deal"/.test(queued) && !/pack !== undefined &&/.test(queued), "H1: a queued run is checked against its digest whether or not it came from a pack");

  // Hanoi: no table for an illegal board, legal boards grade as before, the cache stays small.
  const progress = await import("../src/lib/duel/puzzleProgress");
  progress.clearProgressCaches();
  const legalShare = progress.rev3Progress({ puzzle: full, answer: "", extra: null, latestMs: 0 });
  check(typeof legalShare === "number" && legalShare >= 0 && legalShare <= 1, `H1: a dealt Hanoi board still has a progress share (${legalShare})`);
  const t0 = Date.now();
  const huge = progress.rev3Progress({ puzzle: forged as never, answer: "", extra: null, latestMs: 0 });
  check(huge === 0 && Date.now() - t0 < 200, `H1: a 14-disc board gets no credit and no table (${huge}, ${Date.now() - t0} ms)`);
  check(!progress.towerBoardLegal(4, 0, 14) && !progress.towerBoardLegal(5, 0, 9) && !progress.towerBoardLegal(4, 4, 9) && !progress.towerBoardLegal(3, 0, 1.5) && progress.towerBoardLegal(4, 3, 9) && progress.towerBoardLegal(3, 2, 9), "H1: towerBoardLegal takes 3–4 pegs, a target among them and at most 10 discs");
  for (let target = 0; target < 4; target++)
    for (const discs of [6, 7, 8, 9, 10]) {
      const start = [Array.from({ length: discs }, (_, i) => discs - i), [], [], []];
      progress.rev3Progress({ puzzle: { ...full, start, discs, targetPeg: target } as never, answer: "", extra: null, latestMs: 0 });
    }
  check(progress.progressCacheSizes().tower <= progress.TOWER_TABLE_CAP, `H1: the Hanoi cache holds at most ${progress.TOWER_TABLE_CAP} tables (${progress.progressCacheSizes().tower})`);
  // Rings: any pattern number folds onto the real patterns, so the cache can't grow without bound.
  const { generateRings } = await import("../src/lib/duel/rings.server");
  const { RING_PATTERNS } = await import("../src/lib/duel/rings");
  const rings = generateRings();
  progress.clearProgressCaches();
  const baseline = progress.rev3Progress({ puzzle: rings, answer: "0,2", extra: null, latestMs: 0 });
  for (let k = 1; k <= 40; k++)
    progress.rev3Progress({ puzzle: { ...rings, pattern: rings.pattern + k * RING_PATTERNS.length } as never, answer: "0,2", extra: null, latestMs: 0 });
  const again = progress.rev3Progress({ puzzle: { ...rings, pattern: rings.pattern + 7 * RING_PATTERNS.length } as never, answer: "0,2", extra: null, latestMs: 0 });
  check(progress.progressCacheSizes().rings <= RING_PATTERNS.length && again === baseline, `H1: 40 pattern numbers for one pattern share its table (${progress.progressCacheSizes().rings} cached; ${again} = ${baseline})`);
}

/* ------------------------------------------------------------------ M2: names and chat ---- */
{
  const names = await import("../src/lib/duel/displayName.server");
  const { NAME_REFUSED_MESSAGE } = await import("../src/lib/duel/boardName.server");
  const clean = names.cleanDisplayName;
  check(clean("Jo‮evil") === "Joevil" && clean("A​li") === "Ali" && clean("Sa\u0000m\u0007") === "Sam" && clean("Ｓａｍ") === "Sam", "M2: bidi, zero-width and control characters are dropped; full-width letters read plain");
  const emoji = clean("😀".repeat(20));
  check(Array.from(emoji).length === names.DISPLAY_NAME_MAX && !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(emoji), "M2: names are cut by code point (no half emoji)");
  check(clean("a\uD800b") === "ab", "M2: a lone surrogate is dropped");
  check(clean(42 as unknown) === "42" && clean({} as unknown) === "" && clean(null) === "", "M2: a non-string name is no name (never a 500)");
  const refused = ["f​uck", "fυck", "Ｆｕｃｋ", "fück", "Joulz", "J0ULZ fan", "Duelz", "Admin", "moderator"];
  const allowed = ["Cassie", "Dickens", "Scunthorpe", "Hancock", "Ali 😀", "Zoë", "Sam", "Jo", "Teamster", "Penistone"];
  const wrongRefused = allowed.filter((n) => names.nameRefusal(clean(n)) !== null);
  const wrongAllowed = refused.filter((n) => names.nameRefusal(clean(n)) === null);
  check(wrongRefused.length === 0, `M2: ordinary names are allowed (${wrongRefused.join(", ") || "all"})`);
  check(wrongAllowed.length === 0, `M2: look-alike, zero-width and reserved names are refused (${wrongAllowed.join(", ") || "all"})`);
  check(names.nameRefusal("fυck")?.message === NAME_REFUSED_MESSAGE && names.nameRefusal("Joulz")?.reason === "reserved", "M2: an offensive name gets the board's message, a reserved one its own");
  check(names.copiedDisplayName("fυck") === "Player" && names.copiedDisplayName("  Ali‮  ") === "Ali" && names.copiedDisplayName("") === "Player", "M2: a room name copied onto a challenge board is cleaned, and a refused one becomes Player");
  const chat = names.censorChat(names.cleanChatText("hi fuckyou and  sh1t‮\nbye", 120));
  check(chat === "hi ★★★ and ★★★ bye", `M2: chat strips bidi characters and masks joined words ("${chat}")`);
  check(names.censorChat("Scunthorpe is glass half full, assess") === "Scunthorpe is glass half full, assess", "M2: chat's mask leaves ordinary words alone");
  const duel = src("src/lib/duel/duel.functions.ts");
  check(/cleanDisplayName\(name\)/.test(duel) && !/\(name \?\? ""\)\.trim\(\)\.slice\(0, 14\)/.test(duel), "M2: rooms store names through cleanDisplayName");
  check(/roomNameRefusal\(data\.displayName\)/.test(fnText("src/lib/duel/duel.functions.ts", "createRoomFn")) && /roomNameRefusal\(data\.displayName\)/.test(fnText("src/lib/duel/duel.functions.ts", "joinRoomFn")), "M2: creating and joining a room refuse an offensive or reserved name");
  check(/nameRefusal\(name\)/.test(src("src/lib/duel/daily.functions.ts")) && /nameRefusal\(name\)/.test(src("src/lib/duel/challenge.functions.ts")), "M2: the daily and challenge starts use the same refusal");
  check(/copiedDisplayName\(player\.display_name\)/.test(src("src/lib/duel/challenge.server.ts")), "M2: a room's names copied onto a challenge go through copiedDisplayName");
  const chatFn = src("src/lib/duel/chat.functions.ts");
  check(/cleanChatText\(data\.text/.test(chatFn) && /censorChat\(text\)/.test(chatFn), "M2: chat is cleaned and masked by the shared helpers");
}

/* ------------------------------------------------------------------ M4: rate limits ---- */
{
  const rl = await import("../src/lib/duel/rateLimit.server");
  const answering = (error: unknown, data: unknown = true) => ({ rpc: async () => ({ data, error }) });
  const throwing = { rpc: async () => { throw new Error("network down"); } };
  const id = "00000000-0000-4000-8000-000000000000";
  check(await rl.withinRateLimit(answering(null, true), id, rl.CREATE_ROOM_LIMIT), "M4: under the limit, allowed");
  check(!(await rl.withinRateLimit(answering(null, false), id, rl.CREATE_ROOM_LIMIT)), "M4: over the limit, refused");
  check(!(await rl.withinRateLimit(answering({ code: "57014", message: "canceling statement" }), id, rl.CREATE_ROOM_LIMIT)), "M4: a database error refuses a create (fail closed)");
  check(!(await rl.withinRateLimit(throwing, id, rl.CHALLENGE_CREATE_LIMIT)), "M4: a thrown error refuses a challenge create (fail closed)");
  check(await rl.withinRateLimit(answering({ code: "PGRST202", message: "Could not find the function public.take_rate_limit" }), id, rl.CREATE_ROOM_LIMIT), "M4: the counter function missing (migration not applied) still lets a create through");
  check(await rl.withinRateLimit(answering({ code: "57014", message: "x" }), id, rl.ROOM_LOOKUP_LIMIT), "M4: other buckets still fail open");
  check(!!rl.CREATE_ROOM_LIMIT.failClosed && !!rl.CHALLENGE_CREATE_LIMIT.failClosed && !!rl.IP_CREATE_ROOM_LIMIT.failClosed && !rl.ROOM_LOOKUP_LIMIT.failClosed, "M4: only the create buckets fail closed");
  const k1 = await rl.addressKey("203.0.113.9");
  check(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(k1) && k1 === (await rl.addressKey("203.0.113.9")) && k1 !== (await rl.addressKey("203.0.113.10")) && !k1.includes("203"), "M4: an address keys its bucket by a stable uuid-shaped hash (the address is never stored)");
  check(await rl.withinIpRateLimit(rl.IP_PRACTICE_DEAL_LIMIT, answering(null, false)), "M4: with no request (no address) the per-address limit allows the call");
  const pf = "src/lib/duel/practice.functions.ts";
  for (const [name, kind] of [["practiceGenerateFn", "deal"], ["practicePackFn", "pack"], ["practiceGradeFn", "grade"], ["practiceGradeQueuedFn", "grade"], ["practiceCheckWordFn", "check"], ["practiceCheckMovesFn", "check"]] as const)
    check(fnText(pf, name).includes(`practiceLimit("${kind}")`), `M4: ${name} is limited per address (${kind})`);
  check(/withinIpRateLimit\(IP_CREATE_ROOM_LIMIT/.test(fnText("src/lib/duel/duel.functions.ts", "createRoomFn")), "M4: making a room is limited per address too");
  const cf = "src/lib/duel/challenge.functions.ts";
  check(/withinIpRateLimit\(IP_CHALLENGE_CREATE_LIMIT/.test(fnText(cf, "createChallengeFn")) && /withinIpRateLimit\(IP_CHALLENGE_CREATE_LIMIT/.test(fnText(cf, "challengeFromRoomFn")), "M4: making a challenge is limited per address too");
  check(/START_ROOM_LIMIT/.test(fnText("src/lib/duel/duel.functions.ts", "startRoomFn")) && /CHALLENGE_START_LIMIT/.test(fnText(cf, "startChallengeFn")) && /PLAYER_LOOK_LIMIT/.test(fnText("src/lib/duel/duel.functions.ts", "setPlayerLookFn")), "M4: starting a room or challenge and changing a look have per-user buckets");
}

/* ------------------------------------------------------------------ M5: headers ---- */
{
  const h = await import("../src/lib/securityHeaders");
  const https = h.securityHeadersFor("https://joulz.uk/practice");
  check(/frame-ancestors 'self'/.test(https["Content-Security-Policy"] ?? "") && !/\*\.lovable\.app/.test(h.FRAME_ANCESTORS) && https["X-Content-Type-Options"] === "nosniff" && https["Referrer-Policy"] === "strict-origin-when-cross-origin" && /max-age=\d{7,}/.test(https["Strict-Transport-Security"] ?? ""), "M5: frame-ancestors, nosniff, referrer policy and HSTS over HTTPS");
  check(!("Strict-Transport-Security" in h.securityHeadersFor("http://localhost:3000/")), "M5: no HSTS over plain HTTP");
  const before = new Response("<p>hi</p>", { status: 200, headers: { "content-type": "text/html", "Referrer-Policy": "no-referrer" } });
  const after = h.withSecurityHeaders(before, "https://joulz.uk/");
  check(after.headers.get("x-content-type-options") === "nosniff" && after.headers.get("referrer-policy") === "no-referrer" && after.headers.get("content-type") === "text/html" && (await after.text()) === "<p>hi</p>", "M5: headers added, existing ones and the body kept");
  check(h.withSecurityHeaders(new Response(null, { status: 304 }), "https://joulz.uk/").status === 304, "M5: a 304 passes through");
  const server = src("src/server.ts");
  check(/withSecurityHeaders\(response, request\.url\)/.test(server) && (server.match(/secured\(/g) ?? []).length >= 3 && /import\.meta\.env\.PROD/.test(server), "M5: the server entry adds them to every production response, the error page included");
}

/* ------------------------------------------------------------------ M6: players who left ---- */
{
  const df = "src/lib/duel/duel.functions.ts";
  for (const name of ["submitAnswerFn", "readyUpFn", "checkWordFn", "checkMovesFn", "setPlayerLookFn"]) {
    const text = fnText(df, name);
    const left = text.indexOf("playerHasLeft(");
    check(left > 0 && left < text.indexOf("getRoom(") , `M6: ${name} refuses a player who left before reading the room`);
  }
  const submit = fnText(df, "submitAnswerFn");
  check(submit.indexOf("playerHasLeft(") < submit.indexOf('update({ status: "active" })'), "M6: an answer never brings a player who left back (only one who went quiet)");
  const { playerHasLeft } = await import("../src/lib/duel/duel.functions");
  check(playerHasLeft({ status: "left" }) && !playerHasLeft({ status: "inactive" }) && !playerHasLeft({ status: "active" }), "M6: left is refused; inactive and active are not");
}

/* ------------------------------------------------------------------ M7: intro demos ---- */
{
  const { demoSavesOpen } = await import("../src/lib/duel/demoSaves.server");
  check(!demoSavesOpen(true, undefined) && !demoSavesOpen(true, "true") && demoSavesOpen(true, "1") && demoSavesOpen(false, undefined), "M7: a production build takes demo saves only with INTRO_DEMO_SAVES=1; a dev server always");
  const pf = "src/lib/duel/practice.functions.ts";
  for (const name of ["saveIntroDemoFn", "savePuzzleDemoFn"])
    check(/data\.dev !== true \|\| !\(await demoSavesAllowed\(\)\)/.test(fnText(pf, name)), `M7: ${name} asks the server, not only the phone's dev flag`);
  check(/withinIpRateLimit\(IP_DEMO_KEY_LIMIT\)/.test(fnText(pf, "checkDemoKeyFn")), "M7: key guesses are limited per address");
}

/* ------------------------------------------------------------------ L1: error text ---- */
{
  const { dbError, DB_ERROR_MESSAGE, isUuid } = await import("../src/lib/duel/dbError");
  const quiet = console.error;
  console.error = () => {};
  const e = dbError({ message: 'invalid input syntax for type uuid: "x"', code: "22P02" }, "duel");
  console.error = quiet;
  check(e.message === DB_ERROR_MESSAGE && !/uuid|syntax/.test(e.message), "L1: a database error becomes a plain message");
  check(isUuid("123e4567-e89b-42d3-a456-426614174000") && !isUuid("x") && !isUuid(42), "L1: isUuid");
  for (const file of ["duel.functions.ts", "roomSettings.server.ts", "playerLook.server.ts", "reveal.server.ts", "asyncRoom.server.ts", "challenge.server.ts"])
    check(!/throw new Error\(\w+\.message\)/.test(src(`src/lib/duel/${file}`)), `L1: ${file} never throws a database error's own text`);
  const duel = src("src/lib/duel/duel.functions.ts");
  const getRoom = duel.slice(duel.indexOf("async function getRoom"), duel.indexOf("async function getPlayers"));
  check(getRoom.indexOf("isUuid(roomId)") > 0 && getRoom.indexOf("isUuid(roomId)") < getRoom.indexOf(".from("), "L1: getRoom refuses an id that isn't a uuid before querying");
}

/* ------------------------------------------------------------------ L3: chat limits ---- */
{
  const rl = await import("../src/lib/duel/rateLimit.server");
  const { MESSAGE_MIN_GAP_MS, MESSAGE_MAX_PER_PLAYER } = await import("../src/lib/duel/chatConstants");
  const gap = rl.chatGapLimit(MESSAGE_MIN_GAP_MS);
  const cap = rl.chatRoomLimit("room-1", MESSAGE_MAX_PER_PLAYER);
  // A counter as take_rate_limit keeps it (atomic per user and bucket): ten parallel sends, one through the gap.
  const hits = new Map<string, number>();
  const counter = { rpc: async (_: string, a: { p_user_id: string; p_bucket: string; p_max: number }) => {
    const key = `${a.p_user_id}:${a.p_bucket}`;
    const n = (hits.get(key) ?? 0) + 1;
    hits.set(key, n);
    return { data: n <= a.p_max, error: null };
  } };
  const through = (await Promise.all(Array.from({ length: 10 }, () => rl.withinRateLimit(counter, "u", gap)))).filter(Boolean).length;
  check(gap.max === 1 && gap.windowSeconds === 2 && through === 1, `L3: one of ten parallel sends passes the gap (${through})`);
  check(cap.max === MESSAGE_MAX_PER_PLAYER && cap.bucket.includes("room-1") && rl.chatRoomLimit("room-2", 30).bucket !== cap.bucket, "L3: the per-room cap is its own bucket per room");
  const chat = src("src/lib/duel/chat.functions.ts");
  const at = chat.indexOf("chatGapLimit(MESSAGE_MIN_GAP_MS)");
  check(at > 0 && chat.indexOf("chatRoomLimit(data.roomId, MESSAGE_MAX_PER_PLAYER)") > at && at < chat.indexOf('from("room_messages").insert'), "L3: both buckets are taken before the message is stored");
}

/* ------------------------------------------------------------------ L4: beta events ---- */
{
  const { shareEventRow } = await import("../src/lib/duel/betaRecord.server");
  const row = shareEventRow("u", { event: "share_tap", method: "native", duelId: "123e4567-e89b-42d3-a456-426614174000", roomCode: "ABCD", place: 14, players: 16, rounds: 6 });
  check(row?.place === 14 && row.players === 16, "L4: a 16-player room's share keeps its place and count");
  check(shareEventRow("u", { event: "share_tap", place: 17, players: 17 })?.place === null, "L4: past 16 in a room is still refused");
  check(/agreedAt: new Date\(\)\.toISOString\(\)/.test(src("src/lib/beta/terms.functions.ts")), "L4: the terms date stored is the server's");
  check(/BETA_EVENT_LIMIT/.test(src("src/lib/beta/terms.functions.ts")) && /BETA_EVENT_LIMIT/.test(src("src/lib/duel/share.functions.ts")), "L4: share and terms events are rate limited");
}

/* ------------------------------------------------------------------ L7: seeds in logs ---- */
{
  const { readdirSync, statSync } = await import("node:fs");
  const walk = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
      const p = `${dir}/${name}`;
      return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(name) ? [p] : [];
    });
  const leaks = walk("src/lib/duel").filter((f) => /console\.(log|info|warn|error)\([^\n]*seed=\$\{/.test(src(f)));
  check(leaks.length === 0, `L7: no log line prints a room or daily seed (${leaks.join(", ") || "none"})`);
}

/* ------------------------------------------------------------------ L8: the seal key ---- */
{
  const seal = await import("../src/lib/duel/practiceSeal.server");
  const old = await seal.seal({ type: "tower", solution: [1] });
  process.env["PRACTICE_SEAL_KEY"] = "a-dedicated-practice-key-for-the-check-0123456789";
  const fresh = await seal.seal({ type: "tower", solution: [2] });
  check(fresh.startsWith("k2.") && !old.startsWith("k2."), "L8: with PRACTICE_SEAL_KEY a token carries the key id k2");
  check(JSON.stringify(await seal.unsealRaw(fresh)) === JSON.stringify({ type: "tower", solution: [2] }), "L8: a k2 token opens with the dedicated key");
  check(JSON.stringify(await seal.unsealRaw(old)) === JSON.stringify({ type: "tower", solution: [1] }), "L8: a token from before (no key id) still opens with the old key");
  process.env["PRACTICE_SEAL_KEY"] = "another-key-entirely-0123456789-abcdefghijklmnop";
  let refused = false;
  try {
    await seal.unsealRaw(fresh);
  } catch {
    refused = true;
  }
  delete process.env["PRACTICE_SEAL_KEY"];
  let refusedNoKey = false;
  try {
    await seal.unsealRaw(fresh);
  } catch {
    refusedNoKey = true;
  }
  check(refused && refusedNoKey, "L8: a k2 token never opens with another key or with none");
}

/* ------------------------------------------------------------------ L13: the answer cap ---- */
{
  const { standardParts } = await import("../src/lib/duel/generate.server");
  const { answerCapFor } = await import("../src/lib/duel/grade");
  const { TIMELINE_MARK } = await import("../src/lib/duel/standard/timeline");
  const puzzle = { type: "sudoku" } as never;
  const cap = answerCapFor(puzzle);
  const long = "1".repeat(cap * 50);
  const parts = standardParts(puzzle, long);
  check(cap === 4000 && parts.body.length === cap && parts.timeline === null, `L13: a standard puzzle's body is cut to its cap (${parts.body.length} of ${long.length})`);
  const timed = standardParts(puzzle, `123${TIMELINE_MARK}[[0,"123"]]`);
  check(timed.body === "123" && timed.timeline === '[[0,"123"]]', "L13: a short answer and its timeline split exactly as before");
  check(answerCapFor({ type: "breaker" } as never) === 400_000, "L13: arcade run logs keep their 400,000 cap");
}

console.log(`security-fixes-check: ${passes} passed, ${failures.length} failed`);
if (failures.length) {
  console.log(`FAIL: ${failures.length} problems`);
  for (const f of failures) console.log(`  - ${f}`);
  process.exit(1);
}
console.log("PASS: the before-the-move security fixes hold");
process.exit(0);
