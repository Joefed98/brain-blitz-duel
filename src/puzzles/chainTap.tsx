import { useCallback, useEffect, useRef, useState } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { hapticTick, pointerElementIndex } from "@/components/puzzles/GridDrag";
import {
  chainBoardIndex,
  chainRequired,
  chainTapVerdict,
  chainWindowMs,
  decodeChainAnswer,
  encodeChainAnswer,
  replayChain,
  type ChainTap,
} from "@/lib/duel/chain";
import { useStageState } from "@/lib/duel/stageState";
import {
  CHAIN_FASTER_AT,
  CHAIN_LENGTH,
  CHAIN_TIME_MS,
  CHAIN_WARN_MS,
  type ChainBreak,
  type ChainNode,
  type ChainPuzzleData,
  type ChainRuleItem,
  type ChainShape,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playTick, playTone } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const NODE = 34;
/** Delay between a break and the submit, so the snap can be seen. */
const BREAK_HOLD_MS = 1_000;

function NodeGlyph({ shape, size, colour }: { shape: ChainShape; size: number; colour?: string }) {
  const inner = Math.round(size * 0.62);
  return (
    <svg width={inner} height={inner} viewBox="0 0 24 24" aria-hidden="true" style={colour ? { color: colour } : undefined}>
      {shape === "circle" && <circle cx="12" cy="12" r="9.5" fill="currentColor" />}
      {shape === "square" && <rect x="2.5" y="2.5" width="19" height="19" rx="2" fill="currentColor" />}
      {shape === "triangle" && <polygon points="12,2.5 22,21 2,21" fill="currentColor" />}
    </svg>
  );
}

function RuleStrip({ cycle, step, compact }: { cycle: ChainRuleItem[]; step: number; compact?: boolean }) {
  const active = step % cycle.length;
  const size = compact ? 24 : 32;
  return (
    <div className="flex shrink-0 items-center justify-center gap-1.5" aria-label="Repeating rule">
      {cycle.map((item, index) => (
        <span key={`${item.shape}-${item.colour}`} className="flex items-center gap-1.5">
          <span
            className={`flex items-center justify-center rounded-md border-2 transition-transform ${
              index === active ? "scale-110 border-primary" : "border-transparent opacity-60"
            }`}
            style={{ width: size + 6, height: size + 6 }}
          >
            <NodeGlyph shape={item.shape} colour={GLYPH_COLOURS[item.colour]} size={size} />
          </span>
          <span className="font-mono text-xs text-muted-foreground">→</span>
        </span>
      ))}
      <span className="font-mono text-xs text-muted-foreground">↺</span>
    </div>
  );
}

/** Gold ring that drains clockwise; `left` is the remaining share 0–1. */
function MomentumRing({ left, size, warn }: { left: number; size: number; warn?: boolean }) {
  const r = size / 2 - 3;
  const c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} className="pointer-events-none absolute -rotate-90" aria-hidden="true">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--color-border)" strokeWidth="3" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        fill="none"
        stroke={warn ? "var(--color-warn)" : GLYPH_COLOURS.GOLD}
        strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.max(0, Math.min(1, left)))}
      />
    </svg>
  );
}

const EXAMPLE_CYCLE: ChainRuleItem[] = [
  { shape: "circle", colour: "RED" },
  { shape: "square", colour: "BLUE" },
  { shape: "triangle", colour: "GREEN" },
];

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <RuleStrip cycle={EXAMPLE_CYCLE} step={1} compact />
      <div className="relative h-20 w-full max-w-[240px]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <line x1="15" y1="60" x2="45" y2="35" stroke={GLYPH_COLOURS.GOLD} strokeWidth="3" strokeLinecap="round" />
        </svg>
        <span className="absolute flex size-10 items-center justify-center" style={{ left: "calc(15% - 20px)", top: "calc(60% - 20px)" }}>
          <NodeGlyph shape="circle" colour={GLYPH_COLOURS.RED} size={32} />
        </span>
        <span className="absolute flex size-12 items-center justify-center" style={{ left: "calc(45% - 24px)", top: "calc(35% - 24px)" }}>
          <MomentumRing left={0.6} size={48} />
          <NodeGlyph shape="square" colour={GLYPH_COLOURS.BLUE} size={32} />
        </span>
        <span className="absolute flex size-10 items-center justify-center" style={{ left: "calc(75% - 20px)", top: "calc(62% - 20px)" }}>
          <NodeGlyph shape="triangle" colour={GLYPH_COLOURS.GREEN} size={32} />
        </span>
        <span className="absolute flex size-10 items-center justify-center opacity-80" style={{ left: "calc(90% - 20px)", top: "calc(22% - 20px)" }}>
          <NodeGlyph shape="triangle" colour={GLYPH_COLOURS.YELLOW} size={32} />
        </span>
      </div>
      <p className="text-center font-mono text-[11px] text-muted-foreground">
        Tap the green triangle before the ring empties — not the yellow one.
      </p>
    </div>
  );
}

