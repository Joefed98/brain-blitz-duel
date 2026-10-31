import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePerfectBurst } from "@/lib/fx/useSignature";

import { ArcadeCelebration, type CelebrationKind } from "@/components/duel/ArcadeCelebration";
import { WaitingLine } from "@/components/duel/Dots";
import { arcadeWorldOf } from "@/lib/arcade/arcadeFxGames.renderer";
import { recordArcadeRoomBest, runKey } from "@/lib/fx/arcadeBest";
import { CLAY_FREE_EMPTY_SHOTS, CLAY_REV_BANDS } from "@/lib/arcade/clayShoot";
import type { ArcadeRevealData } from "@/lib/arcade/reveal";
import { ARCADE_REVEAL_RENDERERS, revealWorldH } from "@/lib/arcade/revealRenderers";
import type { PuzzleData } from "@/lib/duel/types";
import type { PlayerLook } from "@/lib/duel/playerLook";

import { ArcadeScoreChart } from "./ArcadeScoreChart";
import { canvasRatio } from "@/lib/battery";

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
    <p ref={box} className={`relative w-full whitespace-nowrap text-center font-mono ${className}`} style={{ fontSize: px || 12 }}>
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
function Backdrop({ puzzle, answer, outcome }: { puzzle: PuzzleData; answer: string; outcome: ArcadeRevealData["outcome"] | null }) {
  const renderer = ARCADE_REVEAL_RENDERERS[puzzle.type];
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [focus, setFocus] = useState<{ x: number; y: number } | null>(null);
  const worldH = renderer ? revealWorldH(renderer, puzzle) : 0;
  useEffect(() => {
    const node = canvas.current;
    if (!renderer || !node) return;
    const ratio = canvasRatio();
    node.width = Math.round(renderer.worldW * ratio);
    node.height = Math.round(worldH * ratio);
    const ctx = node.getContext("2d");
    if (!ctx) return;
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    try {
      setFocus(renderer.drawFinal(ctx, puzzle, answer));
    } catch {
      setFocus(null);
    }
  }, [renderer, puzzle, answer, worldH]);
  if (!renderer) return null;
  const ring = outcome === "finish" ? "var(--me)" : null;
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-xl" aria-hidden="true">
      <canvas
        ref={canvas}
        className="h-full w-full object-cover"
        style={{ filter: "brightness(0.26) blur(3px)", transform: "scale(1.04)" }}
      />
      {ring ? (
        <svg
          className="absolute inset-0 h-full w-full"
          viewBox={`0 0 ${renderer.worldW} ${worldH}`}
          preserveAspectRatio="xMidYMid slice"
        >
          {focus ? (
            <>
              <circle cx={focus.x} cy={focus.y} r={26} fill="none" stroke={ring} strokeWidth={3} />
              <circle cx={focus.x} cy={focus.y} r={26} fill="none" stroke={ring} strokeWidth={2} className="arcade-reveal-pulse" />
            </>
          ) : (
            <rect
              x={4}
              y={4}
              width={renderer.worldW - 8}
              height={worldH - 8}
              rx={14}
              fill="none"
              stroke={ring}
              strokeWidth={3}
              className="arcade-reveal-glow"
            />
          )}
        </svg>
      ) : null}
    </div>
  );
}

/** Full clear (the server replay's "finish" outcome) and/or a new device best, once the stored score lands. */
function useCelebration(puzzle: PuzzleData, myAnswer: string | null, myScore: number | null, myReveal: ArcadeRevealData | null, personalBest: boolean | undefined, round: number | undefined): CelebrationKind | null {
  const [best, setBest] = useState(false);
  useEffect(() => {
    if (myScore === null || !myReveal) return;
    if (personalBest !== undefined) setBest(personalBest);
    else setBest(recordArcadeRoomBest(puzzle.type, myScore, runKey(puzzle.type, round, myAnswer)));
  }, [puzzle.type, myScore, myReveal, myAnswer, personalBest, round]);
  if (myScore === null || !myReveal) return null;
  const full = myReveal.outcome === "finish";
  return full && best ? "both" : full ? "full" : best ? "best" : null;
}

