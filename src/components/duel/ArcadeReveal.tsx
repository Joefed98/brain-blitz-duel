import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/design/components";
import { usePerfectBurst } from "@/lib/fx/useSignature";
import { queueVoice } from "@/lib/sound";

import { ArcadeCelebration, CelebrationHeadline, type CelebrationKind } from "@/components/duel/ArcadeCelebration";
import { WaitingLine } from "@/components/duel/Dots";
import { arcadeWorldOf } from "@/lib/arcade/arcadeFxGames.renderer";
import { recordArcadeRoomBest, runKey } from "@/lib/fx/arcadeBest";
import { CLAY_FREE_EMPTY_SHOTS, CLAY_REV_BANDS } from "@/lib/arcade/clayShoot";
import type { ArcadeRevealData } from "@/lib/arcade/reveal";
import type { PuzzleData } from "@/lib/duel/types";
import type { PlayerLook } from "@/lib/duel/playerLook";

import { ArcadeScoreChart } from "./ArcadeScoreChart";
import { RevealBreakdown } from "./RevealBreakdown";
import { COST_LINE, PENALTY_LINE, realFullClear, statRepeatsPart, summaryText } from "@/lib/duel/revealBreakdown";
import { bandStdLines, standardPartLabels } from "@/lib/duel/arcadeBandStd";

/** One player in the room for the reveal chart. `reveal` and `score` are null until their result lands. */
export interface RevealPlayer {
  slot: number;
  name: string;
  isMe: boolean;
  reveal: ArcadeRevealData | null;
  /** The server's stored round score (round_results.score, or the reveal's progress entry). */
  score: number | null;
  /** Their colour and icon (playerLook.ts); practice has none and draws the first colour. */
  look?: PlayerLook | undefined;
}

interface ArcadeRevealProps {
  puzzle: PuzzleData;
  myAnswer: string | null;
  /** round_results.score for this player; null until the server has stored it. */
  myScore: number | null;
  /** round_results.extra.reveal for this player, built by the server replay. */
  myReveal: ArcadeRevealData | null;
  players: RevealPlayer[];
  nearMissLine?: string | null;
  /** Practice passes its own device-best verdict; rooms leave it out and use the room record. */
  personalBest?: boolean | undefined;
  /** Identifies this run for the room best record (one verdict per run). */
  round?: number | undefined;
  /** Stored costs shown as extra rows under the tiles (storedCostRows); never recomputed. */
  costRows?: ArcadeRevealData["tiles"] | undefined;
  /**
   * Practice (3 Nov 2026): the breakdown open with this device's best, and no chart (it would hold one dot).
   * Rooms keep the chart and open the breakdown from "See breakdown".
   */
  practice?: boolean | undefined;
  /** Practice: this device's best for the game under today's stamps, if any. */
  best?: number | null | undefined;
}

/**
 * Rows for costs the server stored beside the reveal (round_results.extra), read as
 * stored and never recomputed: Pull! clayRev 4's empty shots and their cost (#53).
 * Rounds without the stored fields get no rows.
 */
export function storedCostRows(
  type: string,
  extra: Record<string, unknown> | null | undefined,
  clayRev?: number,
): ArcadeRevealData["tiles"] {
  if (type !== "clayshoot" || !extra) return [];
  const empty = extra["emptyShots"];
  const cost = extra["emptyShotCost"];
  if (typeof empty !== "number" || typeof cost !== "number") return [];
  return [
    { label: `Hit nothing (${CLAY_FREE_EMPTY_SHOTS} free)`, value: String(empty) },
    // clayRev 7: the cost comes off the total before its curve, not off the score.
    { label: (clayRev ?? 0) >= CLAY_REV_BANDS ? "Empty-shot cost (total)" : "Empty-shot cost", value: cost > 0 ? `−${cost}` : "0" },
  ];
}

/**
 * The words a stored breakdown line uses for the fact a tile shows, by tile label. A tile
 * is left out only when a stored line states its exact value next to one of these words
 * ("8 / 10 barriers", "Boss destroyed", "time bonus +12"); labels not listed always show.
 */