function ChainLine({ nodes, path, broken }: { nodes: ChainNode[]; path: number[]; broken: boolean }) {
  const points = path
    .map((id) => nodes[id])
    .filter((node): node is ChainNode => Boolean(node));
  if (points.length < 2) return null;
  const colour = broken ? "var(--color-warn)" : GLYPH_COLOURS.GOLD;
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full transition-all duration-700 ease-in"
      style={broken ? { transform: "translateY(60%) rotate(6deg)", opacity: 0 } : undefined}
      aria-hidden="true"
    >
      {points.slice(1).map((to, index) => {
        const from = points[index]!;
        return (
          <line
            key={index}
            x1={`${from.x}%`}
            y1={`${from.y}%`}
            x2={`${to.x}%`}
            y2={`${to.y}%`}
            stroke={colour}
            strokeWidth={4}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${colour})`, transition: "stroke 120ms" }}
          />
        );
      })}
    </svg>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, phaseStartedAt, stateKey = "chain" }: PuzzleStageProps) {
  const data: ChainPuzzleData | null = puzzle.type === "chain" ? puzzle : null;
  const [taps, setTaps] = useStageState<ChainTap[]>(stateKey, "chainTaps2", () => []);
  const [ended, setEnded] = useStageState<ChainBreak | null>(stateKey, "chainEnded", () => null);
  const [clock, setClock] = useState(() => Date.now() - phaseStartedAt);
  const [pulse, setPulse] = useState<number | null>(null);
  const [faster, setFaster] = useState(false);
  const submitted = useRef(false);
  const warned = useRef("");

  const replay = data ? replayChain(data, { taps, reason: ended ?? "timer" }) : null;
  const encoded = encodeChainAnswer({ taps, reason: ended ?? "timer" });

  useEffect(() => onDraftAnswer?.(encoded), [encoded, onDraftAnswer]);

  const finish = useCallback(
    (reason: ChainBreak, nextTaps: ChainTap[]) => {
      if (submitted.current) return;
      submitted.current = true;
      setEnded(reason);
      const answer = encodeChainAnswer({ taps: nextTaps, reason });
      onDraftAnswer?.(answer);
      if (reason === "complete") onSubmit(answer);
      else {
        buzz([40, 30, 60]);
        playTone(220, 380, "sawtooth", 0.3, 70);
        setTimeout(() => onSubmit(answer), BREAK_HOLD_MS);
      }
    },
    [onDraftAnswer, onSubmit, setEnded],
  );

  // Clock, momentum drain and the warning tick.
  useEffect(() => {
    if (!replay || ended || locked) return;
    let frame = 0;
    const loop = () => {
      const t = Date.now() - phaseStartedAt;
      setClock(t);
      if (replay.lastT !== null) {
        const windowMs = chainWindowMs(replay.links + 1);
        const left = windowMs - (t - replay.lastT);
        if (left <= 0) {
          finish("momentum", taps);
          return;
        }
        const key = left <= CHAIN_WARN_MS / 2 ? `${replay.links}b` : left <= CHAIN_WARN_MS ? `${replay.links}a` : "";
        if (key && warned.current !== key) {
          warned.current = key;
          playTick(0.35);
        }
      }
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [replay?.lastT, replay?.links, ended, locked, phaseStartedAt, finish, taps]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!data || !replay) return null;
  const links = replay.links;
  const boardIndex = chainBoardIndex(links);
  const board = data.boards[boardIndex] ?? [];
  const used = new Set(replay.used[boardIndex] ?? []);
  const path = replay.used[boardIndex] ?? [];
  const broken = ended === "wrong" || ended === "momentum";
  const over = Boolean(ended) || locked;
  // The ring sits on the last linked node; after a reshuffle it follows that slot.
  const lastSlot = replay.used[chainBoardIndex(Math.max(0, links - 1))]?.at(-1) ?? null;
  const windowMs = chainWindowMs(links + 1);
  const left = replay.lastT === null ? 1 : (windowMs - (clock - replay.lastT)) / windowMs;
  const tier = links >= CHAIN_FASTER_AT[1] ? 2 : links >= CHAIN_FASTER_AT[0] ? 1 : 0;

  const tap = (nodeId: number) => {
    if (over) return;
    const t = Math.max(0, Math.round(Date.now() - phaseStartedAt));
    const next = { node: nodeId, t };
    const verdict = chainTapVerdict(data, replay, next);
    const nextTaps = [...taps, next];
    setTaps(nextTaps);
    if (verdict !== "ok") {
      finish(verdict, nextTaps);
      return;
    }
    hapticTick();
    // Pitch climbs a semitone per link.
    playTone(440 * Math.pow(2, links / 12), 110, "triangle", 0.22);
    setPulse(nodeId);
    setTimeout(() => setPulse((current) => (current === nodeId ? null : current)), 180);
    const made = links + 1;
    if ((CHAIN_FASTER_AT as readonly number[]).includes(made)) {
      setFaster(true);
      setTimeout(() => setFaster(false), 900);
    }
    if (made >= CHAIN_LENGTH) finish("complete", nextTaps);
  };

  const need = chainRequired(data.cycle, links);

  return (
    <div
      className={`relative flex min-h-0 flex-1 flex-col gap-1.5 rounded-xl transition-colors duration-500 ${
        tier === 2 ? "bg-warn/10" : tier === 1 ? "bg-primary/10" : ""
      }`}
    >
      <RuleStrip cycle={data.cycle} step={links} />
      <p className="shrink-0 text-center font-mono text-3xl font-bold leading-none tabular-nums">
        <span key={links} className={`inline-block ${links > 0 ? "animate-scale-in" : ""} text-primary`}>
          {links}
        </span>
        <span className="text-muted-foreground"> / {CHAIN_LENGTH}</span>
      </p>
      <div data-play-area className={`relative min-h-0 w-full flex-1 ${broken ? "animate-shake" : ""}`}>
        <ChainLine nodes={board} path={path} broken={broken} />
        {board.map((node, index) => {
          const isUsed = used.has(index);
          const ringed = index === lastSlot && !over && replay.lastT !== null;
          return (
            <button
              key={index}
              type="button"
              disabled={over || isUsed}
              aria-label={`${node.colour.toLowerCase()} ${node.shape}`}
              data-pointer-index={index}
              onPointerDown={(event) => {
                event.preventDefault();
                const hit = pointerElementIndex(event.currentTarget);
                if (hit !== null) tap(hit);
              }}
              className={`absolute flex items-center justify-center rounded-full border-0 bg-transparent p-0 [-webkit-tap-highlight-color:transparent] ${
                isUsed && !ringed ? "opacity-35" : ""
              } ${pulse === index ? "scale-125" : "scale-100"}`}
              style={{
                width: NODE + 10,
                height: NODE + 10,
                left: `calc(${node.x}% - ${(NODE + 10) / 2}px)`,
                top: `calc(${node.y}% - ${(NODE + 10) / 2}px)`,
                transition: "left 150ms ease-out, top 150ms ease-out, transform 150ms ease-out, opacity 150ms",
              }}
            >
              {ringed && <MomentumRing left={left} size={NODE + 10} warn={left * windowMs <= CHAIN_WARN_MS} />}
              <NodeGlyph shape={node.shape} colour={GLYPH_COLOURS[node.colour]} size={NODE} />
            </button>
          );
        })}
        {faster && !over && (
          <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center font-display text-4xl font-black tracking-widest text-primary animate-scale-in">
            FASTER
          </div>
        )}
        {broken && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="rounded-xl border-2 border-warn bg-background/90 px-4 py-3 text-center animate-scale-in">
              <p className="font-display text-2xl font-black uppercase tracking-wider text-warn">Chain broken</p>
              <p className="font-mono text-sm text-foreground">
                at link {links + 1} · {ended === "momentum" ? "too slow" : "wrong tap"}
              </p>
            </div>
          </div>
        )}
      </div>
      {need && !over && (
        <span className="sr-only">
          Next: {need.colour.toLowerCase()} {need.shape}
        </span>
      )}
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "chain") return null;
  const answer = decodeChainAnswer(myAnswer ?? "");
  const replay = replayChain(puzzle, answer);
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((CHAIN_TIME_MS - myMsRemaining) / 100) / 10;
  const ending =
    replay.reason === "complete"
      ? "Full chain"
      : replay.reason === "wrong"
        ? `Broken at link ${replay.links + 1} — wrong tap`
        : replay.reason === "momentum"
          ? `Broken at link ${replay.links + 1} — too slow`
          : "Time ran out";
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2">
      <p className="font-mono text-3xl font-bold">
        {replay.links} / {CHAIN_LENGTH}
      </p>
      <p className="whitespace-normal break-words text-center font-mono text-sm">
        {ending}
        {elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""}
      </p>
    </div>
  );
}

export const chainTapPuzzle: PuzzleDefinition = {
  key: "chain",
  name: "Don't Break the Chain",
  category: "speed",
  timeLimitMs: CHAIN_TIME_MS,
  revealMs: 5_000,
  generate: () => ({ type: "chain", cycle: [], boards: [] }) satisfies ChainPuzzleData,
  check: () => false,
  revealHeading: "Your chain",
  IntroExample,
  Stage,
  Reveal,
};
