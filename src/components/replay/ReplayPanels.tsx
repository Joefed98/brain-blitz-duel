import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { puzzleDef, puzzleTimeLimitMs } from "@/lib/duel/registry";
import type { PuzzleData } from "@/lib/duel/types";
import type { MomentCard } from "@/lib/replay/cards";
import { soundCue, SHARED_CUES } from "@/lib/replay/cues";
import { quietForReplay } from "@/lib/sound";
import type { HighlightClip } from "@/lib/replay/pick";
import type { PlaybackDrawer } from "@/lib/replay/playback.renderer";
import type { ReplayTimeline } from "@/lib/replay/timeline";
import type { TimelapsePlan } from "@/lib/replay/timelapse";

import { ReplayCanvas, ReplayStill, type PlaybackPlan } from "./ReplayCanvas";

/* eslint-disable @typescript-eslint/no-explicit-any */

/** The shared frame: a heading, the moment area and a Skip control. Never holds up the room. */
export function ReplayFrame({
  heading,
  caption,
  onSkip,
  skipLabel = "Skip",
  footer,
  action,
  children,
  testId,
}: {
  heading: string;
  caption?: string | null;
  onSkip?: (() => void) | undefined;
  skipLabel?: string;
  footer?: ReactNode;
  /** A control for the header's right side (the Watch button on the slim bar). */
  action?: ReactNode;
  children?: ReactNode;
  testId: string;
}) {
  return (
    <section
      data-replay-panel={testId}
      className="th-card relative flex w-full shrink-0 flex-col items-center gap-1 rounded-lg border border-border bg-card/60 p-1.5 animate-phase-in"
    >
      <header className="flex w-full items-center gap-2 px-1">
        <span className="min-w-0 flex-1 truncate text-left font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
          {heading}
        </span>
        {action}
        {onSkip && (
          <button
            type="button"
            onClick={onSkip}
            className="press shrink-0 rounded border border-border px-2 py-0.5 font-mono text-[10px] font-bold uppercase text-foreground/80"
            data-replay-skip
          >
            {skipLabel}
          </button>
        )}
      </header>
      {/* The replay itself is the game's own art: the page skin's tokens stop here (theme.css). */}
      {children ? (
        <div data-skin-off className="relative w-full">
          {children}
        </div>
      ) : null}
      {caption ? (
        <p
          className="w-full truncate px-1 text-center font-display text-xs font-bold uppercase tracking-wide text-foreground"
          data-replay-caption
        >
          {caption}
        </p>
      ) : null}
      {footer}
    </section>
  );
}

/** The moment area: the world's own aspect, no taller than `maxHeight`. */
export function WorldBox({
  worldW,
  worldH,
  maxHeight,
  children,
}: {
  worldW: number;
  worldH: number;
  maxHeight: string;
  children: ReactNode;
}) {
  return (
    <div
      className="mx-auto overflow-hidden rounded-md border border-border bg-background"
      style={{ aspectRatio: `${worldW} / ${worldH}`, height: maxHeight, maxWidth: "100%" }}
    >
      {children}
    </div>
  );
}

/** Highlight clips of one replayed round, played once; a still with the caption on a slow device. */
export function ClipPlayer({
  timeline,
  drawer,
  clips,
  maxHeight,
  slow,
  onCaption,
  onEnd,
  label,
}: {
  timeline: ReplayTimeline<any>;
  drawer: PlaybackDrawer;
  clips: HighlightClip[];
  maxHeight: string;
  slow: boolean;
  onCaption: (caption: string) => void;
  onEnd: () => void;
  label: string;
}) {
  const [lite, setLite] = useState(slow);
  const plan = useMemo<PlaybackPlan>(() => ({ kind: "clips", clips }), [clips]);
  const controls = useMemo(() => ({ playing: true, speed: 1 }), []);
  useEffect(() => {
    if (clips[0]) onCaption(clips[0].moment.caption);
  }, [clips]); // eslint-disable-line react-hooks/exhaustive-deps
  // A still stays up about as long as the clips would have run.
  useEffect(() => {
    if (!lite) return;
    const ms = Math.min(6000, clips.reduce((s, c) => s + c.seconds, 0) * 1000);
    const timer = window.setTimeout(onEnd, ms);
    return () => window.clearTimeout(timer);
  }, [lite]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <WorldBox worldW={drawer.worldW} worldH={drawer.worldH} maxHeight={maxHeight}>
      {lite ? (
        <ReplayStill
          timeline={timeline}
          drawer={drawer}
          tick={clips[0]?.moment.tick ?? timeline.endTick}
          label={label}
        />
      ) : (
        <ReplayCanvas
          timeline={timeline}
          drawer={drawer}
          plan={plan}
          controls={controls}
          label={label}
          onClip={(i) => clips[i] && onCaption(clips[i]!.moment.caption)}
          onEnd={onEnd}
          onSlow={() => setLite(true)}
        />
      )}
    </WorldBox>
  );
}