const TILE_WORDS: Record<string, string> = {
  Barriers: "barriers?",
  Blocks: "blocks?",
  "Perfect drops": "perfect",
  Perfects: "perfect",
  Buckets: "buckets?",
  Darts: "darts?",
  "Gold hits": "gold(?: hits?)?",
  Targets: "targets?",
  "All hits": "hits?",
  Chillies: "chillies|chilli",
  Atoms: "atoms?",
  "Lives lost": "lives? lost",
  "Lanes crossed": "lanes?",
  "Crossings completed": "crossings?",
  Saucers: "saucers?",
  "Armour hits": "armour hits?",
  Boss: "boss",
  Levels: "levels?",
  Leaves: "leaves?",
  Mazes: "mazes?",
  "Marbles home": "marbles? home|home",
  "Birds hit": "birds? hit",
  Correct: "correct",
  Wrong: "wrong",
  "Time bonus": "time bonus",
  "Buses through": "buses?",
  "Ambulances through": "ambulances?",
  "Gave up": "gave up",
  Overflowed: "overflowed at",
};

/** Tiles holding a run time ("60 s"), left out when a line gives the same time or says the run lasted. */
const TIME_LABELS = new Set(["Survived", "Crashed at"]);

const escape = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function tileInLines(tile: ArcadeRevealData["tiles"][number], lines: string[]): boolean {
  if (TIME_LABELS.has(tile.label)) {
    const seconds = /^(\d+(?:\.\d+)?) s$/.exec(tile.value);
    if (!seconds) return false;
    const value = Number(seconds[1]);
    return lines.some(
      (line) =>
        [...line.matchAll(/(?<![\d.])(\d+(?:\.\d+)?) s\b/g)].some((m) => Number(m[1]) === value) ||
        (tile.label === "Survived" && value === 60 && /^Lasted the minute\b/.test(line)),
    );
  }
  const words = TILE_WORDS[tile.label];
  if (!words || !tile.value) return false;
  const value = escape(tile.value);
  const outOf = /^\d+$/.test(tile.value) ? "(?: / \\d+)?" : "";
  const valueFirst = new RegExp(`(?<![\\d.,+−-])${value}${outOf} (?:${words})(?![a-z])`, "i");
  const wordsFirst = new RegExp(`(?<![a-z])(?:${words})[: ]+\\+?${value}(?![\\d.a-z])`, "i");
  return lines.some((line) => valueFirst.test(line) || wordsFirst.test(line));
}

/**
 * What the reveal shows of the stored summary, each fact once: the stored lines less a
 * "Total → N" that only repeats the big stored score, and the stored tiles less any whose
 * value a stored line already states. Display only: it filters the stored strings and
 * never recomputes a number.
 */
export function revealShown(reveal: ArcadeRevealData, score: number | null): { lines: string[]; tiles: ArcadeRevealData["tiles"] } {
  const lines = reveal.lines.filter((line) => score === null || line !== `Total → ${score}`);
  return { lines, tiles: reveal.tiles.filter((tile) => !tileInLines(tile, reveal.lines)) };
}

/** One part's points from a stored arcade-standard part line ("Distance: 412 ft → 110 of 130", stdLines). */
const STD_PART = /^[^:→]+: .* → (-?\d+) of \d+$/;
/** The standard's closing line (stdLines): the total, or the 1 for playing. */
const STD_TOTAL = /^(Total → \d+( of \d+)?|At least 1 for playing → \d+)$/;

/**
 * The reveal's one-line breakdown (1 Nov 2026, Joe: the full list squashed the chart): on the arcade scoring standard,
 * "142 points · lines 110 + bonuses 32" from its stored part lines (the first part by its own name, the others as bonuses, each
 * figure as stored); any other game's first stored line. `rest` is what the tap opens: every stored line the summary
 * doesn't already show. Display only: it reads the stored strings and never regrades.
 */
