import { useEffect, useMemo, useRef } from "react";

import { GLYPH_COLOURS } from "@/components/duel/ShapeGlyph";
import { hapticTick } from "@/components/puzzles/GridDrag";
import {
  chainRequired,
  chainValue,
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
  type ChainRuleKind,
} from "@/lib/duel/types";
import { buzz } from "@/lib/motion";
import { playCorrect, playWrong } from "@/lib/sound";

import type { PuzzleDefinition, PuzzleRevealProps, PuzzleStageProps } from "./types";

const STAR_FREE_SHAPES = { circle: true, square: true, triangle: true } as const;

/** One node: its shape, in its colour, on a dark disc. */
function NodeGlyph({ node, size }: { node: ChainNode; size: number }) {
  const fill = GLYPH_COLOURS[node.colour];
  const inner = Math.round(size * 0.62);
  void STAR_FREE_SHAPES;
  return (
    <svg width={inner} height={inner} viewBox="0 0 24 24" aria-hidden="true">
      {node.shape === "circle" && <circle cx="12" cy="12" r="9.5" fill={fill} />}
      {node.shape === "square" && <rect x="2.5" y="2.5" width="19" height="19" rx="2" fill={fill} />}
      {node.shape === "triangle" && <polygon points="12,2.5 22,21 2,21" fill={fill} />}
    </svg>
  );
}

/** The repeating rule, with the item needed next held bright. */
function RuleStrip({
  kind,
  cycle,
  step,
  compact,
}: {
  kind: ChainRuleKind;
  cycle: string[];
  step: number;
  compact?: boolean;
}) {
  const needed = chainRequired(cycle, step);
  const size = compact ? 24 : 34;
  return (
    <div className="flex shrink-0 items-center justify-center gap-1.5">
      {cycle.map((value, index) => {
        const active = value === needed;
        const node: ChainNode = {
          x: 0,
          y: 0,
          shape: (kind === "shape" ? value : "circle") as ChainNode["shape"],
          colour: (kind === "colour" ? value : "RED") as ChainNode["colour"],
        };
        return (
          <span key={`${value}-${index}`} className="flex items-center gap-1.5">
            <span
              className={`flex items-center justify-center rounded-full border-2 ${
                active ? "border-primary bg-primary/15" : "border-border bg-card"
              }`}
              style={{ width: size, height: size }}
            >
              <NodeGlyph node={node} size={size} />
            </span>
            <span className="font-mono text-xs text-muted-foreground">→</span>
          </span>
        );
      })}
      <span className="font-mono text-xs text-muted-foreground">…</span>
    </div>
  );
}

const EXAMPLE_CYCLE = ["triangle", "circle", "square"];
const EXAMPLE_NODES: ChainNode[] = [
  { x: 18, y: 60, shape: "triangle", colour: "RED" },
  { x: 50, y: 30, shape: "circle", colour: "BLUE" },
  { x: 82, y: 62, shape: "square", colour: "GREEN" },
];

