/**
 * Raw tap logs for Flash (reaction), Bang On (stopwatch) and Ascend (numhunt).
 *
 * Puzzles stamped `tapRev: 1` are answered with every tap the player made, timed
 * on the round clock (ms since the puzzle phase started, `serverNow()` on the
 * phone), never with the phone's own summary. The phone and the server walk the
 * same log through the replays below: the phone to show feedback, the server to
 * work out every reaction, distance, false start, wrong tap and finish time
 * against the stored puzzle. Unstamped rounds keep their summary answers and
 * original grading (grade.ts).
 *
 * The server repairs a bad log rather than rejecting it, and counts every
 * repair, as the arcade engine does: taps out of order are moved up to the tap
 * before; taps before the round, after it, after the server received the log
 * (plus the 1.5 s network allowance), beyond the cap, or unreadable are dropped;
 * an Ascend tap on a number not on the board is kept as a wrong tap. Which taps
 * were made, and when, remain the phone's; what they earn is the server's.
 */
import { watchLifeMs, watchStop } from "./stopWatch";
import {
  NUMHUNT_MOVE_MS,
  REACTION_DECOY_MS,
  REACTION_FLASH_MS,
  REACTION_MISS_MS,
  STOPWATCH_GAP_MS,
  STOPWATCH_LEAD_IN_MS,
  type HuntSpot,
  type NumberHuntPuzzleData,
  type ReactionPuzzleData,
  type StopWatchSpec,
} from "./types";

/** The tap-log answer format and its rules (Flash's 100 ms floor, Bang On's fixed watch schedule). */
export const TAP_REV = 1;
/**
 * Flash and Bang On (13 Oct 2026): the same tap logs as TAP_REV, scored with the
 * careless-play costs (scoring.ts: Flash's 11 per false start from the third,
 * Bang On's steeper fall above 200 ms). Ascend stays on TAP_REV.
 */
export const TAP_REV_CARELESS = 2;
/**
 * Flash and Bang On (14 Oct 2026, Speed tuning): the same tap logs and replays.
 * Flash deals gold-like decoys and scores on a steeper curve (scoring.ts
 * FLASH_REV3_CURVE); Bang On's watches add blind spots, longer sweeps and
 * diagonal faces, and full marks need ≤ 5 ms (STOPWATCH_REV3_CURVE). Ascend
 * stays on TAP_REV.
 */
export const TAP_REV_SPEED_TUNING = 3;
/**
 * Flash and Bang On (scoring report batch 2, 20 Oct 2026, docs/scoring-targets.md): the same tap logs and
 * replays, scored on one curve each (scoring.ts FLASH_REV4_CURVE, STOPWATCH_REV4_CURVE; their rev-2 knots row
 * is the identity, puzzleScoreRev2.ts). Flash stops crediting a gold reaction when the player also tapped the
 * decoy shown just before it (replayFlash's `voided`), so tapping on every colour earns nothing. Ascend stays on
 * TAP_REV.
 */
export const TAP_REV_ONE_CURVE = 4;
/**
 * Depth to 200 (25 Oct 2026, docs/depth/d3-speed-attention.md): the same tap logs and replays, scored to 200 by
 * the game's depth grader (src/lib/duel/depth/): Flash's stretched curve and steady-hand bonus (depth/flash.ts),
 * Bang On's dead-centre line and zone streak on tapRev 4's curve (depth/bangOn.ts), Ascend's flow streak on its
 * rev-3 finish (depth/ascend.ts). Every tapRev 4 rule (Flash's decoy cut) carries on.
 */
export const TAP_REV_DEPTH = 5;

let preDepthPin = false;
/**
 * Checks written for the stamps rooms dealt before Depth to 200 (Flash and Bang On tapRev 4, Ascend tapRev 1) pin
 * new puzzles to them, so they keep proving what they were written for; the depth checks prove tapRev 5. Never
 * called by app code.
 */
export function pinPreDepthTapRev(on: boolean): void {
  preDepthPin = on;
}
/** The tapRev new puzzles of a tap-log game are dealt. */
export function dealtTapRev(type: "reaction" | "stopwatch" | "numhunt"): number {
  if (!preDepthPin) return TAP_REV_DEPTH;
  return type === "numhunt" ? TAP_REV : TAP_REV_ONE_CURVE;
}
/** Every tap-log answer starts with this, so a summary answer is never misread as taps. */
export const TAP_LOG_PREFIX = "log1:";
/** The most taps the server reads; the phone stops logging here. */
export const TAP_LOG_MAX = 1_000;
/** Answer length the server accepts for a tap log. */
export const TAP_LOG_ANSWER_CAP = 16_000;
/** Flash: a tap this soon after a gold flash appears is too fast to be a reaction. */
export const FLASH_FASTEST_MS = 100;
/** Flash: false starts closer together than this count once. */
export const FLASH_FALSE_START_GAP_MS = 250;