export function revealSummary(lines: readonly string[], score: number | null): { summary: string; rest: string[] } | null {
  if (lines.length === 0) return null;
  const body = lines.filter((l) => !STD_TOTAL.test(l) && !PENALTY_LINE.test(l) && !COST_LINE.test(l));
  const parts = body.map((l) => STD_PART.exec(l)).map((m) => (m ? Number(m[1]) : null));
  const standard = score !== null && parts.length >= 2 && parts.every((p) => p !== null);
  if (standard) {
    const [core, ...features] = parts as number[];
    const more = features.reduce((a, b) => a + b, 0);
    // Plain words (text pass, 4 Nov 2026): the first part by its own name, the rest as bonuses.
    const label = (/^([^:→]+):/.exec(body[0]!)?.[1] ?? "main").trim().toLowerCase();
    return { summary: `${score} ${score === 1 ? "point" : "points"}, ${label} ${core} ${more < 0 ? "−" : "+"} ${more < 0 ? "penalties" : "bonuses"} ${Math.abs(more)}`, rest: [...lines] };
  }
  return { summary: lines[0]!, rest: lines.slice(1) };
}

/** Where a line too long for one row breaks: its " · " (else ", ", else a space) nearest the middle. */
function halves(text: string): [string, string] | null {
  for (const [sep, keep] of [[" · ", 0], [", ", 1], [" ", 0]] as const) {
    let best = -1;
    for (let at = text.indexOf(sep); at >= 0; at = text.indexOf(sep, at + 1)) {
      if (best < 0 || Math.abs(at - text.length / 2) < Math.abs(best - text.length / 2)) best = at;
    }
    if (best > 0) return [text.slice(0, best + keep), text.slice(best + sep.length)];
  }
  return null;
}

/**
 * One stored line kept on one row: 14 px, down to 12 px when it must; a line too long even
 * at 12 px (Wavefront's, Junction's on a 375 px phone) breaks once, between whole phrases,
 * so no row wraps mid-phrase or clips. The text is the stored string, never rewritten.
 */
function FitLine({ text, className }: { text: string; className: string }) {
  const box = useRef<HTMLParagraphElement>(null);
  const probe = useRef<HTMLSpanElement>(null);
  const [px, setPx] = useState(14);
  useLayoutEffect(() => {
    const node = box.current;
    if (!node || !probe.current) return;
    const measure = () => {
      // The probe holds the text at 14 px; a monospaced line scales with its font size.
      const wide = probe.current?.getBoundingClientRect().width ?? 0;
      const room = node.clientWidth;
      setPx([14, 13, 12].find((size) => (wide * size) / 14 <= room) ?? 0);
    };
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(node);
    return () => watch.disconnect();
  }, [text]);
  const split = px === 0 ? halves(text) : null;
  return (
    <p ref={box} className={`relative w-full whitespace-nowrap text-center tabular-nums ${className}`} style={{ fontSize: px || 12 }}>
      <span ref={probe} aria-hidden="true" className="invisible absolute left-0 top-0" style={{ fontSize: 14 }}>
        {text}
      </span>
      {split ? (
        <>
          <span className="block">{split[0]}</span>
          <span className="block">{split[1]}</span>
        </>
      ) : (
        text
      )}
    </p>
  );
}

/** Counts from 0 to `target` over ~1 s; the attribute always carries the stored value. */
function useCountUp(target: number | null, ms = 1000): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (target === null) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / ms);
      setValue(Math.round(target * (1 - (1 - t) ** 3)));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [target, ms]);
  return value;
}

/** The final tick drawn once with the game's renderer, dimmed and blurred. */

/** Full clear (the server replay's "finish" outcome) and/or a new device best, once the stored score lands. */
/** Stats a game's newer stamp no longer has (Moon Climb, ricoRev 3: no coins or gold lanterns). */
function retiredStat(puzzle: PuzzleData, label: string): boolean {
  const p = puzzle as unknown as Record<string, unknown>;
  return puzzle.type === "ricochet" && typeof p["ricoRev"] === "number" && (p["ricoRev"] as number) >= 3 && /^(coins|lanterns)$/i.test(label);
}

