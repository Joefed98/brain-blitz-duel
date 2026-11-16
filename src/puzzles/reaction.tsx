import { speedLevelLine } from "@/lib/levels/speedLevels";
import { puzzleLevel } from "@/lib/levels/levels";
import { gameDisplayName } from "@/lib/duel/gameNames";
import { puzzleReject } from "@/lib/fx/puzzleReject";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { speedArtCss } from "@/lib/fx/speedArt";
import { gameFx } from "@/lib/fx/kit";
import { FxCountUp } from "@/components/fx/GameFx";
import { playCueSlot } from "@/lib/sound";

import { serverNow } from "@/lib/duel/clock";
import { pick, randInt, shuffled } from "@/lib/duel/random";
import {
  FLASH_FASTEST_MS,
  TAP_LOG_MAX,
  TAP_LOG_PREFIX,
  dealtTapRev,
  TAP_REV_ONE_CURVE,
  TAP_REV_PER_ITEM,
  tapRevOf,
  decodeTapTimes,
  encodeTapTimes,
  replayFlash,
  usesTapLog,
} from "@/lib/duel/tapLog";
import {
  REACTION_DECOY_MS,
  REACTION_GOLD_LIKE_DECOYS,
  REACTION_PLAIN_DECOYS,
  REACTION_MAX_FLASHES,
  REACTION_MIN_FLASHES,
  REACTION_FLASH_MS,
  flashWindowMs,
  REACTION_MISS_MS,
  REACTION_ROUND_MS,
  type ReactionDecoyColour,
  type ReactionPuzzleData,
} from "@/lib/duel/types";

import { fireFlashGoldPulse, flashEarnsGoldPulse, localFlashScore } from "@/components/puzzles/reactionFx";
import { registerFxPreview } from "@/components/puzzles/speedFx";
import { FLASH_FALSE_START_COST } from "@/lib/duel/scoring";
import { knots } from "@/lib/duel/depth200";
import { FLASH_REV6_CURVE, FLASH_STEADY_LOOSE_MS, FLASH_STEADY_TIGHT_MS, flashSpread, usesFlashDepth } from "@/lib/duel/depth/flash";
import { roundMaxFor } from "@/lib/duel/roundMax";

import { RevealBars, RevealCaption, RevealNumbers, RevealPanel } from "@/components/puzzles/SpeedRevealKit";
import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";
import type { FlashLevel } from "@/lib/levels/speedLevels";

const DECOY_COLOURS = REACTION_PLAIN_DECOYS;

/** A hit faster than this counts towards the fast-hits combo (display and sound only). */
export const FLASH_FAST_MS = 350;
const arenaEl = () => (typeof document === "undefined" ? null : document.querySelector(".flash-arena"));

/** The Speed overhaul's Blender art (speedArt.ts), one style object for every render. */
const FLASH_ART_STYLE = {
  "--flash-wait-art": speedArtCss("flash-wait"),
  "--flash-gold-art": speedArtCss("flash-gold"),
  "--flash-frame-art": speedArtCss("flash-frame"),
} as CSSProperties;

/**
 * tapRev 3: every gold-like decoy (amber, border, word, half) appears at least
 * once; the rest are a seeded mix of plain and gold-like; the first decoy of the
 * round is always a plain colour.
 */
function dealDecoyKinds(count: number, level?: FlashLevel): ReactionDecoyColour[] {
  // Levels (the Speed overhaul, stage 3): Easy deals plain colours only; Hard weights the gold-like kinds up.
  if (level && level.goldLike <= 0) return Array.from({ length: count }, () => pick(REACTION_PLAIN_DECOYS));
  const kinds: ReactionDecoyColour[] = [...REACTION_GOLD_LIKE_DECOYS].slice(0, Math.max(0, count - 1));
  const goldLikePct = level ? Math.round(level.goldLike * 100) : 50;
  while (kinds.length < count - 1)
    kinds.push(level ? (randInt(1, 100) <= goldLikePct ? pick(REACTION_GOLD_LIKE_DECOYS) : pick(REACTION_PLAIN_DECOYS)) : randInt(0, 1) === 0 ? pick(REACTION_PLAIN_DECOYS) : pick(REACTION_GOLD_LIKE_DECOYS));
  return count > 0 ? [pick(REACTION_PLAIN_DECOYS), ...shuffled(kinds)] : [];
}