/** The full run at normal speed: play / pause, slow motion, 2x, a seek bar and close. Opened on request only. */
export function FullRunViewer({
  timeline,
  drawer,
  name,
  onClose,
}: {
  timeline: ReplayTimeline<any>;
  drawer: PlaybackDrawer;
  name: string;
  onClose: () => void;
}) {
  const [playing, setPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0);
  const [seek, setSeek] = useState<{ to: number; id: number }>({ to: 0, id: 0 });
  const [ended, setEnded] = useState(false);
  const plan = useMemo<PlaybackPlan>(() => ({ kind: "full" }), []);
  const controls = { playing, speed, seekTo: seek.to, seekId: seek.id };
  useEffect(() => {
    soundCue(SHARED_CUES.replayOpen);
    return () => soundCue(SHARED_CUES.replayClose);
  }, []);
  const setRate = (value: number) => {
    setSpeed(value);
    soundCue(SHARED_CUES.replaySpeed);
  };
  const seconds = (t: number) => `${Math.floor(t / 60)}.${Math.floor(((t % 60) / 60) * 10)} s`;
  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-2 bg-background/95 p-4"
      role="dialog"
      aria-label={`${name}'s run`}
      data-replay-viewer
    >
      <div className="flex w-full max-w-md items-center justify-between">
        <p className="truncate font-display text-sm font-bold text-foreground">{name}&apos;s run</p>
        <button
          type="button"
          onClick={onClose}
          className="press rounded border border-border px-3 py-1 font-mono text-xs font-bold uppercase"
          data-replay-close
        >
          Close
        </button>
      </div>
      <WorldBox worldW={drawer.worldW} worldH={drawer.worldH} maxHeight="min(64vh, 560px)">
        <ReplayCanvas
          timeline={timeline}
          drawer={drawer}
          plan={plan}
          controls={controls}
          label={`${name}'s run`}
          onTick={setTick}
          onEnd={() => setEnded(true)}
        />
      </WorldBox>
      <input
        type="range"
        min={0}
        max={timeline.endTick}
        value={tick}
        aria-label="Jump to"
        className="w-full max-w-md accent-primary"
        onChange={(e) => {
          setSeek((s) => ({ to: Number(e.target.value), id: s.id + 1 }));
          setEnded(false);
        }}
        data-replay-seek
      />
      <div className="flex w-full max-w-md items-center gap-2">
        <Button
          size="sm"
          className="press font-mono text-xs uppercase"
          onClick={() => {
            if (ended) {
              setSeek((s) => ({ to: 0, id: s.id + 1 }));
              setEnded(false);
              setPlaying(true);
            } else setPlaying((p) => !p);
          }}
          data-replay-play
        >
          {ended ? "Again" : playing ? "Pause" : "Play"}
        </Button>
        {[0.5, 1, 2].map((value) => (
          <Button
            key={value}
            size="sm"
            variant={speed === value ? "default" : "outline"}
            className="press font-mono text-xs"
            onClick={() => setRate(value)}
            data-replay-speed={value}
          >
            {value === 0.5 ? "Slow" : `${value}x`}
          </Button>
        ))}
        <span className="ml-auto font-mono text-xs tabular-nums text-muted-foreground">
          {seconds(tick)}
        </span>
      </div>
    </div>
  );
}

/**
 * A moment card (Flash, Bang On, Nucleus, Forage): the stored figure, shown with a pop. Silent,
 * like the time-lapse: puzzle replays play no sound effects (18 Oct 2026).
 */
export function MomentCardView({ card }: { card: MomentCard }) {
  return (
    <div
      className="mx-auto flex w-full flex-col items-center justify-center gap-0.5 rounded-md border border-primary/50 bg-background px-3 py-3 animate-pop-in"
      data-moment-card={card.id}
    >
      <span className="font-mono text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
        {card.title}
      </span>
      <span className="font-display text-3xl font-bold tabular-nums text-primary">
        {card.value}
      </span>
      <span className="font-mono text-[11px] text-foreground/80">{card.detail}</span>
    </div>
  );
}