/** Fixed intro example — never randomised. */
function IntroExample() {
  return (
    <div className="flex w-full flex-col items-center gap-2">
      <RuleStrip kind="shape" cycle={EXAMPLE_CYCLE} step={0} compact />
      <div className="relative h-20 w-full max-w-[220px]">
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          <polyline
            points="39.6,48 110,24 180.4,49.6"
            fill="none"
            stroke={GLYPH_COLOURS.GOLD}
            strokeWidth="3"
            strokeLinecap="round"
          />
        </svg>
        {EXAMPLE_NODES.map((node, index) => (
          <span
            key={index}
            className="absolute flex items-center justify-center rounded-full border-2 border-primary bg-card"
            style={{
              width: 38,
              height: 38,
              left: `calc(${node.x}% - 19px)`,
              top: `calc(${node.y}% - 19px)`,
            }}
          >
            <NodeGlyph node={node} size={38} />
          </span>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">
        Triangle, circle, square — then start the cycle again.
      </p>
    </div>
  );
}

function Stage({ puzzle, locked, onSubmit, onDraftAnswer, stateKey = "chain" }: PuzzleStageProps) {
  const data: ChainPuzzleData | null = puzzle.type === "chain" ? puzzle : null;
  const [taps, setTaps] = useStageState<number[]>(stateKey, "chainTaps", () => []);
  const [wrong, setWrong] = useStageState<number | null>(stateKey, "chainWrong", () => null);
  const submitted = useRef(false);

  const replay = useMemo(
    () => (data ? replayChain(data.nodes, data.kind, data.cycle, taps) : null),
    [data, taps],
  );

  useEffect(() => {
    onDraftAnswer?.(encodeChainTaps(taps));
  }, [taps, onDraftAnswer]);

  useEffect(() => {
    if (locked || submitted.current || !replay?.completed) return;
    submitted.current = true;
    playCorrect();
    onSubmit(encodeChainTaps(taps));
  }, [replay?.completed, taps, locked, onSubmit]);

  if (!data || !replay) return null;

  const tap = (index: number) => {
    if (locked || submitted.current || replay.completed) return;
    const node = data.nodes[index];
    if (!node) return;
    const ok = chainValue(node, data.kind) === chainRequired(data.cycle, replay.chain.length);
    if (ok) {
      hapticTick();
    } else {
      buzz(20);
      playWrong();
      setWrong(index);
      setTimeout(() => setWrong(null), 280);
    }
    setTaps((current) => [...current, index]);
  };

  const chainSet = new Set(replay.chain);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <RuleStrip kind={data.kind} cycle={data.cycle} step={replay.chain.length} />
      <p className="shrink-0 text-center font-mono text-xs uppercase tracking-widest text-muted-foreground">
        chain{" "}
        <span className="text-primary">
          {replay.chain.length} / {CHAIN_LENGTH}
        </span>
      </p>

      <div className="relative min-h-0 w-full flex-1">
        <svg className="pointer-events-none absolute inset-0 h-full w-full" aria-hidden="true">
          {replay.chain.slice(1).map((cell, index) => {
            const from = data.nodes[replay.chain[index]!]!;
            const to = data.nodes[cell]!;
            return (
              <line
                key={index}
                x1={`${from.x}%`}
                y1={`${from.y}%`}
                x2={`${to.x}%`}
                y2={`${to.y}%`}
                stroke={GLYPH_COLOURS.GOLD}
                strokeWidth="3"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        {data.nodes.map((node, index) => (
          <button
            key={index}
            type="button"
            disabled={locked}
            aria-label={`Node ${index + 1}`}
            onClick={() => tap(index)}
            className={`absolute flex items-center justify-center rounded-full border-2 bg-card ${
              wrong === index
                ? "animate-shake border-warn"
                : chainSet.has(index)
                  ? "border-primary bg-primary/15"
                  : "border-border"
            }`}
            style={{
              width: 46,
              height: 46,
              left: `calc(${node.x}% - 23px)`,
              top: `calc(${node.y}% - 23px)`,
            }}
          >
            <NodeGlyph node={node} size={46} />
          </button>
        ))}
      </div>
    </div>
  );
}

function Reveal({ puzzle, myAnswer, myCorrect, myMsRemaining }: PuzzleRevealProps) {
  if (puzzle.type !== "chain") return null;
  const replay = replayChain(puzzle.nodes, puzzle.kind, puzzle.cycle, decodeChainTaps(myAnswer ?? ""));
  const elapsed =
    myMsRemaining === undefined ? null : Math.round((CHAIN_TIME_MS - myMsRemaining) / 100) / 10;
  const chainSet = new Set(replay.chain);

  return (
    <div className="flex min-h-0 w-full flex-1 flex-col items-center gap-2">
      <RuleStrip kind={puzzle.kind} cycle={puzzle.cycle} step={replay.chain.length} compact />
      <div className="relative min-h-0 w-full flex-1">
        <svg className="absolute inset-0 h-full w-full" aria-hidden="true">
          {replay.chain.slice(1).map((cell, index) => {
            const from = puzzle.nodes[replay.chain[index]!]!;
            const to = puzzle.nodes[cell]!;
            return (
              <line
                key={index}
                x1={`${from.x}%`}
                y1={`${from.y}%`}
                x2={`${to.x}%`}
                y2={`${to.y}%`}
                stroke={GLYPH_COLOURS.GOLD}
                strokeWidth="2"
                strokeLinecap="round"
              />
            );
          })}
        </svg>
        {puzzle.nodes.map((node, index) => (
          <span
            key={index}
            className={`absolute flex items-center justify-center rounded-full border-2 bg-card ${
              chainSet.has(index) ? "border-primary" : "border-border"
            }`}
            style={{
              width: 30,
              height: 30,
              left: `calc(${node.x}% - 15px)`,
              top: `calc(${node.y}% - 15px)`,
            }}
          >
            <NodeGlyph node={node} size={30} />
          </span>
        ))}
      </div>
      <p className="shrink-0 font-display text-xl font-bold">
        <span className={myCorrect ? "text-primary" : "text-warn"}>
          {replay.chain.length} / {CHAIN_LENGTH}
        </span>
        <span className="ml-2 font-mono text-xs uppercase tracking-widest text-muted-foreground">
          {replay.errors} error{replay.errors === 1 ? "" : "s"}
          {elapsed !== null ? ` · ${elapsed.toFixed(1)}s` : ""}
        </span>
      </p>
    </div>
  );
}

/** Nodes and the rule come from the server, checked for two right and four wrong at every step. */
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
      kind: "shape",
      cycle: ["triangle", "circle", "square"],
    }) satisfies ChainPuzzleData,
  check: () => false,
  revealHeading: "Your chain",
  IntroExample,
  Stage,
  Reveal,
};
