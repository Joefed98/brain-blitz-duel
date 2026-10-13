import { useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { puzzleDef, puzzleTimeLimitMs } from "@/lib/duel/registry";
import type { PuzzleData } from "@/lib/duel/types";
import type { MomentCard } from "@/lib/replay/cards";
import { soundCue, SHARED_CUES } from "@/lib/replay/cues";
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
      className="relative flex w-full shrink-0 flex-col items-center gap-1 rounded-lg border border-border bg-card/60 p-1.5 animate-phase-in"
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
      {children ? <div className="relative w-full">{children}</div> : null}
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

/** A moment card (Flash, Bang On, Nucleus, Forage): the stored figure, shown with a pop. */
export function MomentCardView({ card }: { card: MomentCard }) {
  useEffect(() => soundCue(SHARED_CUES.momentCard), [card]);
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

/** Scales its child down (never up) to fit the given height, keeping it centred. */
function FitHeight({ height, children }: { height: number; children: ReactNode }) {
  const inner = useRef<HTMLDivElement | null>(null);
  const [scale, setScale] = useState(1);
  useLayoutEffect(() => {
    const node = inner.current;
    if (!node) return;
    const measure = () => {
      const h = node.scrollHeight;
      const w = node.scrollWidth;
      const parentW = node.parentElement?.clientWidth ?? w;
      setScale(Math.min(1, h > 0 ? height / h : 1, w > 0 ? parentW / w : 1));
    };
    measure();
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    observer?.observe(node);
    return () => observer?.disconnect();
  }, [height]);
  return (
    <div className="relative mx-auto overflow-hidden" style={{ height }}>
      <div
        ref={inner}
        className="pointer-events-none absolute left-1/2 top-0 w-[360px] origin-top"
        style={{ transform: `translateX(-50%) scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}

/**
 * The winner's moves played at high speed on the game's own reveal board
 * (read-only: the Reveal component is handed growing prefixes of the stored
 * move list), with a move counter against the minimum.
 */
export function PuzzleTimelapse({
  puzzle,
  plan,
  isCorrect,
  height,
  onEnd,
}: {
  puzzle: PuzzleData;
  plan: TimelapsePlan;
  isCorrect: boolean;
  height: number;
  onEnd: () => void;
}) {
  const [frame, setFrame] = useState(0);
  const Reveal = puzzleDef(puzzle.type).Reveal;
  const timeLimitMs = puzzleTimeLimitMs(puzzle);
  useEffect(() => {
    soundCue(SHARED_CUES.timelapseStart);
    let k = 0;
    const timer = window.setInterval(() => {
      k += 1;
      if (k >= plan.frames.length) {
        window.clearInterval(timer);
        soundCue(SHARED_CUES.timelapseEnd);
        onEnd();
        return;
      }
      setFrame(k);
      soundCue(SHARED_CUES.timelapseMove);
    }, plan.frameMs);
    return () => window.clearInterval(timer);
  }, [plan]); // eslint-disable-line react-hooks/exhaustive-deps
  const done = plan.spec.moves(frame);
  return (
    <div className="relative flex w-full flex-col items-center gap-1" data-timelapse={puzzle.type}>
      <span
        className="rounded bg-background/90 px-1.5 py-0.5 font-mono text-[11px] font-bold tabular-nums text-foreground"
        data-timelapse-counter
      >
        {plan.spec.unit} {done} / {plan.total}
        {plan.min !== null ? ` · ${plan.spec.minLabel} ${plan.min}` : ""}
      </span>
      <FitHeight height={height}>
        <div inert className="select-none">
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