/** The stored tap revision (0 = unstamped). */
export function tapRevOf(puzzle: unknown): number {
  const rev = (puzzle as { tapRev?: number } | null)?.tapRev;
  return rev === TAP_REV || rev === TAP_REV_CARELESS || rev === TAP_REV_SPEED_TUNING || rev === TAP_REV_ONE_CURVE || rev === TAP_REV_DEPTH ? rev : 0;
}

export function usesTapLog(puzzle: unknown): boolean {
  return tapRevOf(puzzle) !== 0;
}

/** Ascend: one tap, by the number on the disc. */
export interface NumberTap {
  n: number;
  t: number;
}

/** What the server did to a log before replaying it (stored on the round). */
export interface TapLogDiag {
  /** Taps in the answer. */
  received: number;
  /** Taps kept but moved (out of order). */
  clamped: number;
  /** Taps that could not be replayed. */
  dropped: number;
  /** The first repair's reason, if any. */
  first: string | null;
}

export function encodeTapTimes(times: readonly number[]): string {
  return TAP_LOG_PREFIX + times.map((t) => Math.round(t)).join(",");
}

export function encodeNumberTaps(taps: readonly NumberTap[]): string {
  return TAP_LOG_PREFIX + taps.map((tap) => `${tap.n}@${Math.round(tap.t)}`).join(",");
}

const INT = /^-?\d+$/;

function readLog(
  answer: string,
  latestMs: number,
  parse: (item: string) => { t: number; ok: boolean; reason?: string },
): { kept: { item: string; t: number }[]; diag: TapLogDiag } {
  const diag: TapLogDiag = { received: 0, clamped: 0, dropped: 0, first: null };
  const issue = (reason: string) => {
    if (!diag.first) diag.first = reason;
  };
  const raw = typeof answer === "string" ? answer : "";
  if (!raw.startsWith(TAP_LOG_PREFIX)) {
    if (raw.length > 0) {
      diag.received = 1;
      diag.dropped = 1;
      issue("not a tap log");
    }
    return { kept: [], diag };
  }
  const body = raw.slice(TAP_LOG_PREFIX.length);
  const items = body.length ? body.split(",") : [];
  diag.received = items.length;
  const kept: { item: string; t: number }[] = [];
  let previous = 0;
  items.forEach((item, index) => {
    if (index >= TAP_LOG_MAX) {
      diag.dropped += 1;
      issue("beyond the tap cap");
      return;
    }
    const parsed = parse(item);
    if (!parsed.ok) {
      diag.dropped += 1;
      issue(parsed.reason ?? "unreadable tap");
      return;
    }
    let t = parsed.t;
    if (t < 0) {
      diag.dropped += 1;
      issue("tap before the round");
      return;
    }
    if (t > latestMs) {
      diag.dropped += 1;
      issue("tap after the round");
      return;
    }
    if (t < previous) {
      t = previous;
      diag.clamped += 1;
      issue("tap out of order");
    }
    previous = t;
    kept.push({ item, t });
  });
  return { kept, diag };
}

/** Flash and Bang On logs: "log1:t,t,t". `latestMs` is the last round-clock ms a tap may carry. */
export function decodeTapTimes(
  answer: string,
  latestMs: number,
): { times: number[]; diag: TapLogDiag } {
  const { kept, diag } = readLog(answer, latestMs, (item) =>
    INT.test(item) ? { t: Number(item), ok: true } : { t: 0, ok: false },
  );
  return { times: kept.map((k) => k.t), diag };
}

/** The layout on screen at round-clock `t`: the seeded positions move every 15 s. */
export function ascendLayoutAt(puzzle: NumberHuntPuzzleData, t: number): HuntSpot[] {
  const index = Math.min(3, Math.floor(Math.max(0, t) / NUMHUNT_MOVE_MS));
  return puzzle.layouts?.[index] ?? puzzle.spots;
}

