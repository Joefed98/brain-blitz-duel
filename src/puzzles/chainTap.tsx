import { useEffect, useMemo, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { hapticTick, pointerElementIndex } from "@/components/puzzles/GridDrag";
import { Button } from "@/components/ui/button";
import {
  chainRequired,
  chainWouldCross,
  CHAIN_RESET,
  CHAIN_UNDO,
  decodeChainTaps,
  encodeChainTaps,
  replayChain,
} from "@/lib/duel/chain";
import { useStageState } from "@/lib/duel/stageState";
import {
  CHAIN_LENGTH,
  CHAIN_TIME_MS,
  type ChainNode,
  type ChainPuzzleData,
  type ChainShape,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

function NodeGlyph({ shape, size }: { shape: ChainShape; size: number }) {
  const inner = Math.round(size * 0.58);
  return (
    <svg width={inner} height={inner} viewBox="0 0 24 24" aria-hidden="true">
      {shape === "circle" && <circle cx="12" cy="12" r="9.5" fill="currentColor" />}
      {shape === "square" && (
        <rect x="2.5" y="2.5" width="19" height="19" rx="2" fill="currentColor" />
      )}
      {shape === "triangle" && <polygon points="12,2.5 22,21 2,21" fill="currentColor" />}
    </svg>
  );
}

function RuleStrip({
  cycle,
  step,
  compact,
}: {
  cycle: ChainShape[];
  step: number;
  compact?: boolean;
}) {
  const active = step % cycle.length;
  const size = compact ? 24 : 34;
  return (
    <div
      className="flex shrink-0 items-center justify-center gap-1.5"
      aria-label="Repeating shape rule"
    >
      {cycle.map((shape, index) => (
        <span key={shape} className="flex items-center gap-1.5">
          <span
            className={`flex items-center justify-center rounded-full border-2 ${
              index === active
                ? "border-primary bg-primary/15 text-primary"
                : "border-border bg-card text-foreground"
            }`}
            style={{ width: size, height: size }}
          >
            <NodeGlyph shape={shape} size={size} />
          </span>
          <span className="font-mono text-xs text-muted-foreground">→</span>
        </span>
      ))}
      <span className="font-mono text-xs text-muted-foreground">…</span>
    </div>
  );
}

const EXAMPLE_CYCLE: ChainShape[] = ["circle", "square", "triangle"];
const EXAMPLE_NODES: ChainNode[] = [
  { x: 14, y: 64, shape: "circle" },
  { x: 38, y: 28, shape: "square" },
  { x: 68, y: 66, shape: "triangle" },
  { x: 87, y: 20, shape: "circle" },
];

function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-1.5">
      <RuleStrip cycle={EXAMPLE_CYCLE} step={0} compact />
      <div className="relative h-20 w-full max-w-[220px]">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
          <polyline
            points="14,64 38,28 68,66 87,20"
            fill="none"
            stroke={GLYPH_COLOURS.GOLD}
            strokeWidth="3"
            strokeLinecap="round"
          />
          <line
            x1="14"
            y1="20"
            x2="87"
            y2="70"
            stroke="var(--color-warn)"
            strokeWidth="2.5"
            strokeDasharray="4 3"
          />
          <path
            d="M48 40 L55 47 M55 40 L48 47"
            stroke="var(--color-warn)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        {EXAMPLE_NODES.map((node, index) => (
          <span
            key={index}
            className="absolute flex size-8 items-center justify-center rounded-full border-2 border-primary bg-card text-primary"
            style={{ left: `calc(${node.x}% - 16px)`, top: `calc(${node.y}% - 16px)` }}
          >
            <NodeGlyph shape={node.shape} size={32} />
          </span>
        ))}
      </div>
    </div>
  );
}