/**
 * 5–8 gold flashes, each preceded by proportionally spaced seeded decoys. At a level other than Normal (the Speed
 * overhaul, stage 3; levels/speedLevels.ts) the level's flash and decoy counts and decoy kinds, decoys packed closer so
 * they fit, and on Expert the gold's shorter window stamped as `flashMs`. Normal (no level) deals exactly as before.
 */
export function buildReaction(level?: FlashLevel): ReactionPuzzleData {
  const flashCount = level ? randInt(level.flashes[0], level.flashes[1]) : randInt(REACTION_MIN_FLASHES, REACTION_MAX_FLASHES);
  const windowMs = level?.flashMs ?? REACTION_FLASH_MS;
  let flashes: number[] = [];
  let decoys: ReactionPuzzleData["decoys"] = [];
  for (let attempt = 0; attempt < 1_000; attempt++) {
    const list = [randInt(4_000, 7_000)];
    while (list.length < flashCount) list.push(list[list.length - 1]! + randInt(5_000, 8_000));
    if (list[list.length - 1]! + windowMs > REACTION_ROUND_MS - 500) continue;

    // Begin at two per flash, then vary to a seeded total of 8–12.
    const counts = Array.from({ length: flashCount }, () => (level ? randInt(level.decoys[0], level.decoys[1]) : randInt(1, 3)));

    const proposed: ReactionPuzzleData["decoys"] = [];
    let valid = true;
    for (let flashIndex = 0; flashIndex < list.length; flashIndex++) {
      const segmentStart = flashIndex === 0 ? 0 : list[flashIndex - 1]! + windowMs;
      let cursor = list[flashIndex]! - (level ? randInt(800, 2_000) : randInt(1_000, 5_000));
      const backwards: ReactionPuzzleData["decoys"] = [];
      for (let n = 0; n < counts[flashIndex]!; n++) {
        if (cursor < segmentStart + 250) {
          valid = false;
          break;
        }
        backwards.push({ at: cursor, color: pick(DECOY_COLOURS) });
        cursor -= level ? randInt(900, 1_600) : randInt(1_500, 4_000);
      }
      proposed.push(...backwards.reverse());
      if (!valid) break;
    }
    if (!valid) continue;
    flashes = list;
    decoys = proposed.sort((a, b) => a.at - b.at);
    break;
  }
  if (flashes.length === 0) {
    flashes = Array.from({ length: flashCount }, (_, index) => 6_000 + index * 7_000);
    decoys = flashes.flatMap((flash, index) => [
      { at: flash - 4_500, color: DECOY_COLOURS[index % 3]! },
      { at: flash - 2_000, color: DECOY_COLOURS[(index + 1) % 3]! },
    ].slice(level ? 2 - Math.min(2, level.decoys[0]) : 0));
  }
  const kinds = dealDecoyKinds(decoys.length, level);
  decoys = decoys.map((decoy, index) => ({ at: decoy.at, color: kinds[index]! }));
  return { type: "reaction", flashes, decoys, tapRev: dealtTapRev("reaction"), ...(level && level.flashMs !== REACTION_FLASH_MS ? { flashMs: level.flashMs } : {}) };
}

export function reactionAverage(times: number[], falseStarts: number, flashCount = times.length): number {
  const count = Math.max(1, flashCount);
  void falseStarts;
  const filled = Array.from({ length: count }, (_, i) => Math.min(REACTION_MISS_MS, Math.max(1, times[i] ?? REACTION_MISS_MS)));
  return Math.round(filled.reduce((a, b) => a + b, 0) / count);
}

function encode(times: (number | null)[], falseStarts: number): string {
  return `${times.map((t) => t ?? REACTION_MISS_MS).join(",")}|${falseStarts}`;
}

function parseAnswer(answer: string | null): { times: number[]; falseStarts: number } {
  const [timesPart = "", falsePart = "0"] = (answer ?? "").split("|");
  const times = timesPart
    .split(",")
    .map((v) => Number.parseInt(v, 10))
    .filter((v) => Number.isFinite(v));
  const falseStarts = Number.parseInt(falsePart, 10);
  return { times, falseStarts: Number.isFinite(falseStarts) ? falseStarts : 0 };
}