/** Ascend logs: "log1:n@t,n@t". Each number is checked against the layout shown at its time. */
export function decodeNumberTaps(
  answer: string,
  latestMs: number,
  puzzle: NumberHuntPuzzleData,
): { taps: NumberTap[]; diag: TapLogDiag } {
  const { kept, diag } = readLog(answer, latestMs, (item) => {
    const [nRaw = "", tRaw = ""] = item.split("@");
    if (!INT.test(nRaw) || !INT.test(tRaw)) return { t: 0, ok: false };
    return { t: Number(tRaw), ok: true };
  });
  const taps: NumberTap[] = [];
  for (const { item, t } of kept) {
    const n = Number(item.split("@")[0]);
    // An honest phone only sends numbers it showed. Any other is kept, and
    // replays as a wrong tap, so relabelling a wrong tap cannot hide it.
    if (!ascendLayoutAt(puzzle, t).some((spot) => spot.n === n)) {
      diag.clamped += 1;
      if (!diag.first) diag.first = "number not on the board";
    }
    taps.push({ n, t });
  }
  return { taps, diag };
}

/* -------------------------------------------------------------------------- */
/*  Flash                                                                      */
/* -------------------------------------------------------------------------- */

export type FlashOutcome = "hit" | "false" | "ignored";

export interface FlashReplay {
  /**
   * Reaction per gold flash in ms (a miss records REACTION_MISS_MS); null while still to come. tapRev 4: after
   * the decoy cut (FLASH_DECOY_FREE_SHARE), the reaction each flash is credited with.
   */
  times: (number | null)[];
  /** Flashes that closed without a tap. */
  missed: boolean[];
  falseStarts: number;
  /** What each tap did, in log order. */
  outcomes: FlashOutcome[];
  /** Every flash has been tapped or missed by `upTo`. */
  done: boolean;
  /** tapRev 4: decoys shown by `upTo`, and how many of them were tapped (a tap that was not a hit, while it showed). */
  decoysShown: number;
  decoysTapped: number;
  /** tapRev 4: the share (0–1) of the way from each reaction to a miss it is credited with (0 = as tapped). */
  decoyCut: number;
}

/**
 * Flash tapRev 4: tapping up to this share of the decoys costs only their false starts; beyond it every reaction
 * is credited slower, evenly towards a miss, all the way at every decoy tapped (tapping on every colour earns nothing).
 */
export const FLASH_DECOY_FREE_SHARE_PCT = 50;

/** tapRev 4: the decoy cut (0–1) for `tapped` of `shown` decoys. */
export function flashDecoyCut(tapped: number, shown: number): number {
  if (!(shown > 0)) return 0;
  const sharePct = (100 * Math.max(0, Math.min(tapped, shown))) / shown;
  return Math.max(0, Math.min(1, (sharePct - FLASH_DECOY_FREE_SHARE_PCT) / (100 - FLASH_DECOY_FREE_SHARE_PCT)));
}

/**
 * Walks a Flash log. A tap counts for a gold flash from FLASH_FASTEST_MS after
 * it appears until its 1.5 s window closes; any other tap (dark screen, decoy,
 * too fast, a second tap on gold) is a false start, but false starts closer than
 * 250 ms together count once. A flash nobody tapped is a miss. Taps after the
 * last flash is settled are ignored.
 */
export function replayFlash(
  puzzle: Pick<ReactionPuzzleData, "flashes"> & Partial<Pick<ReactionPuzzleData, "decoys" | "tapRev">>,
  times: readonly number[],
  upTo = Number.POSITIVE_INFINITY,
): FlashReplay {
  const flashes = puzzle.flashes;
  const result: (number | null)[] = flashes.map(() => null);
  const missed = flashes.map(() => false);
  const outcomes: FlashOutcome[] = [];
  let falseStarts = 0;
  let lastFalse = -1_000;
  const settleMisses = (now: number) => {
    flashes.forEach((f, i) => {
      if (result[i] === null && now >= f + REACTION_FLASH_MS) {
        result[i] = REACTION_MISS_MS;
        missed[i] = true;
      }
    });
  };
  for (const t of times) {
    if (t > upTo) break;
    settleMisses(t);
    if (result.every((v) => v !== null)) {
      outcomes.push("ignored");
      continue;
    }
    const index = flashes.findIndex(
      (f, i) => result[i] === null && t >= f + FLASH_FASTEST_MS && t < f + REACTION_FLASH_MS,
    );
    if (index >= 0) {
      result[index] = Math.max(1, t - flashes[index]!);
      outcomes.push("hit");
      continue;
    }
    if (t < 0 || t - lastFalse < FLASH_FALSE_START_GAP_MS) {
      outcomes.push("ignored");
      continue;
    }
    lastFalse = t;
    falseStarts += 1;
    outcomes.push("false");
  }
  if (Number.isFinite(upTo)) settleMisses(upTo);
  // tapRev 4: the decoys tapped (a tap that was not a hit, while the decoy showed) and the credit cut they bring.
  const decoys = tapRevOf(puzzle) >= TAP_REV_ONE_CURVE ? (puzzle.decoys ?? []) : [];
  const nonHits = times.filter((t, i) => t <= upTo && outcomes[i] !== "hit");
  const shown = decoys.filter((d) => d.at <= upTo);
  const decoysTapped = shown.filter((d) => nonHits.some((t) => t >= d.at && t < d.at + REACTION_DECOY_MS)).length;
  const decoyCut = flashDecoyCut(decoysTapped, shown.length);
  const credited = decoyCut > 0
    ? result.map((v) => (v === null ? null : Math.min(REACTION_MISS_MS, v + Math.round((REACTION_MISS_MS - v) * decoyCut))))
    : result;
  return { times: credited, missed, falseStarts, outcomes, done: result.every((v) => v !== null), decoysShown: shown.length, decoysTapped, decoyCut };
}