function ChainLines({
  nodes,
  chain,
  width = 3,
}: {
  nodes: ChainNode[];
  chain: number[];
  width?: number;
}) {
  return (
    <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
      {chain.slice(1).map((nodeId, index) => {
        const from = nodes[chain[index]!];
        const to = nodes[nodeId];
        return from && to ? (
          <line
            key={`${chain[index]}-${nodeId}`}
            x1={`${from.x}%`}
            y1={`${from.y}%`}
            x2={`${to.x}%`}
            y2={`${to.y}%`}
            stroke={GLYPH_COLOURS.GOLD}
            strokeWidth={width}
            strokeLinecap="round"
          />
        ) : null;
      })}
    </svg>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "chain" }: PuzzleStageProps) {
  const data: ChainPuzzleData | null = puzzle.type === "chain" ? puzzle : null;
  const [taps, setTaps] = useStageState<number[]>(stateKey, "chainTaps", () => []);
  const [wrong, setWrong] = useStageState<number | null>(stateKey, "chainWrong", () => null);
  const submitted = useRef(false);
  const replay = useMemo(
    () => (data ? replayChain(data.nodes, data.cycle, taps) : null),
    [data, taps],
  );

  useEffect(() => onDraftAnswer?.(encodeChainTaps(taps)), [taps, onDraftAnswer]);
  useEffect(() => {
    if (locked || submitted.current || !replay?.completed) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encodeChainTaps(taps));
  }, [replay?.completed, taps, locked, onSubmit]);

  if (!data || !replay) return null;
  const tap = (nodeId: number) => {
    if (locked || submitted.current || replay.completed) return;
    const node = data.nodes[nodeId];
    if (!node) return;
    const ok =
      !replay.chain.includes(nodeId) &&
      node.shape === chainRequired(replay.rule, replay.index) &&
      !chainWouldCross(data.nodes, replay.chain, nodeId);
    if (ok) hapticTick();
    else {
      buzz(20);
      playWrong();
      setWrong(nodeId);
      setTimeout(() => setWrong(null), 280);
    }
    setTaps((current) => [...current, nodeId]);
  };
  // Undo and Reset are logged in the tap list, so mistakes already made stay counted.
  const undo = () => {
    if (locked || submitted.current || replay.completed || replay.chain.length === 0) return;
    hapticTick();
    setTaps((current) => [...current, CHAIN_UNDO]);
  };
  const reset = () => {
    if (locked || submitted.current || replay.completed || replay.chain.length === 0) return;
    hapticTick();
    setTaps((current) => [...current, CHAIN_RESET]);
  };
  const used = new Set(replay.chain);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <RuleStrip cycle={replay.rule} step={replay.index} />
      <p className="shrink-0 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        links{" "}
        <span className="text-primary">
          {replay.chain.length} / {CHAIN_LENGTH}
        </span>
      </p>
      <div className="relative min-h-0 w-full flex-1">
        <ChainLines nodes={data.nodes} chain={replay.chain} />
        {data.nodes.map((node, index) => (
          <Button
            key={index}
            type="button"
            disabled={locked || used.has(index)}
            aria-label={`Node ${index + 1}`}
            data-pointer-index={index}
            onPointerDown={(event) => {
              event.preventDefault();
              const hit = pointerElementIndex(event.currentTarget);
              if (hit !== null) tap(hit);
            }}
            className={`pointer-events-auto absolute flex size-[46px] items-center justify-center rounded-full border-2 p-0 ${wrong === index ? "animate-shake border-warn bg-warn/15 text-warn" : used.has(index) ? "border-primary bg-primary/15 text-primary" : "border-border bg-card text-foreground"}`}
            style={{ left: `calc(${node.x}% - 23px)`, top: `calc(${node.y}% - 23px)` }}
          >
            <NodeGlyph shape={node.shape} size={46} />
          </Button>
        ))}
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          onClick={undo}
          disabled={locked || replay.completed || replay.chain.length === 0}
          className="h-11 flex-1 rounded-xl border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-foreground disabled:opacity-40"
        >
          Undo
        </button>
        <button
          type="button"
          onClick={reset}
          disabled={locked || replay.completed || replay.chain.length === 0}
          className="h-11 flex-1 rounded-xl border border-border bg-card font-display text-sm font-bold uppercase tracking-widest text-foreground disabled:opacity-40"
        >
          Reset
        </button>
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "chain") return null;
  const taps = decodeChainTaps(myAnswer ?? "");
  const replay = replayChain(puzzle.nodes, puzzle.cycle, taps);
  const errors = taps.filter((_tap, index) => replay.verdicts[index] === false);
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((CHAIN_TIME_MS - myMsRemaining) / 100) / 10;
  const used = new Set(replay.chain);
  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center justify-center gap-2">
      <div className="relative h-[min(45vh,300px)] w-full max-w-[300px] shrink">
        <ChainLines nodes={puzzle.nodes} chain={replay.chain} width={2.5} />
        {puzzle.nodes.map((node, index) => (
          <span
            key={index}
            className={`absolute flex size-7 items-center justify-center rounded-full border bg-card ${used.has(index) ? "border-primary text-primary" : "border-border text-foreground"}`}
            style={{ left: `calc(${node.x}% - 14px)`, top: `calc(${node.y}% - 14px)` }}
          >
            <NodeGlyph shape={node.shape} size={28} />
          </span>
        ))}
        {errors.map((nodeId, index) => {
          const node = puzzle.nodes[nodeId];
          return node ? (
            <span
              key={`${nodeId}-${index}`}
              className="absolute z-10 size-2.5 rounded-full bg-warn ring-2 ring-background"
              style={{ left: `calc(${node.x}% + 7px)`, top: `calc(${node.y}% - 14px)` }}
            />
          ) : null;
        })}
      </div>
      <p className="shrink-0 whitespace-nowrap text-center font-mono text-sm font-bold">
        {replay.chain.length} / {CHAIN_LENGTH} · {replay.errors} error
        {replay.errors === 1 ? "" : "s"}
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
  generate: () =>
    ({
      type: "chain",
      nodes: [],
      cycle: ["circle", "square", "triangle"],
    }) satisfies ChainPuzzleData,
  check: () => false,
  revealHeading: "Your chain",
  IntroExample,
  Stage,
  Reveal,
};