/** The reveal board's layout box: the answer reveal's board width on a phone, and a tall definite height. */
const BOARD_W = 360;
const BOARD_H = 520;

/**
 * Shows a game's Reveal board inside `height` px (23 Oct 2026). The Reveal is laid out as on the answer
 * reveal, in a definite BOARD_W × BOARD_H flex box (boards that size from their parent, flex-1 min-h-0,
 * collapsed to nothing in an auto-height box), with the page's original tokens (data-skin-off) as there.
 * What it actually drew (the union of its visible boxes) is then scaled down, never up, to fit the width
 * and height and centred. `grow` keeps the largest drawn area seen, so a time-lapse never resizes as
 * pieces move.
 */
function FitHeight({
  height,
  grow = false,
  children,
}: {
  height: number;
  grow?: boolean;
  children: ReactNode;
}) {
  const outer = useRef<HTMLDivElement | null>(null);
  const inner = useRef<HTMLDivElement | null>(null);
  const [fit, setFit] = useState({ scale: 1, x: 0, y: 0, ready: false });
  const seen = useRef<{ x0: number; y0: number; x1: number; y1: number } | null>(null);
  useLayoutEffect(() => {
    const node = inner.current;
    const box = outer.current;
    if (!node || !box) return;
    const measure = () => {
      const base = node.getBoundingClientRect();
      const k = base.width > 0 ? BOARD_W / base.width : 1;
      let x0 = Infinity,
        y0 = Infinity,
        x1 = -Infinity,
        y1 = -Infinity;
      for (const el of Array.from(node.querySelectorAll("*"))) {
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) continue;
        const style = getComputedStyle(el);
        // Only leaves and painted boxes count: a stretched wrapper is not drawn area.
        const painted =
          el.children.length === 0 ||
          style.backgroundColor !== "rgba(0, 0, 0, 0)" ||
          style.borderTopWidth !== "0px" ||
          el.tagName === "svg" ||
          el.tagName === "CANVAS";
        if (!painted) continue;
        x0 = Math.min(x0, (r.left - base.left) * k);
        y0 = Math.min(y0, (r.top - base.top) * k);
        x1 = Math.max(x1, (r.right - base.left) * k);
        y1 = Math.max(y1, (r.bottom - base.top) * k);
      }
      if (!Number.isFinite(x0)) return;
      const prev = grow ? seen.current : null;
      const area = prev
        ? {
            x0: Math.min(prev.x0, x0),
            y0: Math.min(prev.y0, y0),
            x1: Math.max(prev.x1, x1),
            y1: Math.max(prev.y1, y1),
          }
        : { x0, y0, x1, y1 };
      seen.current = area;
      const w = Math.max(1, area.x1 - area.x0);
      const h = Math.max(1, area.y1 - area.y0);
      const scale = Math.min(1, box.clientWidth / w, height / h);
      const x = (box.clientWidth - w * scale) / 2 - area.x0 * scale;
      const y = (height - h * scale) / 2 - area.y0 * scale;
      setFit((f) =>
        Math.abs(f.scale - scale) < 1e-3 &&
        Math.abs(f.x - x) < 0.25 &&
        Math.abs(f.y - y) < 0.25 &&
        f.ready
          ? f
          : { scale, x, y, ready: true },
      );
    };
    measure();
    // Later changes (a new frame, a resize) are measured once per animation frame, never in the
    // observer callbacks themselves, and the box's own transform is not a change of the board.
    let frame = 0;
    const raf =
      typeof requestAnimationFrame === "function"
        ? requestAnimationFrame
        : (fn: () => void) => window.setTimeout(fn, 16);
    const later = () => {
      if (!frame) frame = raf(() => ((frame = 0), measure()));
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(later) : null;
    observer?.observe(box);
    const mutations =
      typeof MutationObserver !== "undefined"
        ? new MutationObserver((records) => {
            if (records.some((r) => r.target !== node)) later();
          })
        : null;
    mutations?.observe(node, {
      subtree: true,
      childList: true,
      attributes: true,
      characterData: true,
    });
    return () => {
      if (typeof cancelAnimationFrame === "function") cancelAnimationFrame(frame);
      else window.clearTimeout(frame);
      observer?.disconnect();
      mutations?.disconnect();
    };
  }, [height, grow]);
  return (
    // w-full: inside the time-lapse's centred flex column a box with only an absolute child has no
    // width of its own, so it measured 0 and every board was scaled to nothing (fixed 23 Oct 2026).
    <div ref={outer} className="relative mx-auto w-full overflow-hidden" style={{ height }}>
      <div
        ref={inner}
        data-skin-off=""
        className="pointer-events-none absolute left-0 top-0 flex flex-col items-center justify-start"
        style={{
          width: BOARD_W,
          height: BOARD_H,
          transform: `translate(${fit.x}px, ${fit.y}px) scale(${fit.scale})`,
          transformOrigin: "0 0",
          opacity: fit.ready ? 1 : 0,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The winner's moves played at high speed on the game's own reveal board
 * (read-only: the Reveal component is handed growing prefixes of the stored
 * move list), with a move counter against the minimum. Silent (18 Oct 2026):
 * a puzzle replay plays no sound effects; replay-sound-check proves it.
 */
export function PuzzleTimelapse({
  puzzle,
  plan,
  isCorrect,
  height,
  onEnd,
  score,
}: {
  puzzle: PuzzleData;
  plan: TimelapsePlan;
  isCorrect: boolean;
  height: number;
  onEnd: () => void;
  /** The round's stored score, shown once the last move is on the board (only AnswerReveal's stored figure). */
  score?: number;
}) {
  const [frame, setFrame] = useState(0);
  const Reveal = puzzleDef(puzzle.type).Reveal;
  // Layout effects run before the board's own (passive) effects, so its very first cue is quiet too.
  useLayoutEffect(() => {
    quietForReplay(true);
    return () => quietForReplay(false);
  }, []);
  const timeLimitMs = puzzleTimeLimitMs(puzzle);
  useEffect(() => {
    // Each frame at its own time (the moves' recorded rhythm where the answer keeps times, else evenly),
    // then one more step's pause on the final board before onEnd.
    const timers = plan.atMs.slice(1).map((at, i) => window.setTimeout(() => setFrame(i + 1), at));
    const last = plan.atMs[plan.atMs.length - 1] ?? 0;
    timers.push(window.setTimeout(onEnd, last + plan.frameMs));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = plan.spec.moves(frame);
  const finished = frame >= plan.frames.length - 1;
  return (
    <div
      className="relative flex w-full flex-col items-center gap-1"
      data-timelapse={puzzle.type}
      data-timelapse-frame={frame}
    >
      <span
        className="rounded bg-background/90 px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-foreground"
        data-timelapse-counter
      >
        {plan.spec.unit} {done} / {plan.total}
        {plan.min !== null ? ` · ${plan.spec.minLabel} ${plan.min}` : ""}
        {finished && score !== undefined ? ` · ${score} pts` : ""}
      </span>
      <FitHeight height={height} grow>
        <div
          inert
          className="replay-board replay-board-lapse flex min-h-0 w-full flex-1 select-none flex-col items-center"
        >
          <Reveal
            puzzle={puzzle}
            myAnswer={plan.frames[frame] ?? ""}
            myCorrect={isCorrect}
            myReactionAvgMs={null}
            timeLimitMs={timeLimitMs}
          />
        </div>
      </FitHeight>
    </div>
  );
}

/**
 * A puzzle whose stored answer has no move history (a final layout, a set of picks): the winner's
 * real final board on the game's own Reveal, with the stored score and "Replay not available for
 * this game yet". Nothing is invented; docs/demo-replay-audit.md lists what each game would need
 * to record.
 */
export function PuzzleFinalBoard({
  puzzle,
  answer,
  isCorrect,
  height,
  score,
}: {
  puzzle: PuzzleData;
  answer: string;
  isCorrect: boolean;
  height: number;
  score: number;
}) {
  const Reveal = puzzleDef(puzzle.type).Reveal;
  useLayoutEffect(() => {
    quietForReplay(true);
    return () => quietForReplay(false);
  }, []);
  return (
    <div
      className="relative flex w-full flex-col items-center gap-1"
      data-replay-final={puzzle.type}
    >
      <span
        className="rounded bg-background/90 px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-foreground"
        data-replay-unavailable
      >
        Replay not available for this game yet · {score} pts
      </span>
      <FitHeight height={height}>
        <div
          inert
          className="replay-board flex min-h-0 w-full flex-1 select-none flex-col items-center"
        >
          <Reveal
            puzzle={puzzle}
            myAnswer={answer}
            myCorrect={isCorrect}
            myReactionAvgMs={null}
            timeLimitMs={puzzleTimeLimitMs(puzzle)}
          />
        </div>
      </FitHeight>
    </div>
  );
}