function IntroExample() {
  return (
    <div className="flex flex-col items-center gap-4">
      <p className="text-center text-sm text-muted-foreground">
        The screen stays dark. It turns fully gold five to eight times – tap the instant it does.
      </p>
      <div className="flex items-center gap-2">
        <span className="flex h-16 w-20 items-center justify-center rounded-xl border border-border bg-card font-mono text-xs text-muted-foreground">
          Wait…
        </span>
        <span className="flash-decoy-amber flex h-16 w-20 items-center justify-center rounded-xl font-display text-xs font-bold text-primary-foreground">
          Don’t tap
        </span>
        <span className="flex h-16 w-20 items-center justify-center rounded-xl bg-primary font-display text-sm font-bold text-primary-foreground">
          Gold
        </span>
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Traps: teal, red or blue, light orange, a gold border, the word GOLD, half the screen gold. Tapping a trap, a
        dark screen, or within {FLASH_FASTEST_MS} ms of the gold is a false start: −8 each for the first two, −11 each
        after that. Score: {roundMaxFor("reaction")} at {FLASH_REV6_CURVE[0][0]} ms average with a steady hand (every reaction
        close together), {knots(FLASH_REV6_CURVE, 150)} at 150 ms, {knots(FLASH_REV6_CURVE, 200)} at 200 ms; a missed flash counts 1,200 ms.
      </p>
    </div>
  );
}