/* -------------------------------------------------------------------------- */
/*  Bang On                                                                    */
/* -------------------------------------------------------------------------- */

export interface WatchResult {
  /** Round-clock ms the watch started. */
  start: number;
  /** Round-clock ms it was stopped, or ran out of passes. */
  at: number;
  /** Ms of marker travel from the target line, capped at 500; null when missed. */
  distance: number | null;
  signed: number | null;
}

export interface BangOnReplay {
  /** Watches settled by `upTo`, in order. */
  results: WatchResult[];
  /** The watch on screen at `upTo`: its index and start (it may not have started yet). */
  current: { index: number; start: number } | null;
}

/**
 * Walks a Bang On log on the fixed schedule: watch 1 starts 800 ms in; each
 * later watch starts 600 ms after the one before was stopped or ran out. The
 * first tap while a watch is live stops it; taps in the lead-in, between
 * watches or after the last are ignored.
 */
export function replayBangOn(
  watches: readonly StopWatchSpec[],
  times: readonly number[],
  upTo = Number.POSITIVE_INFINITY,
): BangOnReplay {
  const results: WatchResult[] = [];
  let start = STOPWATCH_LEAD_IN_MS;
  let cursor = 0;
  for (let index = 0; index < watches.length; index++) {
    const spec = watches[index]!;
    const end = start + watchLifeMs(spec);
    while (cursor < times.length && times[cursor]! < start) cursor += 1;
    const tap = times[cursor];
    if (tap !== undefined && tap < end && tap <= upTo) {
      cursor += 1;
      const stop = watchStop(spec, tap - start);
      results.push({ start, at: tap, distance: stop.distance, signed: stop.signed });
    } else if (end <= upTo) {
      results.push({ start, at: end, distance: null, signed: null });
    } else {
      return { results, current: { index, start } };
    }
    if (index + 1 < watches.length) start = results[index]!.at + STOPWATCH_GAP_MS;
  }
  return { results, current: null };
}

/* -------------------------------------------------------------------------- */
/*  Ascend                                                                     */
/* -------------------------------------------------------------------------- */

export type AscendOutcome = "correct" | "wrong" | "ignored";

export interface AscendReplay {
  /** Numbers cleared in order. */
  reached: number;
  /** Wrong taps (a number that is not the next one). */
  errors: number;
  /** Round-clock ms of the tap that cleared the last number, if it was cleared. */
  finishedAt: number | null;
  outcomes: AscendOutcome[];
}

/**
 * Walks an Ascend log against the layout on screen at each tap. The next
 * number in order clears it; a later number (or one not on the board) is a
 * wrong tap; a number already cleared, or any tap after the last number, is ignored.
 */
export function replayAscend(
  puzzle: NumberHuntPuzzleData,
  taps: readonly NumberTap[],
): AscendReplay {
  const total = puzzle.spots.length;
  let reached = 0;
  let errors = 0;
  let finishedAt: number | null = null;
  const outcomes: AscendOutcome[] = [];
  for (const tap of taps) {
    const index = ascendLayoutAt(puzzle, tap.t).findIndex((spot) => spot.n === tap.n);
    if (reached >= total || (index >= 0 && index < reached)) {
      outcomes.push("ignored");
      continue;
    }
    if (index !== reached) {
      errors += 1;
      outcomes.push("wrong");
      continue;
    }
    reached += 1;
    outcomes.push("correct");
    if (reached === total) finishedAt = tap.t;
  }
  return { reached, errors, finishedAt, outcomes };
}