/** Room runs whose "New best" line has played (a remount never repeats it). */
const voicedBests = new Set<string>();

function useCelebration(puzzle: PuzzleData, myAnswer: string | null, myScore: number | null, myReveal: ArcadeRevealData | null, personalBest: boolean | undefined, round: number | undefined): CelebrationKind | null {
  const [best, setBest] = useState(false);
  useEffect(() => {
    if (myScore === null || !myReveal) return;
    if (personalBest !== undefined) setBest(personalBest);
    else {
      const key = runKey(puzzle.type, round, myAnswer);
      const improved = recordArcadeRoomBest(puzzle.type, myScore, key);
      setBest(improved);
      // A room run that beat this device's best for the game (3 Nov 2026): the "New best" voice line, once per run
      // (practice's comes from NewBestMoment), after the score's own sounds and never over another voice line.
      if (improved && !voicedBests.has(key)) {
        voicedBests.add(key);
        queueVoice("voice.newBest", 1000);
      }
    }
  }, [puzzle.type, myScore, myReveal, myAnswer, personalBest, round]);
  if (myScore === null || !myReveal) return null;
  // Only a real full clear (revealBreakdown.realFullClear): runs that always "finish" no longer cheer a score of 1.
  const full = realFullClear(myReveal.outcome, myReveal.lines, myScore);
  return full && best ? "both" : full ? "full" : best ? "best" : null;
}