/** Rounds stored before tap logs (no `tapRev`): the phone's own per-flash summary. */
function LegacyStage({ puzzle, phaseStartedAt, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const flashes = puzzle.type === "reaction" ? puzzle.flashes : [];
  const decoys = puzzle.type === "reaction" ? puzzle.decoys : [];
  const key = `${phaseStartedAt}:${flashes.join(",")}`;
  const [times, setTimes] = useState<(number | null)[]>(() => flashes.map(() => null));
  const [falseStarts, setFalseStarts] = useState(0);
  const [lastShown, setLastShown] = useState<{ text: string; until: number; bad: boolean } | null>(null);
  const [t, setT] = useState(() => serverNow() - phaseStartedAt);
  const submitted = useRef("");
  const lastFalseAt = useRef(-1_000);

  useEffect(() => {
    setTimes(flashes.map(() => null));
    setFalseStarts(0);
    setLastShown(null);
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps

  // Frame-accurate local clock so the flash appears the moment it starts.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      setT(serverNow() - phaseStartedAt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phaseStartedAt]);

  // A gold flash with no tap in 1.5 s records the miss value.
  useEffect(() => {
    const missed = flashes.findIndex((f, i) => times[i] === null && t >= f + flashWindowMs(puzzle));
    if (missed < 0) return;
    setTimes((prev) => {
      if (prev[missed] !== null) return prev;
      const next = [...prev];
      next[missed] = REACTION_MISS_MS;
      return next;
    });
    setLastShown({ text: "Missed", until: t + 900, bad: true });
  }, [t, times, flashes]);

  useEffect(() => {
    if (flashes.length) onDraftAnswer?.(encode(times, falseStarts));
  }, [times, falseStarts]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (flashes.length === 0 || locked || submitted.current === key) return;
    if (times.some((v) => v === null)) return;
    submitted.current = key;
    const values = times as number[];
    onSubmit(encode(values, falseStarts), { reactionAvgMs: reactionAverage(values, falseStarts, flashes.length) });
  }, [times, locked, key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (puzzle.type !== "reaction") return null;

  const liveIndex = flashes.findIndex((f, i) => times[i] === null && t >= f && t < f + flashWindowMs(puzzle));
  const decoy = decoys.find((d) => t >= d.at && t < d.at + REACTION_DECOY_MS) ?? null;
  const done = times.every((v) => v !== null);

  const handleTap = () => {
    if (locked || done) return;
    const stamp = serverNow() - phaseStartedAt;
    const index = flashes.findIndex((f, i) => times[i] === null && stamp >= f && stamp < f + flashWindowMs(puzzle));
    if (index >= 0) {
      const ms = Math.max(1, Math.round(stamp - flashes[index]!));
      setTimes((prev) => {
        if (prev[index] !== null) return prev;
        const next = [...prev];
        next[index] = ms;
        return next;
      });
      setLastShown({ text: `${ms} ms`, until: stamp + 1_000, bad: false });
      return;
    }
    if (stamp < 0 || stamp - lastFalseAt.current < 250) return;
    lastFalseAt.current = stamp;
    setFalseStarts((n) => n + 1);
    puzzleReject();
    setLastShown({ text: "False start", until: stamp + 900, bad: true });
  };

  return (
    <ReactionArena
      surface={surfaceFor(liveIndex, decoy)}
      falseStarts={falseStarts}
      lastShown={lastShown && t < lastShown.until ? lastShown : null}
      live={liveIndex >= 0}
      done={done}
      decoy={decoy !== null}
      decoyKind={decoy?.color ?? null}
      onTap={handleTap}
      inactive={locked || done}
      runKey={key}
      fxScore={done ? localFlashScore(times, falseStarts, flashes.length) : null}
      summary={flashes.length ? flashSummary(times) : ""}
    />
  );
}

/**
 * Polish batch S (display only): the one-line live summary over the screen, from the times the stage
 * already shows ("Best 241 ms"). Joe's phone notes (28 Oct 2026): it never shows how many flashes there are or
 * which one is next ("Flash 3 of 5" is gone), so the count can't be read off the screen. Misses are never a best.
 */
function flashSummary(times: readonly (number | null)[]): string {
  const hits = (times.filter((v) => v !== null) as number[]).filter((v) => v < REACTION_MISS_MS);
  return hits.length ? `Best ${Math.min(...hits)} ms` : "";
}

/**
 * Depth (tapRev 5): the same line, with the steady-hand spread in place of the best while it is still on
 * ("Steady 38 ms"): every flash so far hit, no false start, and the fastest to slowest within the loose spread.
 * Gold while it is within the tight one. Display only; the server works the bonus out itself. No flash count.
 */
function flashSteadyLine(times: readonly (number | null)[], falseStarts: number): { text: string; steady: "tight" | "loose" | null } {
  const settled = times.filter((v) => v !== null) as number[];
  const spread = settled.length >= 2 && falseStarts === 0 ? flashSpread(settled) : null;
  if (spread === null || spread > FLASH_STEADY_LOOSE_MS) return { text: flashSummary(times), steady: null };
  return { text: `Steady ${spread} ms`, steady: spread <= FLASH_STEADY_TIGHT_MS ? "tight" : "loose" };
}

function surfaceFor(liveIndex: number, decoy: { color: ReactionDecoyColour } | null): string {
  if (liveIndex >= 0) return "bg-primary";
  switch (decoy?.color) {
    case "teal":
      return "bg-opponent";
    case "red":
      return "bg-destructive";
    case "blue":
      return "bg-reaction-blue";
    case "amber":
      return "flash-decoy-amber";
    default:
      // No decoy, or a gold-like decoy drawn over the dark screen (border, word, half).
      return "bg-background";
  }
}

/** tapRev 3's gold-like decoys drawn over the dark screen (amber is a full-screen colour). */
function DecoyOverlay({ kind }: { kind: ReactionDecoyColour }) {
  if (kind === "border") return <span aria-hidden="true" data-flash-decoy="border" className="flash-decoy-border" />;
  if (kind === "half") return <span aria-hidden="true" data-flash-decoy="half" className="flash-decoy-half" />;
  if (kind === "word")
    return (
      <span aria-hidden="true" data-flash-decoy="word" className="flash-decoy-word relative font-display font-bold">
        GOLD
      </span>
    );
  return null;
}

function ReactionArena({
  surface,
  falseStarts,
  lastShown,
  live,
  done,
  decoy,
  decoyKind = null,
  onTap,
  inactive,
  runKey = "",
  fxScore = null,
  summary = "",
  steady = null,
}: {
  surface: string;
  falseStarts: number;
  lastShown: { text: string; bad: boolean; speed?: "gold" | "fast" | "slow" | undefined; combo?: number | undefined } | null;
  live: boolean;
  done: boolean;
  decoy: boolean;
  /** The decoy on screen (drawn by kind), or null. */
  decoyKind?: ReactionDecoyColour | null;
  onTap: () => void;
  inactive: boolean;
  /** Identifies the run, so the end-of-run effect plays once per run. */
  runKey?: string;
  /** The phone's local score once every flash is settled (read-only), else null. */
  fxScore?: number | null;
  /** Polish batch S: the live summary line ("Best 241 ms"; never the flash count). */
  summary?: string;
  /** Depth (tapRev 5): the steady hand still on, within the tight or the loose spread. */
  steady?: "tight" | "loose" | null;
}) {
  const [ripple, setRipple] = useState<{ x: number; y: number; id: number } | null>(null);
  const arenaRef = useRef<HTMLButtonElement | null>(null);
  const pulsed = useRef("");
  // End of run: a gold pulse from the centre when the local score reaches the threshold.
  useEffect(() => {
    if (fxScore === null || !flashEarnsGoldPulse(fxScore) || pulsed.current === runKey) return;
    pulsed.current = runKey;
    fireFlashGoldPulse(arenaRef.current);
  }, [fxScore, runKey]);
  useEffect(() => registerFxPreview("reaction", () => fireFlashGoldPulse(arenaRef.current)), []);
  const cue = live ? "gold" : decoy ? "decoy" : "idle";
  const overlay = !live && decoyKind && decoyKind !== "amber" && (REACTION_GOLD_LIKE_DECOYS as readonly string[]).includes(decoyKind) ? decoyKind : null;
  return (
    <div data-polish="reaction" data-stage-column="3" className="flex min-h-0 flex-1 flex-col gap-3">
      <div className="flex items-center justify-between gap-2 font-mono text-sm uppercase tracking-widest text-muted-foreground">
        <span data-flash-summary="" data-flash-steady={steady ?? undefined} className="flash-summary truncate">{summary}</span>
        {falseStarts > 0 && <span className="shrink-0 text-warn">{falseStarts} false</span>}
      </div>
      <button
        type="button"
        aria-label="Reaction area"
        onPointerDown={(event) => {
          const wasInactive = inactive;
          onTap();
          if (wasInactive) return;
          const rect = event.currentTarget.getBoundingClientRect();
          setRipple({ x: event.clientX - rect.left, y: event.clientY - rect.top, id: event.timeStamp });
        }}
        ref={arenaRef}
        data-flash-cue={cue}
        data-flash-decoy-kind={decoy && !live ? (decoyKind ?? undefined) : undefined}
        data-game-arena="tall" className={`flash-arena relative overflow-hidden flex min-h-64 w-full flex-1 items-center justify-center rounded-2xl border border-border ${surface}`}
        style={FLASH_ART_STYLE}
      >
        <span aria-hidden="true" className="flash-art" />
        {/* The Speed overhaul (15 Nov 2026): the polished walnut frame round the screen (display only). */}
        <span aria-hidden="true" className="flash-frame" />
        {overlay && !(overlay === "word" && lastShown) && <DecoyOverlay kind={overlay} />}
        {ripple && <span key={ripple.id} aria-hidden="true" className="reaction-tap-ripple" style={{ left: ripple.x, top: ripple.y }} onAnimationEnd={() => setRipple(null)} />}
        {live ? null : lastShown ? (
          <span
            key={lastShown.text + (lastShown.combo ?? 0)}
            data-flash-speed={lastShown.bad ? undefined : lastShown.speed}
            className={`flash-readout relative flex flex-col items-center font-mono text-4xl font-bold tabular-nums ${lastShown.bad ? "text-warn" : lastShown.speed === "slow" ? "text-foreground" : "text-primary"}`}
          >
            {lastShown.text}
            {lastShown.combo ? <span data-flash-combo={lastShown.combo} className="flash-combo font-display text-lg font-black uppercase tracking-widest">{lastShown.combo} fast in a row</span> : null}
          </span>
        ) : done ? (
          // The Speed overhaul (15 Nov 2026): a clear "Done" moment at the end (the flash count stays hidden till then).
          <span data-flash-done="" className="flash-done relative flex flex-col items-center gap-1">
            <span className="font-display text-5xl font-black uppercase tracking-widest text-primary">Done</span>
            <span className="text-base text-muted-foreground">All flashes done</span>
          </span>
        ) : decoy ? null : (
          <span className="flash-wait relative px-3 text-center font-display text-3xl font-bold uppercase tracking-widest text-muted-foreground">Wait for gold…</span>
        )}
      </button>
    </div>
  );
}

/**
 * Tap-log rounds (`tapRev`): every tap is logged on the round clock and sent
 * raw; what the phone shows comes from the same replay the server scores with.
 */
function LoggedStage({ puzzle, phaseStartedAt, locked, onSubmit, onDraftAnswer }: PuzzleStageProps) {
  const flashes = puzzle.type === "reaction" ? puzzle.flashes : [];
  const decoys = puzzle.type === "reaction" ? puzzle.decoys : [];
  const key = `${phaseStartedAt}:${flashes.join(",")}`;
  const taps = useRef<number[]>([]);
  const [logLength, setLogLength] = useState(0);
  const [lastShown, setLastShown] = useState<{ text: string; until: number; bad: boolean; speed?: "gold" | "fast" | "slow"; combo?: number } | null>(null);
  const [t, setT] = useState(() => serverNow() - phaseStartedAt);
  const submitted = useRef("");
  const shownMisses = useRef(0);
  const fastRun = useRef(0);

  useEffect(() => {
    taps.current = [];
    shownMisses.current = 0;
    setLogLength(0);
    setLastShown(null);
  }, [key]);

  // Frame-accurate local clock so the flash appears the moment it starts.
  useEffect(() => {
    let raf = 0;
    const frame = () => {
      setT(serverNow() - phaseStartedAt);
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phaseStartedAt]);

  const lastTap = taps.current[taps.current.length - 1] ?? 0;
  const replay = useMemo(
    () => replayFlash({ flashes }, taps.current, Math.max(t, lastTap)),
    [flashes, logLength, t, lastTap], // eslint-disable-line react-hooks/exhaustive-deps
  );
  const missedCount = replay.missed.filter(Boolean).length;

  // A gold flash with no tap in 1.5 s shows the miss.
  useEffect(() => {
    if (missedCount <= shownMisses.current) return;
    shownMisses.current = missedCount;
    setLastShown({ text: "Missed", until: t + 900, bad: true });
  }, [missedCount]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (flashes.length) onDraftAnswer?.(encodeTapTimes(taps.current));
  }, [logLength]); // eslint-disable-line react-hooks/exhaustive-deps

  // "Done": the last flash settled (the count is never shown before).
  const doneKey = useRef("");
  useEffect(() => {
    if (!replay.done || doneKey.current === key || flashes.length === 0) return;
    doneKey.current = key;
    playCueSlot("reaction.done");
    gameFx("win", document.querySelector("[data-flash-done]"), { silent: true, noHaptic: true });
  }, [replay.done, key, flashes.length]);

  useEffect(() => {
    if (flashes.length === 0 || locked || submitted.current === key || !replay.done) return;
    submitted.current = key;
    const values = replay.times as number[];
    onSubmit(encodeTapTimes(taps.current), { reactionAvgMs: reactionAverage(values, replay.falseStarts, flashes.length) });
  }, [replay.done, locked, key]); // eslint-disable-line react-hooks/exhaustive-deps

  if (puzzle.type !== "reaction") return null;

  const liveIndex = flashes.findIndex((f, i) => replay.times[i] === null && t >= f && t < f + flashWindowMs(puzzle));
  const decoy = decoys.find((d) => t >= d.at && t < d.at + REACTION_DECOY_MS) ?? null;
  const steadyLine = usesFlashDepth(puzzle) && flashes.length ? flashSteadyLine(replay.times, replay.falseStarts) : null;

  const handleTap = () => {
    if (locked || replay.done) return;
    const log = taps.current;
    // Whole ms on the round clock, never earlier than the tap before.
    const stamp = Math.max(Math.round(serverNow() - phaseStartedAt), log[log.length - 1] ?? 0);
    if (stamp < 0 || log.length >= TAP_LOG_MAX) return;
    // Nothing counts once every flash is tapped or missed.
    const before = replayFlash({ flashes }, log, stamp);
    if (before.done) return;
    const next = replayFlash({ flashes }, [...log, stamp], stamp);
    taps.current = [...log, stamp];
    setLogLength(taps.current.length);
    const outcome = next.outcomes[next.outcomes.length - 1];
    if (outcome === "hit") {
      const ms = next.times.find((v, i) => v !== null && before.times[i] === null) ?? 0;
      // The Speed overhaul (15 Nov 2026): a crisp snap on the tap itself (within the frame), the time popping up
      // coloured by speed, and three fast hits in a row a climbing combo.
      playCueSlot("reaction.hit");
      fastRun.current = ms < FLASH_FAST_MS ? fastRun.current + 1 : 0;
      if (fastRun.current >= 3) playCueSlot("reaction.combo", 1, Math.pow(2, (2 * Math.min(5, fastRun.current - 3)) / 12));
      setLastShown({ text: `${ms} ms`, until: stamp + 1_000, bad: false, speed: ms < 250 ? "gold" : ms < FLASH_FAST_MS ? "fast" : "slow", combo: fastRun.current >= 3 ? fastRun.current : 0 });
    } else if (outcome === "false") {
      fastRun.current = 0;
      // A tap on a decoy or the dark screen: a short "wrong" and the shake (no second sound).
      playCueSlot("reaction.wrong");
      gameFx("wrong", arenaEl(), { silent: true });
      setLastShown({ text: "False start", until: stamp + 900, bad: true });
    }
  };

  return (
    <ReactionArena
      surface={surfaceFor(liveIndex, decoy)}
      falseStarts={replay.falseStarts}
      lastShown={lastShown && t < lastShown.until ? lastShown : null}
      live={liveIndex >= 0}
      done={replay.done}
      decoy={decoy !== null}
      decoyKind={decoy?.color ?? null}
      onTap={handleTap}
      inactive={locked || replay.done}
      runKey={key}
      // The live replay shows each reaction as tapped; the end-of-run score uses the credited ones (tapRev 4's decoy cut).
      summary={steadyLine ? steadyLine.text : flashes.length ? flashSummary(replay.times) : ""}
      steady={steadyLine?.steady ?? null}
      fxScore={replay.done ? localFlashScore(replayFlash({ flashes, decoys, tapRev: puzzle.type === "reaction" ? (puzzle.tapRev ?? 0) : 0 }, taps.current, Math.max(t, lastTap)).times, replay.falseStarts, flashes.length, tapRevOf(puzzle)) : null}
    />
  );
}

function Stage(props: PuzzleStageProps) {
  return usesTapLog(props.puzzle) ? <LoggedStage {...props} /> : <LegacyStage {...props} />;
}

/** tapRev 2: the stored per-flash times, false starts and their cost (the server's figures). */
function storedFlash(extra: Record<string, unknown> | null | undefined) {
  const times = extra?.["times"];
  const falseStarts = extra?.["falseStarts"];
  const cost = extra?.["falseStartCost"];
  if (!Array.isArray(times) || typeof falseStarts !== "number" || typeof cost !== "number") return null;
  return { times: times.filter((v): v is number => typeof v === "number"), falseStarts, cost };
}

function storedFlashDepth(extra: Record<string, unknown> | null | undefined): { steady: number; spread: number | null } | null {
  const d = extra?.["depth"] as Record<string, unknown> | undefined;
  if (!d || typeof d["steady"] !== "number") return null;
  return { steady: d["steady"] as number, spread: typeof d["spread"] === "number" ? (d["spread"] as number) : null };
}

function Reveal({ puzzle, myAnswer, myReactionAvgMs, myExtra }: PuzzleRevealProps) {
  if (puzzle.type !== "reaction") return null;
  let times: number[];
  let falseStarts: number;
  const stored = storedFlash(myExtra);
  let cost: number;
  if (stored) {
    ({ times, falseStarts, cost } = stored);
  } else if (usesTapLog(puzzle)) {
    // The same replay the server scored; misses show as 1,200 ms.
    const replay = myAnswer?.startsWith(TAP_LOG_PREFIX)
      ? replayFlash(puzzle, decodeTapTimes(myAnswer, REACTION_ROUND_MS).times, REACTION_ROUND_MS)
      : null;
    times = replay ? replay.times.map((v) => v ?? REACTION_MISS_MS) : [];
    falseStarts = replay?.falseStarts ?? 0;
    cost = falseStarts * FLASH_FALSE_START_COST;
  } else {
    ({ times, falseStarts } = parseAnswer(myAnswer));
    cost = falseStarts * FLASH_FALSE_START_COST;
  }
  // tapRev 4: tapping more than half the decoys slows every credited reaction (tapLog.ts flashDecoyCut).
  const decoyReplay = tapRevOf(puzzle) >= TAP_REV_ONE_CURVE && myAnswer?.startsWith(TAP_LOG_PREFIX)
    ? replayFlash(puzzle, decodeTapTimes(myAnswer, REACTION_ROUND_MS).times, REACTION_ROUND_MS)
    : null;
  const storedAvg = usesTapLog(puzzle) ? myReactionAvgMs : null;
  // Depth (tapRev 5): the server's stored steady-hand figures (flash.server.ts).
  const depth = usesFlashDepth(puzzle) ? storedFlashDepth(myExtra) : null;
  const avg = storedAvg ?? (times.length ? reactionAverage(times, falseStarts, puzzle.flashes.length) : null);

  // The Speed overhaul (Joe, 15 Nov 2026; display only): the average big, then one bar per flash (taller is faster,
  // gold under 250 ms, red a miss) and the figures that explain the score; short notes only where they apply.
  const hits = times.filter((ms) => ms < REACTION_MISS_MS);
  const missed = times.length - hits.length;
  return (
    <>
      <div className="flash-reveal-avg flex w-full flex-col items-center gap-1 rounded-2xl bg-card px-4 py-3">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Your average</p>
        <p className="font-mono text-4xl font-bold tabular-nums text-primary">{avg !== null ? <FxCountUp value={avg} /> : "—"} ms</p>
      </div>
      {times.length === 0 ? (
        <p className="font-display text-2xl font-bold text-warn">No attempts</p>
      ) : (
        <RevealPanel title="Each flash" testId="reaction">
          <RevealBars
            testId="reaction"
            label="Your reactions"
            bars={times.map((ms, index) =>
              ms >= REACTION_MISS_MS
                ? { share: 0.06, text: "Miss", tone: "miss" as const, label: `Flash ${index + 1} - missed` }
                : { share: 1 - Math.min(ms, 800) / 900, text: `${ms}`, tone: ms < 250 ? ("gold" as const) : ms < 400 ? ("good" as const) : ("slow" as const), label: `Flash ${index + 1} - ${ms} ms` },
            )}
          />
          <RevealCaption>Taller is faster · gold under 250 ms</RevealCaption>
          <BarTicks count={times.length} />
        </RevealPanel>
      )}
      <RevealNumbers
        testId="reaction"
        items={[
          { id: "best", label: "Fastest", value: hits.length ? `${Math.min(...hits)} ms` : "—", tone: "gold" },
          { id: "missed", label: "Missed", value: missed, ...(missed > 0 ? { tone: "warn" as const } : {}) },
          { id: "false", label: "False starts", value: falseStarts, ...(falseStarts > 0 ? { tone: "warn" as const } : { tone: "good" as const }) },
        ]}
      />
      <div className="speed-reveal-notes">
        {/* tapRev 7 (7 Nov 2026): each flash scores on its own, so a miss scores nothing rather than counting as 1,200 ms. */}
        {missed > 0 ? <p>{tapRevOf(puzzle) >= TAP_REV_PER_ITEM ? "A missed flash scores 0" : `A miss counts ${REACTION_MISS_MS.toLocaleString("en-GB")} ms`}</p> : null}
        {depth ? (
          <p data-flash-steady-reveal="">
            {depth.steady > 0
              ? `Steady hand: all within ${depth.spread} ms, +${depth.steady}`
              : depth.spread === null
                ? "Steady hand: needs every flash hit"
                : `Steady hand: spread ${depth.spread} ms (within ${FLASH_STEADY_LOOSE_MS} for a bonus)`}
          </p>
        ) : null}
        {decoyReplay && decoyReplay.decoyCut > 0 ? (
          <p>
            Decoys tapped: {decoyReplay.decoysTapped} of {decoyReplay.decoysShown}, so reactions count slower
          </p>
        ) : null}
      </div>
    </>
  );
}

/** The bars landing one after another: a soft tick each, a step higher bar by bar (the bars' CSS stagger). */
export const FLASH_BAR_STAGGER_MS = 90;
function BarTicks({ count }: { count: number }) {
  useEffect(() => {
    const ids = Array.from({ length: count }, (_, i) =>
      window.setTimeout(() => playCueSlot("reaction.bar", 0.6, Math.pow(2, (2 * i) / 12)), 120 + i * FLASH_BAR_STAGGER_MS),
    );
    return () => ids.forEach((id) => window.clearTimeout(id));
  }, [count]);
  return null;
}

export const reactionPuzzle: PuzzleDefinition = {
  // The Speed overhaul's levels: what the level changes, in one line on the round intro (Normal: none).
  introLine: (puzzle) => speedLevelLine(puzzle.type, puzzleLevel(puzzle)),
  key: "reaction",
  name: gameDisplayName("reaction"),
  category: "speed",
  timeLimitMs: REACTION_ROUND_MS,
  generate: buildReaction,
  // Scored from the average reaction time, not from correctness.
  check: () => true,
  revealHeading: "Your reactions",
  IntroExample,
  Stage,
  Reveal,
};