export function ArcadeReveal({ puzzle, myAnswer, myScore, myReveal, players, nearMissLine, personalBest, round, costRows = [] }: ArcadeRevealProps) {
  const accent = ARCADE_REVEAL_RENDERERS[puzzle.type]?.accent ?? "var(--me)";
  const shownScore = useCountUp(myScore);
  const celebration = useCelebration(puzzle, myAnswer, myScore, myReveal, personalBest, round);
  const scoreRef = useRef<HTMLParagraphElement>(null);
  usePerfectBurst(scoreRef, myScore, puzzle.type);
  const shown = myReveal ? revealShown(myReveal, myScore) : null;
  // The score block's bottom edge, so the scrim behind it covers exactly that much of the frozen world.
  const head = useRef<HTMLDivElement>(null);
  const [headBottom, setHeadBottom] = useState(0);
  useLayoutEffect(() => {
    const node = head.current;
    if (!node) return;
    const measure = () => setHeadBottom(node.offsetTop + node.offsetHeight);
    measure();
    const watch = new ResizeObserver(measure);
    watch.observe(node);
    return () => watch.disconnect();
  }, []);
  return (
    <div className="relative flex min-h-0 w-full flex-1 flex-col overflow-hidden rounded-xl">
      <Backdrop puzzle={puzzle} answer={myAnswer ?? ""} outcome={myReveal?.outcome ?? null} />
      {/* Opaque behind the score and its lines, fading out 24 px below, so no world HUD text shows through them. */}
      <div
        data-reveal-scrim=""
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0"
        style={{ height: headBottom + 32, background: "linear-gradient(to bottom, var(--background) calc(100% - 24px), transparent)" }}
      />
      {celebration ? <ArcadeCelebration kind={celebration} world={arcadeWorldOf(puzzle.type)} /> : null}
      {/* Scrolls rather than overlap (31 Oct 2026): at 375×667 a game with four part lines left the chart
          less height than it needs, and the chart (min-h-0) drew over the parts card under it. */}
      <div data-reveal-column className="relative flex min-h-0 flex-1 flex-col items-center justify-between gap-3 overflow-y-auto px-3 py-4">
        <div ref={head} className="flex w-full flex-col items-center gap-1">
          {myScore === null ? (
            <div data-reveal-score="pending" className="py-3">
              <WaitingLine label="Scoring…" />
            </div>
          ) : (
            <p
              ref={scoreRef}
              data-reveal-score={myScore}
              className={`font-mono text-6xl font-bold tabular-nums leading-none text-foreground${celebration ? " arcade-score-celebrate" : ""}`}
              aria-label={`${myScore} points`}
            >
              {shownScore}
            </p>
          )}
          <p className="font-mono text-xs uppercase tracking-[0.3em] text-muted-foreground">points</p>
          {shown
            ? shown.lines.map((line) => <FitLine key={line} text={line} className="text-foreground animate-fade-in" />)
            : null}
          {myScore !== null && nearMissLine ? <FitLine text={nearMissLine} className="text-foreground" /> : null}
        </div>

        {/* The chart in a clean panel over the darkened world, never over the busy board itself. */}
        {/* Never shorter than the chart it holds (no min-h-0): the column scrolls instead of overlapping. */}
        <div data-chart-panel className="flex w-full flex-1 flex-col rounded-[18px] bg-[#17171B] px-2.5 py-2.5">
          <ArcadeScoreChart
            players={players.map((p) => ({ slot: p.slot, name: p.name, isMe: p.isMe, look: p.look, score: p.isMe ? myScore : p.score }))}
            type={puzzle.type}
          />
        </div>

        {shown && shown.tiles.length + costRows.length > 0 ? (
          // One full-width row per stored tile (label left, value right), so a label as
          // long as "Crossings completed" stays on one line at 12 px on a 375 px phone.
          <div
            data-reveal-tiles=""
            className="flex w-full shrink-0 flex-col divide-y rounded-lg border bg-background/70 px-3 animate-fade-in"
            style={{ borderColor: accent }}
          >
            {[...shown.tiles.slice(0, 4), ...costRows].map((tile) => (
              <div key={tile.label} className="flex min-w-0 items-baseline justify-between gap-3 py-1" style={{ borderColor: "color-mix(in srgb, var(--muted-foreground) 25%, transparent)" }}>
                <span className="min-w-0 truncate whitespace-nowrap text-xs uppercase tracking-wider text-muted-foreground">{tile.label}</span>
                <span className="shrink-0 whitespace-nowrap font-mono text-lg font-bold tabular-nums leading-tight" style={{ color: accent }}>
                  {tile.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