export function ArcadeReveal({ puzzle, myAnswer, myScore, myReveal: storedReveal, players, nearMissLine, personalBest, round, costRows = [], practice = false, best = null }: ArcadeRevealProps) {
  // The band-lined standard games read as the standard's part lines (arcadeBandStd.ts); display only.
  const myReveal = useMemo(() => {
    if (!storedReveal) return null;
    const lines = bandStdLines(puzzle as unknown as { type: string } & Record<string, unknown>, storedReveal.lines, myScore);
    return lines ? { ...storedReveal, lines } : storedReveal;
  }, [storedReveal, puzzle, myScore]);
  const shownScore = useCountUp(myScore);
  const celebration = useCelebration(puzzle, myAnswer, myScore, myReveal, personalBest, round);
  const scoreRef = useRef<HTMLParagraphElement>(null);
  usePerfectBurst(scoreRef, myScore, puzzle.type);
  const shown = myReveal ? revealShown(myReveal, myScore) : null;
  // Rooms: one line (the summary) and "See breakdown"; practice: the list open (3 Nov 2026).
  const summary = shown ? revealSummary(shown.lines, myScore) : null;
  // The stats card keeps only what the breakdown doesn't already say (4 Nov 2026): no part repeated as "n / max".
  const partLabels = standardPartLabels(puzzle as unknown as { type: string } & Record<string, unknown>);
  const tiles = shown ? [...shown.tiles.filter((t) => !statRepeatsPart(t.label, shown.lines, partLabels, t.value) && !retiredStat(puzzle, t.label)).slice(0, 4), ...costRows] : [];
  const folds = !practice && !!summary && summary.rest.length + tiles.length > 0;
  const [open, setOpen] = useState(false);
  const breakdownLines = shown ? shown.lines : [];
  // The reveal is its own screen (3 Nov 2026): no frozen world behind it; PhoneShell's `reveal` paints the game's colours.
  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl">
      {celebration ? <ArcadeCelebration kind={celebration} world={arcadeWorldOf(puzzle.type)} /> : null}
      {/* Scrolls rather than overlap (31 Oct 2026): at 375×667 a game with four part lines left the chart
          less height than it needs; opened, the column scrolls. */}
      <div data-reveal-column className="relative flex min-h-0 flex-1 flex-col items-center justify-start gap-3 overflow-y-auto px-3 py-2">
        <div className="flex w-full flex-col items-center gap-1">
          {/* The hero's reserved spot (3 Nov 2026): the celebration hero lands here, beside the score, never over the
              breakdown, the chart or a button (celebrations.ts heroAnchor). */}
          <div data-hero-spot="" aria-hidden="true" className="reveal-hero-spot" />
          {myScore === null ? (
            <div data-reveal-score="pending" className="py-3">
              <WaitingLine label="Scoring…" />
            </div>
          ) : (
            // The score's row: the headline of a full clear or a new best sits beside it, never over the rows below.
            <div className="relative flex w-full items-center justify-center">
              <p
                ref={scoreRef}
                data-reveal-score={myScore}
                className={`reveal-big-score${celebration ? " arcade-score-celebrate" : ""}`}
                aria-label={`${myScore} ${myScore === 1 ? "point" : "points"}`}
              >
                {shownScore}
              </p>
              {celebration ? (
                <span
                  className="absolute right-0 top-1/2 flex -translate-y-1/2 justify-start"
                  style={{ left: `calc(50% + ${Math.max(2, String(myScore).length) * 18 + 10}px)` }}
                >
                  <CelebrationHeadline kind={celebration} world={arcadeWorldOf(puzzle.type)} />
                </span>
              ) : null}
            </div>
          )}
          <p className="reveal-points-label">{myScore === 1 ? "point" : "points"}</p>
          {practice ? (
            <p data-reveal-best="" className="reveal-meta">
              {best === null ? "First go at this one" : <>Your best: <span className="tabular-nums text-foreground">{best}</span></>}
            </p>
          ) : null}
          {summary && !practice ? (
            folds ? (
              <Button
                variant="secondary"
                size={44}
                data-reveal-summary={open ? "open" : "closed"}
                aria-expanded={open}
                onClick={() => setOpen((v) => !v)}
                className="reveal-see-breakdown reveal-see-breakdown-summary min-h-11 w-full animate-fade-in"
              >
                <FitLine text={summaryText(summary.summary)} className="w-full text-foreground" />
                <span className="reveal-see-breakdown-label">{open ? "Hide breakdown" : "See breakdown"}</span>
              </Button>
            ) : (
              <FitLine text={summaryText(summary.summary)} className="text-foreground animate-fade-in" />
            )
          ) : null}
          {myScore !== null && nearMissLine ? <FitLine text={nearMissLine} className="text-foreground" /> : null}
        </div>

        {/* The full breakdown: open in practice, one tap away in a room (always in the markup). */}
        {summary ? <RevealBreakdown lines={breakdownLines} score={myScore} hidden={!practice && !open} /> : null}
        {/* The run's lines exactly as stored, when the rows above were rewritten as part rows (arcadeBandStd.ts). */}
        {summary && myReveal !== storedReveal && storedReveal ? <span hidden data-stored-lines={storedReveal.lines.join("\n")} /> : null}

        {/* The chart straight on the gradient, no panel behind it (rooms only: in practice it would hold one dot). */}
        {/* Never shorter than the chart it holds (no min-h-0): the column scrolls instead of overlapping. */}
        {!practice ? (
          <div data-chart-panel className="flex w-full flex-1 flex-col px-2.5 py-2.5">
            <ArcadeScoreChart
              players={players.map((p) => ({ slot: p.slot, name: p.name, isMe: p.isMe, look: p.look, score: p.isMe ? myScore : p.score }))}
              type={puzzle.type}
            />
          </div>
        ) : null}

        {tiles.length > 0 ? (
          // One full-width row per stored tile (label left, value right), with the breakdown.
          <div
            data-reveal-tiles=""
            hidden={!practice && !open}
            className="reveal-breakdown flex w-full shrink-0 flex-col animate-fade-in"
          >
            {tiles.map((tile) => (
              <div key={tile.label} className="reveal-breakdown-row">
                <span className="reveal-breakdown-name">{tile.label}</span>
                <span className="reveal-breakdown-points">{tile.value}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
